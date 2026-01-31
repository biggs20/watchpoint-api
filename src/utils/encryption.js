/**
 * Encryption Utility
 * Handles encryption/decryption of sensitive data
 */

const crypto = require('crypto');

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * TODO: Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string (iv:authTag:ciphertext)
 */
const encrypt = (text) => {
  // TODO: Generate random IV
  // TODO: Create cipher with ENCRYPTION_KEY
  // TODO: Encrypt text
  // TODO: Get auth tag
  // TODO: Return combined string
  throw new Error('Not implemented');
};

/**
 * TODO: Decrypt encrypted data
 * @param {string} encryptedText - Encrypted string to decrypt
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedText) => {
  // TODO: Parse iv, authTag, ciphertext from input
  // TODO: Create decipher
  // TODO: Set auth tag
  // TODO: Decrypt and return
  throw new Error('Not implemented');
};

/**
 * TODO: Generate a secure random string
 * @param {number} length - Length of string to generate
 * @returns {string} - Random hex string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * TODO: Hash a string (one-way)
 * @param {string} text
 * @returns {string} - SHA-256 hash
 */
const hash = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};

module.exports = {
  encrypt,
  decrypt,
  generateRandomString,
  hash,
};
