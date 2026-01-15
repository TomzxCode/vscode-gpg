import * as vscode from 'vscode';

export interface GpgConfig {
  defaultRecipient: string;
  fileExtensions: string[];
  askForPassphrase: boolean;
  keyPaths: string[];
}

export function getConfig(): GpgConfig {
  const config = vscode.workspace.getConfiguration('gpg');
  return {
    defaultRecipient: config.get<string>('defaultRecipient', ''),
    fileExtensions: config.get<string[]>('fileExtensions', ['.gpg', '.asc']),
    askForPassphrase: config.get<boolean>('askForPassphrase', true),
    keyPaths: config.get<string[]>('keyPaths', []),
  };
}

export function isEncryptedFile(path: string): boolean {
  const config = getConfig();
  return config.fileExtensions.some(ext => path.endsWith(ext));
}

export function getFilePathFromUri(uri: vscode.Uri): string {
  // Handle different URI schemes
  if (uri.scheme === 'gpgfs' || uri.scheme === 'file') {
    // gpgfs:///path/to/file.gpg -> /path/to/file.gpg
    return uri.fsPath;
  }
  return uri.path;
}
