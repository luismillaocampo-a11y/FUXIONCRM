const baileys = require('@whiskeysockets/baileys');
console.log(Object.keys(baileys).sort().filter(k => /auth|Auth|init|use|make|cred/i.test(k)).join('\n'));
console.log('initAuthCreds type:', typeof baileys.initAuthCreds);
console.log('makeCacheableSignalKeyStore type:', typeof baileys.makeCacheableSignalKeyStore);
console.log('protoType of makeWASocket:', typeof baileys.makeWASocket);
