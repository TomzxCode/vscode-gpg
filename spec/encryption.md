# Encryption

## Requirements

This specification defines the requirements for the encryption functionality in VS Code GPG.

### Functional Requirements

#### MUST

- The extension MUST encrypt files when saved with a `.gpg` or `.asc` extension (or configured extensions)
- The extension MUST use OpenPGP standard (RFC 4880) for encryption
- The extension MUST use the recipient's public key for encryption
- The extension MUST write encrypted data to disk
- The extension MUST support ASCII-armored and binary encrypted formats
- The extension MUST verify that a public key exists before encrypting

#### SHOULD

- The extension SHOULD use curve25519 elliptic curve cryptography for key generation
- The extension SHOULD use AES-256 for symmetric encryption
- The extension SHOULD warn when encrypting with a public key that has no corresponding private key
- The extension SHOULD allow users to select the encryption recipient if no default is set
- The extension SHOULD offer to set the selected recipient as the default

#### MAY

- The extension MAY support multiple recipients for a single file
- The extension MAY support signing encrypted files with the sender's private key

## Implementation Details

### Encryption Flow

1. User creates or edits a file with a configured extension (e.g., `.gpg`)
2. User saves the file
3. Extension intercepts the save operation via:
   - `EncryptedFileSystemProvider.writeFile()` for files opened with `gpgfs://` scheme
   - `onDidSaveTextDocument` event for files opened with `file://` scheme
4. Extension retrieves the recipient's public key:
   - First checks for configured default recipient
   - If no default, prompts user to select from available public keys
   - Offers to save the selection as default
5. Extension encrypts the content using the public key
6. Extension writes encrypted data to disk
7. Extension notifies user of successful encryption

### Encryption Algorithm

- **Public Key Algorithm**: Elliptic Curve Cryptography (curve25519)
- **Symmetric Algorithm**: AES-256
- **Format**: OpenPGP message format

### Key Selection

The default recipient is determined by:
1. VS Code configuration (`gpg.defaultRecipient`)
2. Key manager's stored default
3. User selection via quick pick

## Error Handling

### No Public Key Available

When no public key is available:
1. Display error message to user
2. Offer options to:
   - Import a key
   - Generate a new key pair
3. Cancel the encryption operation

### Encryption Failure

When encryption fails:
1. Log the error with details
2. Display error message to user
3. Do not write unencrypted content to disk
4. Do not corrupt the existing file

## Configuration

The encryption behavior is configurable via:

- `gpg.defaultRecipient`: Key ID of the default encryption recipient
- `gpg.fileExtensions`: File extensions that trigger encryption

## Testing Scenarios

- Encrypt a new file with default recipient
- Encrypt a new file without default recipient (prompt user)
- Encrypt an edited file (replace existing encrypted content)
- Attempt encryption with no public keys available
- Attempt encryption with only private key (no corresponding public key)
- Encrypt with ASCII-armored output
- Encrypt with binary output
- Verify encrypted file cannot be read as plain text
