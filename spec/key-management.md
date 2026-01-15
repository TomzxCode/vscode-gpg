# Key Management

## Requirements

This specification defines the requirements for key management in VS Code GPG.

### Functional Requirements

#### MUST

- The extension MUST allow users to generate new GPG key pairs
- The extension MUST allow users to import existing GPG keys from files
- The extension MUST allow users to list all stored keys
- The extension MUST allow users to remove stored keys
- The extension MUST store keys in VS Code's global state
- The extension MUST distinguish between public and private keys
- The extension MUST allow users to set a default recipient for encryption

#### SHOULD

- The extension SHOULD support passphrase-protected private keys
- The extension SHOULD store passphrases in VS Code's secure storage (secrets API)
- The extension SHOULD allow users to store passphrases for convenience
- The extension SHOULD detect whether a key requires a passphrase
- The extension SHOULD display key information (user ID, key ID, type)
- The extension SHOULD support importing multiple keys from a single file

#### MAY

- The extension MAY support exporting keys to files
- The extension MAY support key expiration warnings
- The extension MAY support key revocation

## Implementation Details

### Key Storage

Keys are stored in VS Code's global state:
- **Storage Key**: `gpg.storedKeys`
- **Structure**: Array of `StoredKey` objects
- **Properties**:
  - `keyId`: The key's unique identifier (hex string)
  - `userId`: The user ID associated with the key
  - `isPrivate`: Boolean indicating if this is a private key
  - `armoredKey`: The armored key data

#### Composite Key Pattern

To prevent overwriting public/private keys with the same ID:
- Storage keys are composite: `{keyId}_{type}`
- Types are `public` and `private`
- Example: `ABC123_public`, `ABC123_private`

### Passphrase Storage

Passphrases are stored in VS Code's secrets API:
- **Storage Key Pattern**: `gpg.passphrase.{keyId}`
- **Storage Method**: `context.secrets.store()`
- **Retrieval Method**: `context.secrets.get()`
- **Deletion**: `context.secrets.delete()`

### Key Generation

When generating a new key pair:
1. Prompt for user ID (name and email)
2. Prompt for passphrase (optional)
3. Confirm passphrase
4. Generate key pair using:
   - Algorithm: ECC (Elliptic Curve Cryptography)
   - Curve: curve25519
5. Import both public and private keys
6. Store passphrase if provided
7. Set as default recipient

### Key Import

When importing a key:
1. Open file picker for key selection
2. Read the key file
3. Parse PGP blocks (support multiple keys per file)
4. For each block:
   - Detect if it's public or private
   - Parse key information
   - Store the key
5. For private keys:
   - Check if passphrase is required
   - Prompt for passphrase if required
   - Offer to save passphrase
6. Display success message with summary

### Key Listing

The list commands show:
- Public keys (for encryption)
- Private keys (for decryption)
- Key ID (short format or full hex)
- User ID
- Visual indicator of key type (lock icon or similar)

### Key Removal

When removing a key:
1. Show list of keys in a QuickPick with trash icon buttons
2. User clicks trash icon on the key they want to remove
3. Confirm removal
4. Remove key from storage
5. Remove associated passphrase (if private key)
6. Update storage
7. Refresh the key list to show remaining keys

## Configuration

The default recipient is stored in:
- **Storage Key**: `gpg.defaultRecipient`
- **Type**: String (key ID)
- **Accessed via**: `KeyManager.getDefaultRecipient()` / `setDefaultRecipient()`

## Commands

| Command | Description |
|---------|-------------|
| `gpg.generateKey` | Generate a new GPG key pair |
| `gpg.importKey` | Import a GPG key from a file |
| `gpg.manageKeys` | List and manage (remove) stored GPG keys |
| `gpg.setDefaultRecipient` | Set the default encryption recipient |

## Testing Scenarios

- Generate new key pair with passphrase
- Generate new key pair without passphrase
- Import public key from file
- Import private key from file
- Import file with multiple keys
- Import file with both public and private keys
- List all keys (empty, single, multiple)
- Remove public key
- Remove private key (verify passphrase is also removed)
- Set default recipient
- Store passphrase for key
- Retrieve stored passphrase
- Detect passphrase requirement
- Import key with wrong passphrase
- Verify composite key storage (public/private with same ID)
