# VS Code GPG

Transparent GPG encryption/decryption for files in VS Code.

## Features

- **Transparent encryption/decryption**: Files with `.gpg` or `.asc` extensions are automatically decrypted when opened and encrypted when saved
- **No external dependencies**: Uses [openpgp.js] for pure JavaScript OpenPGP implementation
- **Secure key storage**: Keys and passphrases are stored using VS Code's encrypted storage APIs
- **Key management**: Generate, import, and manage your GPG keys directly from VS Code

## Getting Started

### First Time Setup

1. Install the extension
2. Open VS Code and run one of the following commands:
   - `GPG: Generate New Key Pair` - Create a new GPG key pair
   - `GPG: Import Key` - Import an existing GPG key

### Using the Extension

1. **Open an encrypted file**: Simply open a `.gpg` or `.asc` file - it will be automatically decrypted
2. **Edit and save**: Make your changes and save - the file will be automatically encrypted
3. **Encrypt a new file**: Set a default encryption recipient via `GPG: Set Default Recipient`, then save your file with a `.gpg` extension

## Commands

| Command | Description |
|---------|-------------|
| `GPG: Open Encrypted File` | Open a file with GPG decryption |
| `GPG: Import Key` | Import a GPG key from clipboard |
| `GPG: List Keys` | Show all stored GPG keys |
| `GPG: Remove Key` | Remove a stored GPG key |
| `GPG: Set Default Recipient` | Set the default encryption recipient |
| `GPG: Generate New Key Pair` | Generate a new GPG key pair |
| `GPG: Show Logs` | Show GPG operation logs |

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `gpg.defaultRecipient` | Default recipient key ID for encryption | `""` |
| `gpg.fileExtensions` | File extensions to treat as encrypted | `[".gpg", ".asc"]` |
| `gpg.askForPassphrase` | Ask for passphrase if not stored | `true` |
| `gpg.autoDecrypt` | Automatically decrypt files when opened | `true` |

## How It Works

- **Reading**: When you open a `.gpg` file, the extension intercepts the read operation, decrypts the content using your private key, and displays the plain text in the editor
- **Writing**: When you save a `.gpg` file, the extension encrypts the content using the recipient's public key before writing to disk
- **Files on disk**: Always remain encrypted
- **Files in editor**: Always displayed as decrypted plain text

## Security

- Private keys and passphrases are stored using VS Code's secure storage APIs
- The extension does not write decrypted content to disk
- Passphrases are never logged or displayed

## Requirements

- VS Code 1.107.0 or higher

## License

MIT

[openpgp.js]: https://github.com/openpgpjs/openpgpjs
