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

## Example Configuration

Here's a complete example configuration:

```json
{
  "gpg.defaultRecipient": "ABC12345DEF67890",
  "gpg.fileExtensions": [".gpg", ".asc"],
  "gpg.askForPassphrase": true,
  "gpg.autoDecrypt": true
}
```

## Workspace-Specific Settings

You can configure different settings for different workspaces by creating a `.vscode/settings.json` file in your project root:

```json
{
  "gpg.defaultRecipient": "XYZ98765ABC43210",
  "gpg.fileExtensions": [".secret"]
}
```

This is useful when different projects use different encryption keys.
