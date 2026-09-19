/**
 * Cryptographic utilities for the Private Vault.
 * Uses the native Web Crypto API.
 */

// Generate a random salt
export function generateSalt(length = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// Derive an AES-GCM CryptoKey from a password string and salt
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable if we need to wrap it later, else false
    ['encrypt', 'decrypt']
  );
}

// Encrypt a JSON object (or string) using AES-GCM
// Returns a base64 encoded string containing the IV and Ciphertext
export async function encryptData(key: CryptoKey, data: any): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  // Combine IV and Ciphertext
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  // Convert to Base64 for storage
  return btoa(String.fromCharCode(...combined));
}

// Decrypt a base64 string back into a JSON object
export async function decryptData(key: CryptoKey, encryptedBase64: string): Promise<any> {
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }

  // Extract IV (first 12 bytes) and Ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  const jsonString = dec.decode(decryptedBuffer);
  return JSON.parse(jsonString);
}

// Export CryptoKey to raw base64 (useful for WebAuthn key wrapping, if implemented)
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import CryptoKey from raw base64
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const keyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
