# Installation

## Installing from VS Code Marketplace

The easiest way to install VS Code GPG is through the VS Code Marketplace.

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "VS Code GPG"
4. Click Install

## Installing from a .vsix File

You can also install the extension from a pre-built `.vsix` file.

1. Download the latest `.vsix` file from the [Releases](https://github.com/tomzxcode/vscode-gpg/releases) page
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X)
4. Click the "..." menu in the Extensions view
5. Select "Install from VSIX..."
6. Navigate to and select the downloaded `.vsix` file

## Building from Source

To build the extension from source:

### Prerequisites

- [Node.js](https://nodejs.org/) (18.x or later)
- [Bun](https://bun.sh/) (recommended) or npm

### Build Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/tomzxcode/vscode-gpg.git
   cd vscode-gpg
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the extension:
   ```bash
   bun run compile
   ```

4. Package the extension:
   ```bash
   bun run package
   ```

5. Install the generated `.vsix` file following the steps above

## Post-Installation

After installing, you'll need to set up GPG keys before you can encrypt or decrypt files. See the [Usage](usage.md) section for details.

## Updating

The extension will update automatically through VS Code's standard update mechanism. To check for updates manually:

1. Go to Extensions (Ctrl+Shift+X)
2. Find "VS Code GPG"
3. Click the Update button if available
