import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function initializeLogger(): void {
  outputChannel = vscode.window.createOutputChannel('GPG');
}

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    if (error instanceof Error) {
      outputChannel.appendLine(`  ${error.message}`);
      if (error.stack) {
        outputChannel.appendLine(`  ${error.stack}`);
      }
    } else {
      outputChannel.appendLine(`  ${String(error)}`);
    }
  }
}

export function showOutputChannel(): void {
  outputChannel.show();
}

export function disposeLogger(): void {
  outputChannel.dispose();
}
