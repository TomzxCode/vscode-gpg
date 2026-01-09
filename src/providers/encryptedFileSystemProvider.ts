import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { encrypt } from '../crypto/openpgp';
import { KeyManager } from '../crypto/keyManager';
import { getConfig } from '../crypto/config';
import { log, logError } from '../util/logger';

export class EncryptedFileSystemProvider implements vscode.FileSystemProvider {
  private onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile = this.onDidChangeFileEmitter.event;

  private watchedFiles = new Set<string>();

  constructor(private keyManager: KeyManager) {}

  watch(): vscode.Disposable {
    // Return a no-op disposable for now
    return { dispose: () => {} };
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const filePath = uri.fsPath;
    try {
      const stats = await fs.stat(filePath);
      return {
        type: stats.isFile() ? vscode.FileType.File : stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.Unknown,
        ctime: stats.ctimeMs,
        mtime: stats.mtimeMs,
        size: stats.size,
      };
    } catch {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const filePath = uri.fsPath;
    log(`FileSystemProvider: readFile ${filePath}`);

    try {
      // Read encrypted file
      const encryptedData = await fs.readFile(filePath);

      // Import the decrypt function
      const { decrypt } = await import('../crypto/openpgp');

      // Get private keys
      const privateKeys = await this.keyManager.listPrivateKeys();
      if (privateKeys.length === 0) {
        const message = 'No private GPG keys found. You need the private key to decrypt this file.';
        log(message);
        vscode.window.showWarningMessage(message + ' Opening encrypted file as-is.', 'Import Private Key')
          .then(selection => {
            if (selection === 'Import Private Key') {
              vscode.commands.executeCommand('gpg.importKey');
            }
          });

        // Return the encrypted content as-is
        return encryptedData;
      }

      // Try to decrypt with available private keys
      let decryptedContent: string | undefined;

      for (const keyInfo of privateKeys) {
        const armoredKey = this.keyManager.getPrivateKey(keyInfo.keyId);
        if (!armoredKey) {
          continue;
        }

        // Get passphrase if required
        const status = await this.keyManager.getKeyPassphraseStatus(keyInfo.keyId);
        let passphrase: string | undefined;

        if (status.required && !status.stored) {
          const config = vscode.workspace.getConfiguration('gpg');
          const askForPassphrase = config.get<boolean>('askForPassphrase', true);

          if (askForPassphrase) {
            passphrase = await vscode.window.showInputBox({
              password: true,
              prompt: `Enter passphrase for key: ${keyInfo.userId} (${keyInfo.keyId})`,
              title: 'GPG Passphrase',
            });

            if (!passphrase) {
              continue;
            }

            // Offer to save passphrase
            const save = await vscode.window.showWarningMessage(
              'Save passphrase for future use?',
              'Save',
              "Don't Save"
            );

            if (save === 'Save') {
              await this.keyManager.storePassphrase(keyInfo.keyId, passphrase);
            }
          } else {
            continue;
          }
        } else if (status.required && status.stored) {
          passphrase = await this.keyManager.getPassphrase(keyInfo.keyId);
        }

        try {
          decryptedContent = await decrypt(encryptedData, armoredKey, passphrase);
          log(`Successfully decrypted with key: ${keyInfo.keyId}`);
          break;
        } catch (error) {
          log(`Failed to decrypt with key ${keyInfo.keyId}: ${(error as Error).message}`);
        }
      }

      if (decryptedContent === undefined) {
        const errorMessage = 'Failed to decrypt file. No matching private key or wrong passphrase.';
        log(errorMessage);
        log(`Tried ${privateKeys.length} private key(s), none succeeded`);
        vscode.window.showWarningMessage(errorMessage + ' Opening encrypted file as-is.');

        // Return the encrypted content as-is
        return encryptedData;
      }

      // Return decrypted content as bytes
      return new TextEncoder().encode(decryptedContent);
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        throw error;
      }
      logError(`Error reading file ${filePath}`, error);

      // Try to return the file content as-is
      try {
        const fallbackData = await fs.readFile(filePath);
        vscode.window.showWarningMessage(`Could not decrypt file. Opening as-is.`);
        return fallbackData;
      } catch {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean; }
  ): Promise<void> {
    const filePath = uri.fsPath;
    log(`FileSystemProvider: writeFile ${filePath} (${content.length} bytes)`);

    try {
      // Get default recipient
      let recipientKeyId = await this.keyManager.getDefaultRecipient();
      const config = getConfig();

      if (!recipientKeyId) {
        // Try to get from config as fallback
        recipientKeyId = config.defaultRecipient;
      }

      if (!recipientKeyId) {
        const publicKeys = await this.keyManager.listPublicKeys();
        if (publicKeys.length === 0) {
          const message = 'No public key available for encryption. Please import or generate a key pair first.';
          vscode.window.showErrorMessage(message);
          throw new Error(message);
        }

        // Ask user to select a key
        const selected = await vscode.window.showQuickPick(
          publicKeys.map(k => ({
            label: k.userId,
            description: k.keyId,
            keyId: k.keyId,
          })),
          {
            placeHolder: 'Select a public key for encryption',
            title: 'GPG Encryption Key',
          }
        );

        if (!selected) {
          throw vscode.FileSystemError.NoPermissions('No encryption key selected');
        }

        recipientKeyId = selected.keyId;

        // Ask if this should be the default
        const setDefault = await vscode.window.showQuickPick(['Yes', 'No'], {
          placeHolder: 'Set this as the default encryption key?',
        });

        if (setDefault === 'Yes') {
          await this.keyManager.setDefaultRecipient(recipientKeyId);
        }
      }

      // Get the public key
      const publicKeyArmored = this.keyManager.getPublicKey(recipientKeyId);
      if (!publicKeyArmored) {
        const message = `Encryption key not found: ${recipientKeyId}`;
        vscode.window.showErrorMessage(message);
        throw new Error(message);
      }

      // Verify that we have the corresponding private key to decrypt later
      const privateKey = this.keyManager.getPrivateKey(recipientKeyId);
      if (!privateKey) {
        const message = `Warning: Encrypting with a public key that has no corresponding private key. You won't be able to decrypt this file.`;
        log(message);
        const proceed = await vscode.window.showWarningMessage(
          message,
          'Proceed Anyway',
          'Cancel'
        );
        if (proceed !== 'Proceed Anyway') {
          throw vscode.FileSystemError.NoPermissions('Encryption cancelled');
        }
      }

      // Convert content to string
      const textContent = new TextDecoder().decode(content);

      // Encrypt the content
      log(`Encrypting with key: ${recipientKeyId}`);
      const encryptedData = await encrypt(textContent, publicKeyArmored);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write encrypted data
      await fs.writeFile(filePath, encryptedData);

      log(`Successfully wrote encrypted file: ${filePath}`);

      // Notify about the change
      this.onDidChangeFileEmitter.fire([
        { type: vscode.FileChangeType.Changed, uri }
      ]);
    } catch (error) {
      logError(`Failed to write encrypted file ${filePath}`, error);
      throw error;
    }
  }

  async delete(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;
    log(`FileSystemProvider: delete ${filePath}`);
    try {
      await fs.unlink(filePath);
      this.onDidChangeFileEmitter.fire([
        { type: vscode.FileChangeType.Deleted, uri }
      ]);
    } catch {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    const oldPath = oldUri.fsPath;
    const newPath = newUri.fsPath;
    log(`FileSystemProvider: rename ${oldPath} -> ${newPath}`);

    try {
      await fs.rename(oldPath, newPath);
      this.onDidChangeFileEmitter.fire([
        { type: vscode.FileChangeType.Deleted, uri: oldUri },
        { type: vscode.FileChangeType.Created, uri: newUri }
      ]);
    } catch {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const dirPath = uri.fsPath;
    log(`FileSystemProvider: readDirectory ${dirPath}`);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map(entry => [
        entry.name,
        entry.isFile() ? vscode.FileType.File :
        entry.isDirectory() ? vscode.FileType.Directory :
        entry.isSymbolicLink() ? vscode.FileType.SymbolicLink :
        vscode.FileType.Unknown
      ]);
    } catch {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  createDirectory(uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions('Cannot create directories in encrypted file system');
  }
}
