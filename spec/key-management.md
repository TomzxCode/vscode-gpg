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
- The extension MUST allow loading keys from external file/directory paths via `gpg.keyPaths` configuration
- The extension MUST distinguish between stored keys and externally loaded keys

#### SHOULD

- The extension SHOULD support passphrase-protected private keys
- The extension SHOULD store passphrases in VS Code's secure storage (secrets API)
- The extension SHOULD allow users to store passphrases for convenience
- The extension SHOULD detect whether a key requires a passphrase
- The extension SHOULD display key information (user ID, key ID, type)
- The extension SHOULD support importing multiple keys from a single file
- The extension SHOULD reload external keys when `gpg.keyPaths` configuration changes
- The extension SHOULD display source file paths for externally loaded keys
- The extension SHOULD prevent removal of externally loaded keys through the UI

#### MAY

- The extension MAY support exporting keys to files
- The extension MAY support key expiration warnings
- The extension MAY support key revocation

### Key Export

When exporting a newly generated key pair:
1. After successful key generation, prompt user if they want to save the key pair to disk
2. If user confirms, show a save dialog for the private key:
   - Default filename: `{sanitized_userId}_private.asc`
   - File filter: GPG Private Key (.asc)
3. Write the armored private key to the selected location
4. Show a save dialog for the public key:
   - Default filename: `{sanitized_userId}_public.asc`
   - File filter: GPG Public Key (.asc)
5. Write the armored public key to the selected location
6. Display confirmation messages for each saved file

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
  - `isExternal`: Boolean indicating if loaded from external path (optional)
  - `sourcePath`: File path the key was loaded from (for external keys)

#### Composite Key Pattern

To prevent overwriting public/private keys with the same ID:
- Storage keys are composite: `{keyId}_{type}`
- Types are `public` and `private`
- Example: `ABC123_public`, `ABC123_private`

### External Key Loading

The extension supports loading keys from external file/directory paths:

#### Configuration

- **Setting**: `gpg.keyPaths`
- **Type**: Array of strings (file/directory paths)
- **Default**: `[]`

#### Loading Behavior

1. Keys are loaded on extension activation
2. Keys are reloaded when `gpg.keyPaths` configuration changes
3. Loaded keys are kept in a separate cache (`externalKeys` Map)
4. External keys are NOT persisted to VS Code's global state

#### File Discovery

For directories:
- Recursively scans all subdirectories
- Recognizes files with extensions: `.asc`, `.gpg`, `.key`, `.pub`, `.sec`
- Recognizes files starting with `keyring`

For files:
- Reads the entire file content
- Extracts all PGP key blocks (supports multiple keys per file)

#### Key Storage Structure

External keys use the same `StoredKey` interface with additional fields:
- `isExternal`: `true`
- `sourcePath`: The file path the key was loaded from

#### Key Retrieval

All key retrieval methods check both stored and external keys:
- `getKey(keyId, isPrivate)`: Returns from either cache
- `getPublicKey(keyId)`: Returns from either cache
- `getPrivateKey(keyId)`: Returns from either cache
- `listKeys()`: Returns all keys from both caches
- `listStoredKeys()`: Returns only stored keys
- `listExternalKeys()`: Returns only external keys

#### Key Removal

- Stored keys can be removed via the key management UI
- External keys cannot be removed (attempt shows error message directing user to update `gpg.keyPaths`)
- Passphrases are removed when stored keys are deleted

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
8. Prompt user to save the key pair to disk
9. If user confirms, save private key and public key to user-selected locations

### Key Import

When importing a key:
1. Open file picker for key selection
2. Read the key file
3. Parse PGP blocks (support multiple keys per file)
4. For each block:
   - Detect if it's public or private
   - Parse key information
   - Store the key in `cachedKeys` (persisted)
5. For private keys:
   - Check if passphrase is required
   - Prompt for passphrase if required
   - Offer to save passphrase
6. Display success message with summary

### Key Listing

The key management UI displays keys in two sections:

#### Stored in VS Code
- Keys manually imported or generated
- Can be removed via trash icon button
- Shows: user ID, key type (private/public), key ID

#### Loaded from File System
- Keys loaded from `gpg.keyPaths` configuration
- Cannot be removed (read-only)
- Shows: user ID, key type, key ID, source file path

### Configuration Change Handling

When `gpg.keyPaths` configuration changes:
1. Extension receives `onDidChangeConfiguration` event
2. Calls `keyManager.reloadKeysFromPaths()`
3. KeyManager clears and reloads external keys from new paths
4. If key management quick pick is open, it waits for reload to complete then refreshes

#### Race Condition Prevention

- KeyManager tracks the load promise in `loadKeysPromise`
- `awaitKeysLoaded()` method allows waiting for in-progress loads
- Quick pick's config change listener awaits before refreshing UI

### Key Removal

When removing a key:
1. User clicks trash icon on a stored key
2. Check if key is external (if so, show error and abort)
3. Confirm removal
4. Remove key from `cachedKeys`
5. Remove associated passphrase from secrets (if private key)
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
| `gpg.reloadKeys` | Manually reload keys from configured paths |

## Testing Scenarios

### Basic Key Operations
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

### External Key Loading
- Load keys from single file path
- Load keys from directory path
- Load keys from multiple paths
- Load keys from nested directories
- Handle non-existent paths gracefully
- Handle invalid key files gracefully
- Verify external keys are not persisted
- Verify external keys display source path
- Attempt to remove external key (should fail with helpful message)
- Reload keys when configuration changes
- Verify old external keys are cleared when paths are removed
- Handle race condition: config change while quick pick is open
- Verify quick pick refreshes after config change
- Verify stored and external keys are displayed in separate sections

### Configuration Scenarios
- Set workspace-specific key paths
- Set user-level key paths
- Verify workspace paths take precedence
- Change key paths and verify keys reload
- Clear key paths and verify external keys are removed
