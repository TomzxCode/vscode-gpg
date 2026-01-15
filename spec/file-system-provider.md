# File System Provider

## Requirements

This specification defines the requirements for the encrypted file system provider in VS Code GPG.

### Functional Requirements

#### MUST

- The extension MUST register a file system provider for the `gpgfs://` scheme
- The extension MUST implement `vscode.FileSystemProvider` interface
- The provider MUST decrypt files when read via `readFile()`
- The provider MUST encrypt files when written via `writeFile()`
- The provider MUST support standard file operations: `stat()`, `delete()`, `rename()`, `readDirectory()`
- The provider MUST emit file change events via `onDidChangeFile`

#### SHOULD

- The provider SHOULD handle decryption errors gracefully
- The provider SHOULD verify encryption key availability before writing
- The provider SHOULD warn when encrypting without a matching private key
- The provider SHOULD create parent directories when writing new files

#### MAY

- The provider MAY implement file watching via `watch()`
- The provider MAY support symbolic links

## Implementation Details

### Registration

The file system provider is registered in `extension.ts`:

```typescript
vscode.workspace.registerFileSystemProvider('gpgfs', fileSystemProvider, {
  isCaseSensitive: true,
  isReadonly: false,
})
```

### URI Scheme

- **Scheme**: `gpgfs`
- **Format**: `gpgfs:///absolute/path/to/file.gpg`
- **File Path**: Accessible via `uri.fsPath`

### Required Methods

#### `stat(uri: vscode.Uri): Promise<vscode.FileStat>`

Returns file statistics without decrypting:
- Type (file, directory, unknown)
- Size (encrypted file size)
- Creation time
- Modification time

#### `readFile(uri: vscode.Uri): Promise<Uint8Array>`

Reads and decrypts a file:
1. Read encrypted data from disk
2. Retrieve private keys
3. For each private key:
   - Get passphrase (stored or prompt user)
   - Attempt decryption
   - Return on first success
4. If all fail, return encrypted data as-is

#### `writeFile(uri: vscode.Uri, content: Uint8Array, options: { create, overwrite }): Promise<void>`

Encrypts and writes a file:
1. Get or select recipient public key
2. Verify private key exists (warn if not)
3. Encrypt content with public key
4. Create parent directories if needed
5. Write encrypted data to disk
6. Emit change event

#### `delete(uri: vscode.Uri): Promise<void>`

Deletes a file:
1. Delete file from disk
2. Emit deletion event

#### `rename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void>`

Renames or moves a file:
1. Move file on disk
2. Emit deletion event for old URI
3. Emit creation event for new URI

#### `readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]>`

Lists directory contents:
1. Read directory entries
2. Return array of [name, type] tuples

#### `watch(uri: vscode.Uri, options: { recursive, excludes }): vscode.Disposable`

File watching (minimal implementation):
- Returns no-op disposable

#### `createDirectory(uri: vscode.Uri): void`

Directory creation:
- Throws `NoPermissions` error (not supported)

### Events

The provider emits `FileChangeEvent` for:
- `Changed`: When a file is written
- `Deleted`: When a file is deleted
- `Created`: When a file is renamed (new URI)

## Error Handling

### Read Errors

- **File not found**: Throw `FileNotFound`
- **No private key**: Display warning, return encrypted content
- **Decryption fails**: Display warning, return encrypted content

### Write Errors

- **No public key**: Display error, throw exception
- **Encryption fails**: Log error, throw exception
- **Permission denied**: Throw `NoPermissions`

## Integration Points

### Opening Files

Files are opened with `gpgfs://` scheme:
1. User selects file (or opens `.gpg` file)
2. Extension converts URI to `gpgfs://` scheme
3. File is opened via `vscode.window.showTextDocument()`
4. Provider's `readFile()` is called automatically

### Saving Files

Files are saved via the provider:
1. User saves in editor
2. Provider's `writeFile()` is called
3. Content is encrypted and written to disk

## Testing Scenarios

- Open file with `gpgfs://` scheme
- Read and decrypt valid file
- Read file with no matching private key
- Write file to new location
- Overwrite existing file
- Delete file via provider
- Rename file via provider
- List directory containing encrypted files
- Handle read errors gracefully
- Handle write errors gracefully
- Verify file change events are emitted
- Create parent directories when writing new file
