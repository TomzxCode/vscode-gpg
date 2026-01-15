# Commands

The extension provides several commands that can be accessed through the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).

## File Operations

### `gpg.openEncrypted`

**Title**: GPG: Open Encrypted File

Opens a file picker to select and decrypt an encrypted file. The file will be opened in a custom editor that transparently handles encryption/decryption.

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Open Encrypted File"
3. Select the encrypted file
4. Enter passphrase if prompted

## Key Management

### `gpg.importKey`

**Title**: GPG: Import Key

Imports a GPG key from a file. The extension will:
1. Open a file picker for key selection
2. Parse the key file (supports multiple keys in one file)
3. Detect whether each key is public or private
4. Prompt for passphrase if the private key is encrypted
5. Offer to save the passphrase for future use

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Import Key"
3. Select your key file (`.asc`, `.gpg`, or `.key`)

### `gpg.manageKeys`

**Title**: GPG: Manage Keys

Displays all stored GPG keys in a quick pick window with the ability to remove keys. Each key shows:
- User ID
- Key ID
- Whether it's public or private

Click the trash icon next to a key to remove it. The menu will stay open and refresh after deletion.

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Manage Keys"
3. View your stored keys
4. Click the trash icon to remove a key
5. Confirm the removal

### `gpg.setDefaultRecipient`

**Title**: GPG: Set Default Recipient

Sets the default public key to use for encryption. This key will be used when encrypting files unless you manually select a different one.

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Set Default Recipient"
3. Select a public key from the list

### `gpg.generateKey`

**Title**: GPG: Generate New Key Pair

Generates a new GPG key pair using the elliptic curve cryptography (curve25519). You'll be prompted for:
- User ID (name and email)
- Passphrase (optional)

The extension will:
1. Generate a new key pair
2. Import both the public and private keys
3. Store the passphrase if provided
4. Set the new key as the default recipient

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Generate New Key Pair"
3. Enter your user ID (e.g., "John Doe <john@example.com>")
4. Enter a passphrase (optional but recommended)
5. Confirm your passphrase

## Debugging

### `gpg.showLogs`

**Title**: GPG: Show Logs

Opens the extension's output channel to view logs. This is useful for debugging issues.

**Parameters**: None

**Usage**:
1. Open Command Palette
2. Type "GPG: Show Logs"
3. Review the logs for any errors or warnings

## Keyboard Shortcuts

You can create custom keyboard shortcuts by adding entries to your `keybindings.json` file:

```json
[
  {
    "key": "ctrl+shift+g",
    "command": "gpg.openEncrypted"
  },
  {
    "key": "ctrl+shift+l",
    "command": "gpg.showLogs"
  }
]
```

To open `keybindings.json`:
1. Press `Ctrl+K`, `Ctrl+S` to open Keyboard Shortcuts
2. Click the "..." icon
3. Select "Open Keyboard Shortcuts (JSON)"
