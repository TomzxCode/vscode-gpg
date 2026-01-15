# Decryption

## Requirements

This specification defines the requirements for the decryption functionality in VS Code GPG.

### Functional Requirements

#### MUST

- The extension MUST decrypt files when opened with a `.gpg` or `.asc` extension (or configured extensions)
- The extension MUST use the user's private key for decryption
- The extension MUST support ASCII-armored and binary encrypted formats
- The extension MUST display decrypted content in the editor
- The extension MUST NOT write decrypted content to disk
- The extension MUST try all available private keys until one succeeds

#### SHOULD

- The extension SHOULD prompt for passphrase if the private key is encrypted and passphrase is not stored
- The extension SHOULD offer to save the passphrase for future use
- The extension SHOULD display a warning if decryption fails
- The extension SHOULD fall back to displaying the encrypted content if decryption fails

#### MAY

- The extension MAY cache decrypted passphrases in memory for the current session
- The extension MAY support automatic passphrase retrieval from system keychain

## Implementation Details

### Decryption Flow

1. User opens a file with a configured extension (e.g., `.gpg`)
2. Extension intercepts the file open via:
   - `onDidOpenTextDocument` event for automatic decryption (if `gpg.autoDecrypt` is enabled)
   - `gpg.openEncrypted` command for manual decryption
3. Extension converts the URI to `gpgfs://` scheme
4. `EncryptedFileSystemProvider.readFile()` is invoked
5. Extension reads encrypted data from disk
6. Extension attempts decryption:
   - Retrieves all stored private keys
   - For each private key:
     - Checks if passphrase is required
     - Retrieves stored passphrase or prompts user
     - Attempts to decrypt the file
     - Stops at first successful decryption
7. If successful:
   - Decrypted content is returned to the editor
   - Content is displayed as plain text
8. If all attempts fail:
   - Warning message is displayed to user
   - Encrypted content is displayed as-is (or error is shown)

### Decryption Algorithm

- **Private Key Algorithm**: Elliptic Curve Cryptography (curve25519)
- **Symmetric Algorithm**: AES-256
- **Format**: OpenPGP message format

### Passphrase Handling

When a private key requires a passphrase:
1. Check if passphrase is stored in VS Code secrets
2. If not stored and `gpg.askForPassphrase` is enabled:
   - Prompt user for passphrase via input box (password mode)
   - Offer to save passphrase for future use
   - If user saves, store in VS Code secrets
3. If not stored and `gpg.askForPassphrase` is disabled:
   - Skip this private key and try the next one

### Key Matching

The extension uses the following strategy:
- Read the encrypted message to determine target key IDs
- For each stored private key:
  - Check if the key ID or any subkey ID matches the target
  - If matching, attempt decryption
- If no direct match, attempt decryption with all keys (for compatibility)

## Error Handling

### No Private Key Available

When no private key is available:
1. Display warning message to user
2. Offer option to import a private key
3. Display the encrypted content as-is

### Wrong Passphrase

When the wrong passphrase is provided:
1. Log the failed attempt
2. Continue to the next available private key
3. If all keys fail, display error message

### Decryption Failure

When decryption fails for all keys:
1. Log all attempts with error details
2. Display warning message to user
3. Fall back to displaying the encrypted content as-is
4. Suggest using GPG CLI for decryption

## Configuration

The decryption behavior is configurable via:

- `gpg.askForPassphrase`: Whether to prompt for passphrase if not stored
- `gpg.autoDecrypt`: Whether to automatically decrypt files when opened
- `gpg.fileExtensions`: File extensions that trigger decryption

## Testing Scenarios

- Decrypt a file with stored passphrase
- Decrypt a file without stored passphrase (prompt user)
- Decrypt a file with no passphrase (unprotected key)
- Attempt decryption with no private keys available
- Attempt decryption with wrong passphrase
- Attempt decryption with wrong private key (not the recipient)
- Decrypt ASCII-armored file
- Decrypt binary encrypted file
- Open encrypted file with auto-decrypt enabled
- Open encrypted file with auto-decrypt disabled
- Verify decrypted content is not written to disk
