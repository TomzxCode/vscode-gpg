import * as openpgp from 'openpgp';
import { log, logError } from '../util/logger';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  keyId: string;
}

export interface KeyInfo {
  keyId: string;
  userId: string;
  isPrivate: boolean;
}

/**
 * Encrypt content for a recipient
 * @param content - Plain text content to encrypt
 * @param publicKeyArmored - Recipient's public key in armored format
 * @returns Encrypted data as Uint8Array
 */
export async function encrypt(content: string, publicKeyArmored: string): Promise<Uint8Array> {
  log(`Encrypting content (${content.length} bytes)`);

  try {
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: content }),
      encryptionKeys: publicKey,
    }) as string;

    log('Encryption successful');
    return new TextEncoder().encode(encrypted);
  } catch (error) {
    logError('Encryption failed', error);
    throw error;
  }
}

/**
 * Decrypt content using a private key
 * @param encryptedData - Encrypted data as Uint8Array
 * @param privateKeyArmored - Private key in armored format
 * @param passphrase - Passphrase for the private key (if any)
 * @returns Decrypted plain text
 */
export async function decrypt(
  encryptedData: Uint8Array,
  privateKeyArmored: string,
  passphrase?: string
): Promise<string> {
  log(`Decrypting content (${encryptedData.length} bytes)`);

  let encryptedForKeyIds = 'unknown';
  let encryptedMessage: openpgp.Message<string | Uint8Array>;

  // First, read the encrypted message to get target key IDs
  try {
    const isArmored = isAsciiArmored(encryptedData);
    if (isArmored) {
      encryptedMessage = await openpgp.readMessage({
        armoredMessage: new TextDecoder().decode(encryptedData),
      });
    } else {
      encryptedMessage = await openpgp.readMessage({
        binaryMessage: encryptedData,
      });
    }

    const encryptionKeyIds = encryptedMessage.getEncryptionKeyIDs();
    encryptedForKeyIds = encryptionKeyIds.map((kid: any) => kid.toHex()).join(', ');
    log(`Message encrypted for key IDs: ${encryptedForKeyIds}`);
  } catch (error) {
    logError('Failed to read encrypted message', error);
    throw error;
  }

  // Read the private key
  let privateKey: openpgp.PrivateKey;
  try {
    privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  } catch (error) {
    logError('Failed to read private key', error);
    throw new Error('Failed to read private key');
  }

  const primaryKeyId = privateKey.getKeyID().toHex();

  // Debug: List all subkeys with their properties
  log(`Primary key: ${primaryKeyId}`);
  log(`Number of subkeys: ${privateKey.subkeys?.length || 0}`);

  let hasEncryptionSubkey = false;
  for (const subkey of privateKey.subkeys || []) {
    const subkeyId = subkey.getKeyID().toHex();
    const isDecrypted = await (subkey as any).isDecrypted();
    log(`  Subkey: ${subkeyId}, isDecrypted: ${isDecrypted}, has secret material: ${subkey !== undefined}`);

    if (encryptedForKeyIds.includes(subkeyId)) {
      hasEncryptionSubkey = true;
      log(`Found matching subkey: ${subkeyId}`);
    }
  }

  if (!hasEncryptionSubkey) {
    log(`Key ${primaryKeyId} does not contain a subkey matching ${encryptedForKeyIds}`);
  }

  // Decrypt private key with passphrase if provided
  let decryptedPrivateKey = privateKey;
  if (passphrase) {
    try {
      decryptedPrivateKey = await openpgp.decryptKey({
        privateKey,
        passphrase,
      });
      log('Private key decrypted successfully');
    } catch (error) {
      logError('Failed to decrypt private key (wrong passphrase?)', error);
      throw new Error('Invalid passphrase for private key');
    }
  }

  // Try decrypting with the private key (openpgp.js should automatically find the matching subkey)
  try {
    log(`Attempting decryption with key: ${primaryKeyId}`);

    const { data: decrypted } = await openpgp.decrypt({
      message: encryptedMessage,
      decryptionKeys: decryptedPrivateKey,
    });

    log(`Decryption successful with key: ${primaryKeyId}`);
    return decrypted as string;
  } catch (error) {
    logError('Decryption failed', error);
    throw new Error(`Decryption failed. This may be an openpgp.js compatibility issue with cv25519/ed25519 keys. Try using GPG CLI to decrypt: gpg --decrypt file.gpg`);
  }
}

/**
 * Generate a new key pair
 * @param userId - User ID (e.g., "User Name <email@example.com>")
 * @param passphrase - Passphrase to protect the private key
 * @returns Generated key pair
 */
export async function generateKeyPair(
  userId: string,
  passphrase: string
): Promise<KeyPair> {
  log(`Generating key pair for ${userId}`);

  try {
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'ecc', // Elliptic Curve Cryptography
      curve: 'curve25519',
      userIDs: [{ name: userId }],
      passphrase,
    } as any); // Use 'as any' to bypass type checking for curve option

    // Get key ID from the public key
    const key = await openpgp.readKey({ armoredKey: publicKey });
    const keyId = await getKeyId(key);

    log(`Key pair generated: ${keyId}`);
    return {
      privateKey,
      publicKey,
      keyId,
    };
  } catch (error) {
    logError('Key generation failed', error);
    throw error;
  }
}

/**
 * Extract key ID from a key
 * @param key - OpenPGP key
 * @returns Key ID as hex string
 */
async function getKeyId(key: openpgp.Key): Promise<string> {
  const keyData = await key.getPrimaryUser();
  // Use the key fingerprint or ID
  return keyData.user.userID?.userID || key.getKeyID().toHex();
}

/**
 * Parse key information from an armored key
 * @param armoredKey - Armored key string
 * @param isPrivate - Whether this is a private key (will auto-detect if fails)
 * @returns Key information
 */
export async function parseKeyInfo(armoredKey: string, isPrivate: boolean): Promise<KeyInfo> {
  let key: openpgp.Key | openpgp.PrivateKey;
  let actualIsPrivate = isPrivate;

  try {
    if (isPrivate) {
      key = await openpgp.readPrivateKey({ armoredKey });
    } else {
      key = await openpgp.readKey({ armoredKey });
    }
  } catch (error) {
    // If the specified type failed, try the other type
    log(`Failed to read as ${isPrivate ? 'private' : 'public'} key, trying the other type`);
    try {
      if (isPrivate) {
        key = await openpgp.readKey({ armoredKey });
        actualIsPrivate = false;
      } else {
        key = await openpgp.readPrivateKey({ armoredKey });
        actualIsPrivate = true;
      }
    } catch (retryError) {
      logError('Failed to parse key info', retryError);
      throw new Error('Invalid key format');
    }
  }

  const users: string[] = [];
  const userIds = key.getUserIDs();
  for (const userId of userIds) {
    if (userId) {
      users.push(userId);
    }
  }

  const userId = users[0] || 'Unknown';
  const keyId = key.getKeyID().toHex();

  // Log all subkeys for debugging
  const subkeys: any[] = [];
  for (const subkey of key.subkeys || []) {
    subkeys.push(subkey.getKeyID().toHex());
  }
  if (subkeys.length > 0) {
    log(`Key ${keyId} has ${subkeys.length} subkey(s): ${subkeys.join(', ')}`);
  } else {
    log(`Key ${keyId} has no subkeys`);
  }

  return {
    keyId,
    userId,
    isPrivate: actualIsPrivate,
  };
}

/**
 * Read a key from armored string
 * @param armoredKey - Armored key string
 * @param isPrivate - Whether this is a private key
 * @returns OpenPGP key object
 */
export async function readKey(armoredKey: string, isPrivate: boolean) {
  if (isPrivate) {
    return openpgp.readPrivateKey({ armoredKey });
  }
  return openpgp.readKey({ armoredKey });
}

/**
 * Check if a private key requires a passphrase
 * @param armoredKey - Armored private key
 * @returns True if passphrase is required
 */
export async function isPassphraseRequired(armoredKey: string): Promise<boolean> {
  try {
    const key = await openpgp.readPrivateKey({ armoredKey });
    // In openpgp v6, isDecrypted() returns true if the key is NOT encrypted
    return !(await key.isDecrypted());
  } catch {
    return false;
  }
}

/**
 * Convert binary encrypted data to ASCII armored format
 * @param binaryData - Binary encrypted data
 * @returns ASCII armored string
 */
export function binaryToArmor(binaryData: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(binaryData);
}

/**
 * Convert ASCII armored format to binary data
 * @param armor - ASCII armored string
 * @returns Binary data
 */
export function armorToBinary(armor: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(armor);
}

/**
 * Detect if data is ASCII armored
 * @param data - Data to check
 * @returns True if data appears to be ASCII armored
 */
export function isAsciiArmored(data: Uint8Array): boolean {
  const decoder = new TextDecoder();
  const text = decoder.decode(data.slice(0, 50));
  return text.includes('-----BEGIN PGP');
}
