import * as vscode from 'vscode';
import * as openpgp from 'openpgp';
import * as fs from 'fs/promises';
import { KeyManager } from '../crypto/keyManager';
import { generateKeyPair, parseKeyInfo, isPassphraseRequired } from '../crypto/openpgp';
import { log, logError, showOutputChannel } from '../util/logger';

export function registerKeyCommands(context: vscode.ExtensionContext, keyManager: KeyManager): void {
  // Import key command
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.importKey', async () => {
      log('Command: gpg.importKey');

      // Ask user to select a key file
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: 'Select GPG Key File',
        filters: {
          'GPG Keys': ['asc', 'gpg', 'key'],
          'All Files': ['*']
        }
      });

      if (!fileUri || fileUri.length === 0) {
        return;
      }

      const keyPath = fileUri[0].fsPath;
      log(`Reading key from: ${keyPath}`);

      try {
        // Read the key file
        const keyData = await fs.readFile(keyPath, 'utf-8');

        // Split the file into separate PGP blocks (in case it contains both public and private keys)
        const keyBlocks: string[] = [];
        const lines = keyData.split('\n');
        let currentBlock: string[] = [];
        let inBlock = false;

        for (const line of lines) {
          if (line.includes('-----BEGIN PGP')) {
            inBlock = true;
            currentBlock = [line];
          } else if (line.includes('-----END PGP')) {
            currentBlock.push(line);
            keyBlocks.push(currentBlock.join('\n'));
            currentBlock = [];
            inBlock = false;
          } else if (inBlock) {
            currentBlock.push(line);
          }
        }

        log(`Found ${keyBlocks.length} key block(s) in file`);

        if (keyBlocks.length === 0) {
          throw new Error('No valid PGP key blocks found in file');
        }

        // Import each key block separately
        const importedKeys: { keyInfo: any; block: string }[] = [];
        for (const block of keyBlocks) {
          const isPrivate = block.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
          log(`Importing ${isPrivate ? 'private' : 'public'} key block`);

          try {
            const keyInfo = await keyManager.importKey(block.trim(), isPrivate);
            importedKeys.push({ keyInfo, block });
          } catch (blockError) {
            logError(`Failed to import one key block`, blockError);
            // Continue with other blocks
          }
        }

        if (importedKeys.length === 0) {
          throw new Error('Failed to import any keys from file');
        }

        // Show success message
        const privateKeys = importedKeys.filter(k => k.keyInfo.isPrivate);
        const publicKeys = importedKeys.filter(k => !k.keyInfo.isPrivate);

        let message = `Successfully imported`;
        const parts: string[] = [];
        if (privateKeys.length > 0) {
          parts.push(`${privateKeys.length} private key${privateKeys.length > 1 ? 's' : ''}`);
        }
        if (publicKeys.length > 0) {
          parts.push(`${publicKeys.length} public key${publicKeys.length > 1 ? 's' : ''}`);
        }
        message += ` ${parts.join(' and ')}`;

        vscode.window.showInformationMessage(message);

        // Handle passphrases for private keys
        for (const { keyInfo, block } of privateKeys) {
          log(`Checking if passphrase is required for key: ${keyInfo.keyId}`);
          const required = await isPassphraseRequired(block);
          log(`Passphrase required for ${keyInfo.keyId}: ${required}`);

          if (required) {
            const passphrase = await vscode.window.showInputBox({
              password: true,
              prompt: `Enter passphrase for key: ${keyInfo.userId}`,
              title: 'GPG Key Passphrase',
            });

            if (passphrase) {
              await keyManager.storePassphrase(keyInfo.keyId, passphrase);
              vscode.window.showInformationMessage('Passphrase saved securely');
            }
          } else {
            log(`Key ${keyInfo.keyId} does not require a passphrase (or is not encrypted)`);
          }
        }
      } catch (error) {
        logError('Failed to import key', error);
        vscode.window.showErrorMessage(`Failed to import key: ${(error as Error).message}`);
      }
    })
  );

  // Manage keys command
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.manageKeys', async () => {
      log('Command: gpg.manageKeys');

      const removeButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('trash'),
        tooltip: 'Remove key',
      };

      const quickPick = vscode.window.createQuickPick();
      quickPick.title = 'Manage GPG Keys';
      quickPick.placeholder = 'Loading keys...';
      quickPick.canSelectMany = false;
      quickPick.ignoreFocusOut = true;

      const refreshItems = async () => {
        const keys = await keyManager.listKeys();

        if (keys.length === 0) {
          quickPick.items = [];
          quickPick.placeholder = 'No GPG keys found. Import or generate keys first.';
          return;
        }

        quickPick.items = keys.map(k => ({
          label: k.userId,
          description: `${k.isPrivate ? '🔒 Private' : '🔓 Public'} | ${k.keyId}`,
          keyId: k.keyId,
          isPrivate: k.isPrivate,
          buttons: [removeButton],
        }));
        quickPick.placeholder = `Found ${keys.length} key(s) - Click the trash icon to remove a key`;
      };

      quickPick.show();
      await refreshItems();

      await new Promise<void>((resolve) => {
        quickPick.onDidTriggerItemButton(async (event) => {
          if (event.button === removeButton) {
            const item = event.item as typeof quickPick.items[0];
            const confirm = await vscode.window.showWarningMessage(
              `Are you sure you want to remove the key: ${item.label}?`,
              'Remove',
              'Cancel'
            );

            if (confirm === 'Remove') {
              await keyManager.removeKey(item.keyId, item.isPrivate);
              vscode.window.showInformationMessage('Key removed successfully');
              await refreshItems();
            }
          }
        });
        quickPick.onDidHide(() => {
          resolve();
          quickPick.dispose();
        });
      });
    })
  );

  // Set default recipient command
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.setDefaultRecipient', async () => {
      log('Command: gpg.setDefaultRecipient');

      const publicKeys = await keyManager.listPublicKeys();

      if (publicKeys.length === 0) {
        vscode.window.showInformationMessage('No public keys found. Import a key first.');
        return;
      }

      const items = publicKeys.map(k => ({
        label: k.userId,
        description: k.keyId,
        keyId: k.keyId,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the default encryption recipient',
        title: 'Set Default GPG Recipient',
      });

      if (selected) {
        await keyManager.setDefaultRecipient(selected.keyId);
        vscode.window.showInformationMessage(`Default recipient set to: ${selected.label}`);
      }
    })
  );

  // Generate key pair command
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.generateKey', async () => {
      log('Command: gpg.generateKey');

      // Step 1: Get user identity
      const userId = await vscode.window.showInputBox({
        prompt: 'Enter your user ID (e.g., "John Doe <john@example.com>")',
        placeHolder: 'Name <email@example.com>',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'User ID is required';
          }
          return null;
        },
      });

      if (!userId) {
        return;
      }

      // Step 2: Get passphrase
      const passphrase = await vscode.window.showInputBox({
        password: true,
        prompt: 'Enter a passphrase to protect your private key',
        placeHolder: 'Passphrase (leave empty for no passphrase)',
      });

      if (passphrase === undefined) {
        return;
      }

      // Confirm passphrase
      const confirmPassphrase = await vscode.window.showInputBox({
        password: true,
        prompt: 'Confirm your passphrase',
        placeHolder: 'Passphrase',
      });

      if (passphrase !== confirmPassphrase) {
        vscode.window.showErrorMessage('Passphrases do not match');
        return;
      }

      try {
        const keyPair = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating GPG key pair...',
            cancellable: false,
          },
          async () => {
            const keyPair = await generateKeyPair(userId, passphrase);

            // Import both keys
            await keyManager.importKey(keyPair.publicKey, false);
            await keyManager.importKey(keyPair.privateKey, true);

            // Store passphrase if provided
            if (passphrase) {
              await keyManager.storePassphrase(keyPair.keyId, passphrase);
            }

            // Set as default recipient
            await keyManager.setDefaultRecipient(keyPair.keyId);

            return keyPair;
          }
        );

        vscode.window.showInformationMessage(
          'Key pair generated successfully! You can now encrypt and decrypt files.'
        );

        // Ask user if they want to save the key pair to disk
        const saveChoice = await vscode.window.showInformationMessage(
          'Would you like to save your key pair to disk as a backup?',
          'Save Key Pair',
          'Skip'
        );

        if (saveChoice === 'Save Key Pair') {
          // Ask for private key location
          const privateKeyName = `${userId.replace(/[^a-zA-Z0-9]/g, '_')}_private.asc`;
          const privateKeyUri = await vscode.window.showSaveDialog({
            title: 'Save Private Key',
            defaultUri: vscode.Uri.file(privateKeyName),
            filters: {
              'GPG Private Key': ['asc'],
              'All Files': ['*']
            }
          });

          if (privateKeyUri) {
            await fs.writeFile(privateKeyUri.fsPath, keyPair.privateKey, 'utf-8');
            vscode.window.showInformationMessage(`Private key saved to: ${privateKeyUri.fsPath}`);

            // Ask for public key location
            const publicKeyName = `${userId.replace(/[^a-zA-Z0-9]/g, '_')}_public.asc`;
            const publicKeyUri = await vscode.window.showSaveDialog({
              title: 'Save Public Key',
              defaultUri: vscode.Uri.file(publicKeyName),
              filters: {
                'GPG Public Key': ['asc'],
                'All Files': ['*']
              }
            });

            if (publicKeyUri) {
              await fs.writeFile(publicKeyUri.fsPath, keyPair.publicKey, 'utf-8');
              vscode.window.showInformationMessage(`Public key saved to: ${publicKeyUri.fsPath}`);
            }
          }
        }
      } catch (error) {
        logError('Failed to generate key pair', error);
        vscode.window.showErrorMessage(`Failed to generate key pair: ${(error as Error).message}`);
      }
    })
  );

  // Show logs command
  context.subscriptions.push(
    vscode.commands.registerCommand('gpg.showLogs', () => {
      log('Command: gpg.showLogs');
      showOutputChannel();
    })
  );
}
