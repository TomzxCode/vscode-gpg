# Usage

## First Time Setup

Before using the extension, you need to have a GPG key pair. You can either generate a new key pair or import an existing one.

### Generating a New Key Pair

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
3. Type and select `GPG: Generate New Key Pair`
4. Enter your user ID (e.g., "John Doe <john@example.com>")
5. Enter a passphrase to protect your private key (optional but recommended)
6. Confirm your passphrase
7. Wait for the key generation to complete

### Importing an Existing Key

1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
3. Type and select `GPG: Import Key`
4. Select your key file (`.asc`, `.gpg`, or `.key`)
5. If the key is password-protected, enter the passphrase when prompted
6. Choose whether to save the passphrase for future use

## Opening Encrypted Files

### Automatic Decryption

When you open a file with a `.gpg` or `.asc` extension, the extension will automatically decrypt it if:

1. You have a matching private key in your key storage
2. The passphrase is either saved or you enter it when prompted

### Manual Decryption

To manually open an encrypted file:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type and select `GPG: Open Encrypted File`
3. Select the file you want to open
4. Enter the passphrase if prompted

## Editing Encrypted Files

Once an encrypted file is open, you can edit it like any other file. When you save:

1. The extension encrypts the content using the default recipient's public key
2. The encrypted file is written to disk
3. The editor continues to show the decrypted content

## Encrypting New Files

To encrypt a new file:

1. Create a new file and give it a `.gpg` or `.asc` extension
2. Set a default encryption recipient (see below)
3. Add your content and save
4. The file will be automatically encrypted

### Setting the Default Recipient

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type and select `GPG: Set Default Recipient`
3. Select a public key from the list
4. This key will be used for encryption until you change it

## Managing Keys

### Listing Keys

To see all stored keys:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type and select `GPG: List Keys`
3. A quick pick window will show all your stored keys

### Removing Keys

To remove a stored key:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type and select `GPG: Remove Key`
3. Select the key you want to remove
4. Confirm the removal

## Viewing Logs

To view extension logs for debugging:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type and select `GPG: Show Logs`
3. The output panel will open with the extension logs

## Troubleshooting

### File Won't Decrypt

- Ensure you have the correct private key
- Check that you're entering the correct passphrase
- Try listing your keys to verify the key is present

### File Won't Encrypt

- Ensure you have a public key for the recipient
- Check that a default recipient is set
- Verify the public key corresponds to the intended recipient

### Passphrase Issues

- If you forget a passphrase, you'll need to remove and re-import the key
- Use the "Show Logs" command to see detailed error messages
