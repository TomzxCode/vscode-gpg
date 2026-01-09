import * as vscode from 'vscode';
import * as openpgp from 'openpgp';
import { KeyInfo, parseKeyInfo, isPassphraseRequired } from './openpgp';
import { log, logError } from '../util/logger';

const STORED_KEYS_KEY = 'gpg.storedKeys';
const DEFAULT_RECIPIENT_KEY = 'gpg.defaultRecipient';
const PASSPHRASE_SECRET_PREFIX = 'gpg.passphrase.';

interface StoredKey {
  keyId: string;
  userId: string;
  isPrivate: boolean;
  armoredKey: string;
}

export class KeyManager {
  private context: vscode.ExtensionContext;
  // Use composite key: keyId + type to avoid overwriting public/private with same ID
  private cachedKeys: Map<string, StoredKey> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadKeysFromStorage();
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
   * List all stored keys
   */
  async listKeys(): Promise<KeyInfo[]> {
    const keys = Array.from(this.cachedKeys.values()).map(k => ({
      keyId: k.keyId,
      userId: k.userId,
      isPrivate: k.isPrivate,
    }));
    log(`Listing ${keys.length} keys`);
    return keys;
  }

  /**
   * List only public keys (available for encryption)
   */
  async listPublicKeys(): Promise<KeyInfo[]> {
    const keys = Array.from(this.cachedKeys.values())
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
    const keys = Array.from(this.cachedKeys.values())
      .filter(k => k.isPrivate)
      .map(k => ({
        keyId: k.keyId,
        userId: k.userId,
        isPrivate: true,
      }));
    return keys;
  }

  /**
   * Get a key by ID and type
   */
  getKey(keyId: string, isPrivate: boolean): StoredKey | undefined {
    return this.cachedKeys.get(this.storageKey(keyId, isPrivate));
  }

  /**
   * Get public key by ID
   */
  getPublicKey(keyId: string): string | undefined {
    const stored = this.cachedKeys.get(this.storageKey(keyId, false));
    if (stored && !stored.isPrivate) {
      return stored.armoredKey;
    }
    return undefined;
  }

  /**
   * Get private key by ID
   */
  getPrivateKey(keyId: string): string | undefined {
    const stored = this.cachedKeys.get(this.storageKey(keyId, true));
    if (stored && stored.isPrivate) {
      return stored.armoredKey;
    }
    return undefined;
  }

  /**
   * Remove a key by ID and type
   */
  async removeKey(keyId: string, isPrivate: boolean): Promise<boolean> {
    const compositeKey = this.storageKey(keyId, isPrivate);
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
