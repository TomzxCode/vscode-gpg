# VS Code GPG Extension - Implementation Plan

## Overview
Implement a VS Code extension that transparently handles GPG encrypted files. Files on disk remain encrypted (.gpg/.asc), but the editor displays decrypted plain text content.

## User Requirements (from Q&A)
- **Encryption**: Use configurable default recipient (no prompts during save)
- **File extensions**: Handle `.gpg` and `.asc` files
- **Display**: Keep full filename in editor (e.g., `file.txt.gpg`)

## Architecture

### Core Components
1. **TextDocumentContentProvider** (`gpgfile:` scheme) - Decrypts and provides content for reading
2. **FileSystemProvider** (`gpgfs:` scheme) - Encrypts content on write
3. **openpgp.js** - Pure JavaScript OpenPGP implementation (no external GPG binary required)

### Key Management
- Keys stored in VS Code's globalState (encrypted with VS Code's encryption API)
- Support importing private/public keys from files or clipboard
- Passphrase stored securely in VS Code's secret storage (extension.secrets API)
- UI for managing keys (list, import, remove, set default)

### File Structure
```
vscode-gpg/
├── package.json                      # Extension manifest
├── tsconfig.json                     # TypeScript config
├── src/
│   ├── extension.ts                  # Entry point, provider registration
│   ├── crypto/
│   │   ├── openpgp.ts                # openpgp.js wrapper
│   │   ├── keyManager.ts             # Key storage and management
│   │   └── config.ts                 # Configuration handling
│   ├── providers/
│   │   ├── encryptedDocumentProvider.ts    # Read path (TextDocumentContentProvider)
│   │   └── encryptedFileSystemProvider.ts  # Write path (FileSystemProvider)
│   ├── commands/
│   │   ├── keyCommands.ts            # Key management commands
│   │   └── encryptCommands.ts        # Encryption commands
│   └── util/
│       └── logger.ts                 # Output channel logging
├── README.md
└── .vscode/
    └── launch.json                   # Debug config
```

## Implementation Steps

### Step 1: Project Scaffold
Create `package.json` with:
- Extension metadata (name, publisher, version)
- Dependencies: `openpgp` package
- Activation events: `onLanguage:plaintext`, `onCommand:vscode.openWith`
- Contribution: language definition for `.gpg`/`.asc` files, commands for key management
- Configuration schema (default recipient, etc.)

Create `tsconfig.json` for VS Code extension development.

### Step 2: OpenPGP Wrapper (`src/crypto/openpgp.ts`)
Implement encryption/decryption using openpgp.js:
- `encrypt(content: string, recipientKeyId: string): Promise<Uint8Array>` - Encrypt to recipient
- `decrypt(encryptedData: Uint8Array): Promise<string>` - Decrypt with stored private key
- `generateKey(userId: string, passphrase: string): Promise<KeyPair>` - Generate new key pair
- Use openpgp.js API: `openpgp.encrypt()`, `openpgp.decrypt()`, `openpgp.readKey()`, `openpgp.readPrivateKey()`

### Step 3: Key Management (`src/crypto/keyManager.ts`)
Implement key storage and management:
- Store keys in VS Code globalState (encrypted)
- Store passphrases in VS Code extension.secrets API
- Functions:
  - `importKey(keyData: string, isPrivate: boolean): Promise<void>` - Import key from armored string
  - `listKeys(): Promise<KeyInfo[]>` - List stored keys
  - `setDefaultRecipient(keyId: string): Promise<void>` - Set default encryption key
  - `removeKey(keyId: string): Promise<void>` - Remove stored key
  - `getPrivateKey(keyId: string): Promise<Key>` - Retrieve private key with passphrase

### Step 4: Read Path - Document Provider (`src/providers/encryptedDocumentProvider.ts`)
Implement `TextDocumentContentProvider`:
- `provideTextDocumentContent(uri: Uri): Promise<string>`
  - Parse URI to extract file path
  - Read encrypted file from disk
  - Decrypt via openpgp.js wrapper
  - Return plain text
- Register with `gpgfile:` scheme
- Handle `.gpg` and `.asc` extensions

### Step 5: Write Path - File System Provider (`src/providers/encryptedFileSystemProvider.ts`)
Implement `FileSystemProvider`:
- `writeFile(uri, content, options): Promise<void>`
  - Encrypt content via openpgp.js wrapper
  - Write encrypted data to disk
- Implement required methods: `stat`, `readFile`, `watch`, `delete`, `rename`, etc.
- Register with `gpgfs:` scheme

### Step 6: Key Management Commands (`src/commands/keyCommands.ts`)
Implement commands:
- `gpg.importKey` - Import key from file or clipboard
- `gpg.listKeys` - Show all stored keys
- `gpg.removeKey` - Remove a stored key
- `gpg.setDefaultRecipient` - Set default encryption recipient
- `gpg.generateKey` - Generate new key pair

### Step 7: Extension Entry Point (`src/extension.ts`)
Initialize in `activate()`:
- Register `EncryptedDocumentProvider` for `gpgfile:` scheme
- Register `EncryptedFileSystemProvider` for `gpgfs:` scheme
- Register commands:
  - `gpg.openEncrypted` - Open file with decryption
  - All key management commands
- Initialize keyManager
- Create OutputChannel for logging

### Step 8: Configuration
Add VS Code settings (`package.json`):
```json
{
  "gpg.defaultRecipient": { "type": "string", "default": "" },
  "gpg.fileExtensions": { "type": "array", "default": [".gpg", ".asc"] },
  "gpg.askForPassphrase": { "type": "boolean", "default": "true" }
}
```

### Step 9: Error Handling & UX
- Create OutputChannel for operation logs
- Show error messages for: no keys, decryption failed, missing passphrase
- Prompt for passphrase if not stored (using `window.showInputBox()` with password option)
- Status bar indicator showing encryption status
- First-run setup: prompt user to import or generate keys

## Critical Files to Create
1. `package.json` - Extension manifest and config schema
2. `src/extension.ts` - Entry point with provider registration
3. `src/crypto/openpgp.ts` - openpgp.js wrapper
4. `src/crypto/keyManager.ts` - Key storage and management
5. `src/providers/encryptedDocumentProvider.ts` - Read path
6. `src/providers/encryptedFileSystemProvider.ts` - Write path
7. `src/commands/keyCommands.ts` - Key management commands

## Verification
1. Import or generate a GPG key pair via commands
2. Open a `.gpg` file - should show decrypted content
3. Edit and save - file on disk should remain encrypted
4. Check OutputChannel for operation logs
5. Test with no keys - should prompt to import/generate
6. Test with wrong passphrase - should show decryption error
7. Test key management commands (list, remove, set default)

## Key VS Code APIs
- `workspace.registerTextDocumentContentProvider('gpgfile', provider)`
- `workspace.registerFileSystemProvider('gpgfs', fsProvider)`
- `context.globalState` - Store encrypted keys
- `extension.secrets` API - Store passphrases securely
- `window.createOutputChannel('GPG')`
- `workspace.getConfiguration('gpg')`
- `window.showInputBox()` - For passphrase input
- `window.showQuickPick()` - For key selection
