# Configuration

The extension can be configured through VS Code's settings. You can access these settings by:

1. Going to Settings (Ctrl+,)
2. Searching for "GPG"
3. Or editing `settings.json` directly

## Settings

### `gpg.defaultRecipient`

- **Type**: `string`
- **Default**: `""`
- **Description**: The default recipient key ID for encryption

When you encrypt files, this key ID will be used by default. You can set this through the `GPG: Set Default Recipient` command or by editing the setting directly.

Example:
```json
{
  "gpg.defaultRecipient": "ABC12345DEF67890"
}
```

### `gpg.fileExtensions`

- **Type**: `array`
- **Default**: `[".gpg", ".asc"]`
- **Description**: File extensions to treat as encrypted

These file extensions will trigger automatic decryption when opened. You can add or remove extensions as needed.

Example:
```json
{
  "gpg.fileExtensions": [".gpg", ".asc", ".pgp"]
}
```

### `gpg.askForPassphrase`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Ask for passphrase if not stored

When enabled, the extension will prompt you for your passphrase if it's not already stored. When disabled, decryption will fail silently if the passphrase isn't stored.

Example:
```json
{
  "gpg.askForPassphrase": true
}
```

### `gpg.autoDecrypt`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically decrypt `.gpg`/`.asc` files when opened

When enabled, files with configured extensions will be automatically decrypted when opened. When disabled, you'll need to manually use the `GPG: Open Encrypted File` command.

Example:
```json
{
  "gpg.autoDecrypt": true
}
```

### `gpg.keyPaths`

- **Type**: `array`
- **Default**: `[]`
- **Description**: List of file or directory paths to load GPG keys from

This setting allows you to load GPG keys from external locations without importing them into the extension's storage. Keys loaded from these paths are:

- **Read-only**: They cannot be removed through the key management UI
- **Not persisted**: They are not stored in VS Code's global state
- **Auto-reloaded**: Keys are reloaded when this setting changes
- **Source tracked**: The source file path is displayed in the key management UI

Supported file extensions: `.asc`, `.gpg`, `.key`, `.pub`, `.sec`, and files starting with `keyring`.

Example:
```json
{
  "gpg.keyPaths": [
    "/home/user/.gnupg/pubring.kbx",
    "/home/user/keys/project-keys.asc",
    "/mnt/shared/keys/"
  ]
}
```

#### Use Cases

1. **Shared Keys**: Load keys from a shared network location or mounted drive
2. **System GPG**: Use keys from your system's GPG keyring
3. **Project-Specific Keys**: Define workspace-specific key paths in `.vscode/settings.json`
4. **Backup Keys**: Keep keys on external storage and load them when needed

#### Workspace Configuration

You can set different key paths for different workspaces:

```json
{
  "gpg.keyPaths": [
    "/home/user/keys/project-a/",
    "/home/user/keys/project-a-public.asc"
  ]
}
```

## Example Configuration

Here's a complete example configuration:

```json
{
  "gpg.defaultRecipient": "ABC12345DEF67890",
  "gpg.fileExtensions": [".gpg", ".asc"],
  "gpg.askForPassphrase": true,
  "gpg.autoDecrypt": true,
  "gpg.keyPaths": [
    "/home/user/.gnupg/pubring.kbx",
    "/home/user/backup-keys/"
  ]
}
```

## Workspace-Specific Settings

You can configure different settings for different workspaces by creating a `.vscode/settings.json` file in your project root:

```json
{
  "gpg.defaultRecipient": "XYZ98765ABC43210",
  "gpg.fileExtensions": [".secret"],
  "gpg.keyPaths": ["/home/user/keys/project-a/"]
}
```

This is useful when different projects use different encryption keys.
