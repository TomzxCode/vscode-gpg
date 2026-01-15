import * as vscode from 'vscode';
import * as openpgp from 'openpgp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KeyInfo, parseKeyInfo, isPassphraseRequired } from './openpgp';
import { getConfig } from './config';
import { log, logError } from '../util/logger';

const STORED_KEYS_KEY = 'gpg.storedKeys';
const DEFAULT_RECIPIENT_KEY = 'gpg.defaultRecipient';
const PASSPHRASE_SECRET_PREFIX = 'gpg.passphrase.';

interface StoredKey {
  keyId: string;
  userId: string;
  isPrivate: boolean;
  armoredKey: string;
  isExternal?: boolean; // Marks keys loaded from external paths (not persisted)
  sourcePath?: string; // Path to the file the key was loaded from
}

export class KeyManager {
  private context: vscode.ExtensionContext;
  // Use composite key: keyId + type to avoid overwriting public/private with same ID
  private cachedKeys: Map<string, StoredKey> = new Map();
  // Separate cache for external keys (loaded from paths, not persisted)
  private externalKeys: Map<string, StoredKey> = new Map();
  // Track when external keys are being loaded to prevent race conditions
  private loadKeysPromise: Promise<void> | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadKeysFromStorage();
    // Don't await in constructor - store the promise and let it complete asynchronously
    this.loadKeysPromise = this.loadKeysFromPaths();
  }

  /**
   * Generate a composite key for storage
   */
  private storageKey(keyId: string, isPrivate: boolean): string {
    return `${keyId}_${isPrivate ? 'private' : 'public'}`;
  }

  /**
   * Load keys from VS Code's global state
   */
  private loadKeysFromStorage(): void {
    const stored = this.context.globalState.get<StoredKey[]>(STORED_KEYS_KEY, []);
    this.cachedKeys.clear();
    for (const key of stored) {
      const compositeKey = this.storageKey(key.keyId, key.isPrivate);
      this.cachedKeys.set(compositeKey, key);
    }
    log(`Loaded ${this.cachedKeys.size} keys from storage`);
  }

  /**
   * Save keys to VS Code's global state
   */
  private async saveKeysToStorage(): Promise<void> {
    const keys = Array.from(this.cachedKeys.values());
    await this.context.globalState.update(STORED_KEYS_KEY, keys);
    log(`Saved ${keys.length} keys to storage`);
  }

  /**
   * Load keys from configured paths (files or directories)
   * Keys loaded from paths are NOT persisted to storage
   */
  private async loadKeysFromPaths(): Promise<void> {
    const config = getConfig();
    const keyPaths = config.keyPaths;

    if (keyPaths.length === 0) {
      log('No key paths configured');
      return;
    }

    log(`Loading keys from ${keyPaths.length} path(s)`);
    this.externalKeys.clear();

    for (const keyPath of keyPaths) {
      try {
        const stat = await fs.stat(keyPath).catch(() => null);
        if (!stat) {
          log(`Path does not exist: ${keyPath}`);
          continue;
        }

        if (stat.isFile()) {
          await this.loadKeysFromFile(keyPath);
        } else if (stat.isDirectory()) {
          await this.loadKeysFromDirectory(keyPath);
        }
      } catch (error) {
        logError(`Failed to load keys from path: ${keyPath}`, error);
      }
    }

    log(`Loaded ${this.externalKeys.size} external key(s) from paths`);
  }

  /**
   * Load keys from a single file
   */
  private async loadKeysFromFile(filePath: string): Promise<void> {
    log(`Loading keys from file: ${filePath}`);
    try {
      const keyData = await fs.readFile(filePath, 'utf-8');
      const keyBlocks = this.extractKeyBlocks(keyData);

      for (const block of keyBlocks) {
        const isPrivate = block.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
        try {
          const keyInfo = await parseKeyInfo(block.trim(), isPrivate);
          const compositeKey = this.storageKey(keyInfo.keyId, keyInfo.isPrivate);

          this.externalKeys.set(compositeKey, {
            keyId: keyInfo.keyId,
            userId: keyInfo.userId,
            isPrivate: keyInfo.isPrivate,
            armoredKey: block.trim(),
            isExternal: true,
            sourcePath: filePath,
          });

          log(`Loaded external key: ${keyInfo.keyId} (${keyInfo.userId}) from ${filePath}`);
        } catch (blockError) {
          logError(`Failed to parse key block from ${filePath}`, blockError);
        }
      }
    } catch (error) {
      logError(`Failed to read key file: ${filePath}`, error);
    }
  }

  /**
   * Load keys from a directory (recursively finds key files)
   */
  private async loadKeysFromDirectory(dirPath: string): Promise<void> {
    log(`Loading keys from directory: ${dirPath}`);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively load from subdirectories
          await this.loadKeysFromDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check if file has a key-related extension
          const ext = path.extname(entry.name).toLowerCase();
          const keyExtensions = ['.asc', '.gpg', '.key', '.pub', '.sec'];

          if (keyExtensions.includes(ext) || entry.name.startsWith('keyring')) {
            await this.loadKeysFromFile(fullPath);
          }
        }
      }
    } catch (error) {
      logError(`Failed to read directory: ${dirPath}`, error);
    }
  }

  /**
   * Extract PGP key blocks from a string
   */
  private extractKeyBlocks(keyData: string): string[] {
    const keyBlocks: string[] = [];
    const lines = keyData.split('\n');
    let currentBlock: string[] = [];
    let inBlock = false;

    for (const line of lines) {
      if (line.includes('-----BEGIN PGP')) {
        inBlock = true;
        currentBlock = [line];
      } else if (line.includes('-----END PGP')) {
        currentBlock.push(line);
        keyBlocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inBlock = false;
      } else if (inBlock) {
        currentBlock.push(line);
      }
    }

    return keyBlocks;
  }

  /**
   * Reload keys from configured paths
   * Returns a promise that resolves when loading is complete
   */
  async reloadKeysFromPaths(): Promise<void> {
    log('Reloading keys from configured paths');
    // Store the promise so callers can await it
    this.loadKeysPromise = this.loadKeysFromPaths();
    await this.loadKeysPromise;
  }

  /**
   * Wait for any in-progress key loading to complete
   */
  async awaitKeysLoaded(): Promise<void> {
    if (this.loadKeysPromise) {
      await this.loadKeysPromise;
    }
  }

  /**
   * Import a key from armored string
   */
  async importKey(armoredKey: string, isPrivate: boolean): Promise<KeyInfo> {
    log(`Importing ${isPrivate ? 'private' : 'public'} key`);

    try {
      const keyInfo = await parseKeyInfo(armoredKey, isPrivate);
      const compositeKey = this.storageKey(keyInfo.keyId, keyInfo.isPrivate);

      // Check if key already exists
      if (this.cachedKeys.has(compositeKey)) {
        log(`Key ${keyInfo.keyId} (${keyInfo.isPrivate ? 'private' : 'public'}) already exists, updating`);
      } else {
        log(`Importing new key: ${keyInfo.keyId} (${keyInfo.isPrivate ? 'private' : 'public'})`);
      }

      // Store the key
      this.cachedKeys.set(compositeKey, {
        keyId: keyInfo.keyId,
        userId: keyInfo.userId,
        isPrivate: keyInfo.isPrivate,
        armoredKey,
      });

      await this.saveKeysToStorage();
      return keyInfo;
    } catch (error) {
      logError('Failed to import key', error);
      throw error;
    }
  }

  /**
   * List all stored keys (including external keys)
   */
  async listKeys(): Promise<KeyInfo[]> {
    const allKeys = new Map([...this.cachedKeys, ...this.externalKeys]);
    const keys = Array.from(allKeys.values()).map(k => ({
      keyId: k.keyId,
      userId: k.userId,
      isPrivate: k.isPrivate,
    }));
    log(`Listing ${keys.length} keys`);
    return keys;
  }

  /**
   * List only keys stored in VS Code (not external)
   */
  async listStoredKeys(): Promise<StoredKey[]> {
    return Array.from(this.cachedKeys.values());
  }

  /**
   * List only external keys loaded from paths
   */
  async listExternalKeys(): Promise<StoredKey[]> {
    return Array.from(this.externalKeys.values());
  }

  /**
   * List only public keys (available for encryption)
   */
  async listPublicKeys(): Promise<KeyInfo[]> {
    const allKeys = new Map([...this.cachedKeys, ...this.externalKeys]);
    const keys = Array.from(allKeys.values())
      .filter(k => !k.isPrivate)
      .map(k => ({
        keyId: k.keyId,
        userId: k.userId,
        isPrivate: false,
      }));
    return keys;
  }

  /**
   * List only private keys (available for decryption)
   */
  async listPrivateKeys(): Promise<KeyInfo[]> {
    const allKeys = new Map([...this.cachedKeys, ...this.externalKeys]);
    const keys = Array.from(allKeys.values())
      .filter(k => k.isPrivate)
      .map(k => ({
        keyId: k.keyId,
        userId: k.userId,
        isPrivate: true,
      }));
    return keys;
  }

  /**
   * Get a key by ID and type (checks both stored and external keys)
   */
  getKey(keyId: string, isPrivate: boolean): StoredKey | undefined {
    const compositeKey = this.storageKey(keyId, isPrivate);
    return this.cachedKeys.get(compositeKey) || this.externalKeys.get(compositeKey);
  }

  /**
   * Get public key by ID (checks both stored and external keys)
   */
  getPublicKey(keyId: string): string | undefined {
    const compositeKey = this.storageKey(keyId, false);
    const stored = this.cachedKeys.get(compositeKey) || this.externalKeys.get(compositeKey);
    if (stored && !stored.isPrivate) {
      return stored.armoredKey;
    }
    return undefined;
  }

  /**
   * Get private key by ID (checks both stored and external keys)
   */
  getPrivateKey(keyId: string): string | undefined {
    const compositeKey = this.storageKey(keyId, true);
    const stored = this.cachedKeys.get(compositeKey) || this.externalKeys.get(compositeKey);
    if (stored && stored.isPrivate) {
      return stored.armoredKey;
    }
    return undefined;
  }

  /**
   * Remove a key by ID and type (only removes stored keys, not external ones)
   */
  async removeKey(keyId: string, isPrivate: boolean): Promise<boolean> {
    const compositeKey = this.storageKey(keyId, isPrivate);

    // Check if this is an external key
    const externalKey = this.externalKeys.get(compositeKey);
    if (externalKey) {
      log(`Cannot remove external key: ${compositeKey} (loaded from path)`);
      throw new Error('Cannot remove keys loaded from external paths. Update your gpg.keyPaths configuration instead.');
    }

    log(`Removing key: ${compositeKey}`);

    const removed = this.cachedKeys.delete(compositeKey);
    if (removed) {
      await this.saveKeysToStorage();
      // Also remove passphrase if stored
      await this.storePassphrase(keyId, undefined);
    }

    return removed;
  }

  /**
   * Set the default recipient for encryption
   */
  async setDefaultRecipient(keyId: string): Promise<void> {
    log(`Setting default recipient: ${keyId}`);
    await this.context.globalState.update(DEFAULT_RECIPIENT_KEY, keyId);
  }

  /**
   * Get the default recipient for encryption
   */
  async getDefaultRecipient(): Promise<string | undefined> {
    return this.context.globalState.get<string>(DEFAULT_RECIPIENT_KEY);
  }

  /**
   * Store a passphrase securely
   */
  async storePassphrase(keyId: string, passphrase: string | undefined): Promise<void> {
    const secretKey = `${PASSPHRASE_SECRET_PREFIX}${keyId}`;
    if (passphrase) {
      await this.context.secrets.store(secretKey, passphrase);
      log(`Stored passphrase for key: ${keyId}`);
    } else {
      await this.context.secrets.delete(secretKey);
      log(`Removed passphrase for key: ${keyId}`);
    }
  }

  /**
   * Get a stored passphrase
   */
  async getPassphrase(keyId: string): Promise<string | undefined> {
    const secretKey = `${PASSPHRASE_SECRET_PREFIX}${keyId}`;
    return this.context.secrets.get(secretKey);
  }

  /**
   * Check if a private key requires a passphrase and if it's stored
   */
  async getKeyPassphraseStatus(keyId: string): Promise<{
    required: boolean;
    stored: boolean;
  }> {
    const armoredKey = this.getPrivateKey(keyId);
    if (!armoredKey) {
      return { required: false, stored: false };
    }

    const required = await isPassphraseRequired(armoredKey);
    const stored = required ? !!(await this.getPassphrase(keyId)) : false;

    return { required, stored };
  }

  /**
   * Get the first available private key (for decryption attempts)
   */
  async getFirstPrivateKey(): Promise<{ keyId: string; armoredKey: string } | undefined> {
    const privateKeys = await this.listPrivateKeys();
    if (privateKeys.length === 0) {
      return undefined;
    }

    const keyId = privateKeys[0].keyId;
    const armoredKey = this.getPrivateKey(keyId);
    if (armoredKey) {
      return { keyId, armoredKey };
    }

    return undefined;
  }

  /**
   * Clear all stored data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    this.cachedKeys.clear();
    await this.context.globalState.update(STORED_KEYS_KEY, []);
    await this.context.globalState.update(DEFAULT_RECIPIENT_KEY, undefined);

    // Clear all passphrases
    for (const keyId of this.cachedKeys.keys()) {
      await this.storePassphrase(keyId, undefined);
    }

    log('Cleared all stored keys and data');
  }
}
