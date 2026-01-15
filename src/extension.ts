import * as vscode from 'vscode';
import { KeyManager } from './crypto/keyManager';
import { EncryptedFileSystemProvider } from './providers/encryptedFileSystemProvider';
import { registerKeyCommands } from './commands/keyCommands';
import { isEncryptedFile } from './crypto/config';
import { initializeLogger, log, logError, disposeLogger } from './util/logger';

let keyManager: KeyManager;
let fileSystemProvider: EncryptedFileSystemProvider;

export function activate(context: vscode.ExtensionContext) {
  initializeLogger();
  log('Activating VS Code GPG extension');

  // Initialize key manager
  keyManager = new KeyManager(context);

  // Register file system provider for reading and writing encrypted files
  fileSystemProvider = new EncryptedFileSystemProvider(keyManager);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('gpgfs', fileSystemProvider, {
      isCaseSensitive: true,
      isReadonly: false,
    })
  );

  // Register commands
  registerKeyCommands(context, keyManager);

  // Watch for configuration changes to reload keys when keyPaths changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('gpg.keyPaths')) {
        log('gpg.keyPaths configuration changed, reloading keys');
        const config = vscode.workspace.getConfiguration('gpg');
        const keyPaths = config.get<string[]>('keyPaths', []);

        if (keyPaths.length > 0) {
          try {
            await keyManager.reloadKeysFromPaths();
            const allKeys = await keyManager.listKeys();
            log(`Reloaded keys from paths. Total keys: ${allKeys.length}`);
          } catch (error) {
            logError('Failed to reload keys after configuration change', error);
          }
        } else {
          // If keyPaths is now empty, clear external keys
          await keyManager.reloadKeysFromPaths();
          log('keyPaths cleared, external keys removed');
        }
      }
    })
  );

  // Register command to open encrypted file
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.openEncrypted', async (uri?: vscode.Uri) => {
      if (!uri) {
        // Ask user to select a file
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          title: 'Select Encrypted File',
        });
        if (!fileUri || fileUri.length === 0) {
          return;
        }
        uri = fileUri[0];
      }

      // Open with gpgfs scheme for automatic decryption and editing
      const gpgUri = uri.with({ scheme: 'gpgfs' });
      await vscode.window.showTextDocument(gpgUri);
    })
  );

  // Handle .gpg and .asc file opening
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      const uri = document.uri;
      if (uri.scheme === 'file' && isEncryptedFile(uri.fsPath)) {
        log(`Detected encrypted file: ${uri.fsPath}`);

        // Check if we should auto-open with decryption
        const config = vscode.workspace.getConfiguration('gpg');
        const autoDecrypt = config.get<boolean>('autoDecrypt', true);

        if (autoDecrypt) {
          // Close the current document and reopen with our provider
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          const gpgUri = uri.with({ scheme: 'gpgfs' });
          await vscode.window.showTextDocument(gpgUri);
        }
      }
    })
  );

  // Handle saving new .gpg files - encrypt after save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const uri = document.uri;

      // Only handle files with .gpg extension using file:// scheme
      if (uri.scheme !== 'file' || !isEncryptedFile(uri.fsPath)) {
        return;
      }

      log(`File saved: ${uri.fsPath}`);

      // Check if file is already encrypted
      const fs = await import('fs/promises');
      try {
        const fileContent = await fs.readFile(uri.fsPath);
        const { isAsciiArmored } = await import('./crypto/openpgp');

        const alreadyEncrypted = isAsciiArmored(fileContent) ||
                                 fileContent[0] === 0x85 ||
                                 fileContent[0] === 0x84 ||
                                 fileContent[0] === 0x8c;

        if (alreadyEncrypted) {
          log(`File is already encrypted, nothing to do`);
          return;
        }

        // File is plain text, need to encrypt it
        log(`File is plain text, encrypting...`);

        const plainText = fileContent.toString('utf-8');

        // Get encryption key
        let recipientKeyId = await keyManager.getDefaultRecipient();

        if (!recipientKeyId) {
          const publicKeys = await keyManager.listPublicKeys();
          if (publicKeys.length === 0) {
            vscode.window.showErrorMessage(
              'No public key available for encryption.',
              'Import Key',
              'Generate Key'
            ).then(selection => {
              if (selection === 'Import Key') {
                vscode.commands.executeCommand('gpg.importKey');
              } else if (selection === 'Generate Key') {
                vscode.commands.executeCommand('gpg.generateKey');
              }
            });
            return;
          }

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
            vscode.window.showWarningMessage('No encryption key selected. File was not encrypted.');
            return;
          }

          recipientKeyId = selected.keyId;

          const setDefault = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Set this as the default encryption key?',
          });

          if (setDefault === 'Yes') {
            await keyManager.setDefaultRecipient(recipientKeyId);
          }
        }

        const publicKeyArmored = keyManager.getPublicKey(recipientKeyId);
        if (!publicKeyArmored) {
          vscode.window.showErrorMessage(`Encryption key not found: ${recipientKeyId}`);
          return;
        }

        // Encrypt and overwrite
        const { encrypt } = await import('./crypto/openpgp');
        const encryptedData = await encrypt(plainText, publicKeyArmored);

        await fs.writeFile(uri.fsPath, encryptedData);
        log(`Successfully encrypted file: ${uri.fsPath}`);

        vscode.window.showInformationMessage('File encrypted successfully.');

        // Close the original editor and reopen with gpgfs scheme
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        const gpgUri = uri.with({ scheme: 'gpgfs' });
        await vscode.window.showTextDocument(gpgUri);
      } catch (error) {
        logError(`Error encrypting file ${uri.fsPath}`, error);
        vscode.window.showErrorMessage(`Failed to encrypt file: ${(error as Error).message}`);
      }
    })
  );

  // Check for first-time setup
  checkFirstTimeSetup(context);

  log('VS Code GPG extension activated');
}

async function checkFirstTimeSetup(context: vscode.ExtensionContext) {
  const hasShownWelcome = context.globalState.get<boolean>('gpg.welcomeShown', false);
  if (!hasShownWelcome) {
    const keys = await keyManager.listKeys();
    if (keys.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'Welcome to VS Code GPG! To get started, you need to import or generate a GPG key pair.',
        'Generate Key',
        'Import Key',
        'Close'
      );

      if (action === 'Generate Key') {
        vscode.commands.executeCommand('gpg.generateKey');
      } else if (action === 'Import Key') {
        vscode.commands.executeCommand('gpg.importKey');
      }
    }

    await context.globalState.update('gpg.welcomeShown', true);
  }
}

export function deactivate() {
  log('Deactivating VS Code GPG extension');
  disposeLogger();
}
