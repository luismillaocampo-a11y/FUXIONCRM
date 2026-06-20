const baileys = require('@whiskeysockets/baileys');
const keys = Object.keys(baileys).filter((k) => k.includes('Auth') || k.includes('use'));
console.log('useMultiFileAuthState=', typeof baileys.useMultiFileAuthState);
console.log('useSingleFileAuthState=', typeof baileys.useSingleFileAuthState);
console.log('keys=', keys.join(','));
console.log('export count=', Object.keys(baileys).length);
