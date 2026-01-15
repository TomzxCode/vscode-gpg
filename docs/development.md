# Development

This document describes how to develop and contribute to VS Code GPG.

## Prerequisites

- [Node.js](https://nodejs.org/) (18.x or later)
- [Bun](https://bun.sh/) (recommended) or npm
- [VS Code](https://code.visualstudio.com/)

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/tomzxcode/vscode-gpg.git
cd vscode-gpg
```

### Install Dependencies

```bash
bun install
```

### Build the Extension

```bash
bun run compile
```

### Run in Development Mode

1. Press `F5` in VS Code
2. A new VS Code window will open with the extension loaded
3. Make changes and press `F5` to reload

## Project Structure

```
vscode-gpg/
├── src/
│   ├── crypto/
│   │   ├── config.ts         # Configuration management
│   │   ├── keyManager.ts     # Key storage and management
│   │   └── openpgp.ts        # OpenPGP operations (encrypt/decrypt)
│   ├── commands/
│   │   └── keyCommands.ts    # Command registrations
│   ├── providers/
│   │   └── encryptedFileSystemProvider.ts  # File system provider
│   ├── util/
│   │   └── logger.ts         # Logging utilities
│   └── extension.ts          # Extension entry point
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── build.mjs                 # Build script
```

## Key Components

### Extension Activation (`extension.ts`)

The extension activates on:
- `onFileSystem:gpgfs` - When a file with the `gpgfs` scheme is opened
- `onLanguage:plaintext` - When a plain text file is opened
- `onCommand:vscode.openWith` - When opening with a specific editor

### File System Provider (`encryptedFileSystemProvider.ts`)

Implements `vscode.FileSystemProvider` to provide:
- `readFile` - Decrypts and returns file content
- `writeFile` - Encrypts and writes file content
- `stat`, `delete`, `rename`, `readDirectory` - Standard file operations

### Key Manager (`keyManager.ts`)

Manages GPG keys through:
- VS Code's global state for key storage
- VS Code's secrets API for passphrase storage
- Import/export/list/remove operations

### OpenPGP Operations (`openpgp.ts`)

Wraps the openpgp.js library:
- `encrypt()` - Encrypts content with a public key
- `decrypt()` - Decrypts content with a private key
- `generateKeyPair()` - Generates new key pairs
- `parseKeyInfo()` - Extracts key information

## Building and Packaging

### Development Build

```bash
bun run watch
```

This will compile TypeScript and watch for changes.

### Production Build

```bash
bun run compile
```

### Package Extension

```bash
bun run package
```

This creates a `.vsix` file that can be installed.

### Publish Extension

```bash
bun run publish
```

This publishes the extension to the VS Code Marketplace.

## Testing

### Manual Testing

1. Press `F5` to launch the extension development host
2. Test key generation
3. Test file encryption/decryption
4. Test edge cases (wrong passphrase, missing keys, etc.)

### Debugging

1. Set breakpoints in TypeScript files
2. Press `F5` to launch with debugger attached
3. Use the `GPG: Show Logs` command to view output

## Contributing

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Add comments for complex logic

### Commit Messages

Use clear, descriptive commit messages:
```
feat: add support for multiple recipients
fix: handle missing passphrase gracefully
docs: update installation instructions
```

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request with a clear description

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [openpgp.js Documentation](https://docs.openpgpjs.org/)
- [OpenPGP Standard (RFC 4880)](https://tools.ietf.org/html/rfc4880)

## License

MIT
