const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text with prefix
 */
function encrypt(text) {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  return `encrypted:${encrypted}`;
}

/**
 * Decrypt an encrypted string value
 * @param {string} encryptedText - Encrypted text with prefix
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    throw new Error('Encrypted text cannot be empty');
  }

  // Remove the 'encrypted:' prefix if present
  const text = encryptedText.startsWith('encrypted:')
    ? encryptedText.substring(10)
    : encryptedText;

  try {
    const decrypted = CryptoJS.AES.decrypt(text, ENCRYPTION_KEY);
    const plainText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plainText) {
      throw new Error('Decryption resulted in empty string');
    }

    return plainText;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = {
  encrypt,
  decrypt,
};
