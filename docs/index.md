# VS Code GPG

Transparent GPG encryption/decryption for files in VS Code.

## Overview

VS Code GPG is a Visual Studio Code extension that provides transparent encryption and decryption for files using GPG (GNU Privacy Guard). The extension seamlessly integrates with your workflow, allowing you to work with encrypted files as if they were plain text documents.

## Features

- **Transparent encryption/decryption**: Files with `.gpg` or `.asc` extensions are automatically decrypted when opened and encrypted when saved
- **No external dependencies**: Uses [openpgp.js](https://github.com/openpgpjs/openpgpjs) for pure JavaScript OpenPGP implementation
- **Secure key storage**: Keys and passphrases are stored using VS Code's encrypted storage APIs
- **Key management**: Generate, import, and manage your GPG keys directly from VS Code
- **Custom file extensions**: Configure which file extensions should be treated as encrypted

## Quick Start

### First Time Setup

1. Install the extension from the VS Code Marketplace
2. Open VS Code and run one of the following commands:
   - `GPG: Generate New Key Pair` - Create a new GPG key pair
   - `GPG: Import Key` - Import an existing GPG key

### Basic Usage

1. **Open an encrypted file**: Simply open a `.gpg` or `.asc` file - it will be automatically decrypted
2. **Edit and save**: Make your changes and save - the file will be automatically encrypted
3. **Encrypt a new file**: Set a default encryption recipient via `GPG: Set Default Recipient`, then save your file with a `.gpg` extension

## How It Works

- **Reading**: When you open a `.gpg` file, the extension intercepts the read operation, decrypts the content using your private key, and displays the plain text in the editor
- **Writing**: When you save a `.gpg` file, the extension encrypts the content using the recipient's public key before writing to disk
- **Files on disk**: Always remain encrypted
- **Files in editor**: Always displayed as decrypted plain text

## Requirements

- VS Code 1.107.0 or higher

## License

MIT

## Links

- [Installation](installation.md)
- [Usage](usage.md)
- [Configuration](configuration.md)
- [Commands](commands.md)
- [Security](security.md)
- [Development](development.md)
- [Specifications](spec/)
