const CryptoJS = require('crypto-js');

// Generate a random 256-bit (32-byte) key
const generateKey = () => {
    const randomWords = CryptoJS.lib.WordArray.random(32);
    return randomWords.toString(CryptoJS.enc.Base64);
};

const key = generateKey();
console.log('Generated Encryption Key:', key);
console.log('\nAdd this to your .env file as:');
console.log(`VITE_ENCRYPTION_KEY=${key}`);