import { db } from './db';

/**
 * Create a WhatsApp auth state using Supabase/SQLite instead of filesystem
 * Returns the same interface as useMultiFileAuthState from Baileys
 */
export const useSupabaseAuthState = async (sessionId: string = 'default') => {
  const baileys = await import('@whiskeysockets/baileys');
  const initAuthCreds = () => {
    if (typeof baileys.initAuthCreds === 'function') {
      return baileys.initAuthCreds();
    }

    return {
      noiseKey: {
        private: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        public: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      },
      signedIdentityKey: {
        private: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        public: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      },
      signedPreKey: {
        keyId: 1,
        keyPair: {
          private: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
          public: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        },
        signature: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        timestamp: Date.now()
      },
      me: {
        id: 'placeholder@s.whatsapp.net',
        name: undefined,
        jid: { server: 's.whatsapp.net', user: 'placeholder' }
      },
      firstUnuploadedPreKeyId: 1,
      nextPreKeyId: 2,
      firstUnuploadedSignedPreKeyId: 1,
      nextSignedPreKeyId: 2,
      lastResyncedRoundedReceiptRequirementTimeout: 0,
      photoId: undefined,
      lastPhotoUpdate: undefined,
      platform: 'web',
      lastAccountSyncTimestamp: Date.now(),
      myAID: 1,
      mySigningKey: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      mySignedPreKey: {
        keyId: 1,
        keyPair: {
          private: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
          public: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        },
        signature: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        timestamp: Date.now()
      },
      accountSettings: undefined,
      accountSyncCounter: 0,
      deviceId: Buffer.from([0, 0, 0, 0]).toString('base64').substring(0, 12),
      phoneId: undefined,
      identityId: Buffer.from([0, 0, 0, 0]),
      registered: false,
      backupToken: Buffer.alloc(0),
      serverHasPreKeys: true,
      key: 'creds'
    };
  };

  try {
    // Load existing session from DB
    const session = await db.getWhatsappSession(sessionId);
    const creds = session?.creds || initAuthCreds();
    const keysData = session?.keys || {};

    // Create the state object required by Baileys
    const state = {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          const cached = keysData[type] || {};
          for (const id of ids) {
            if (cached[id]) {
              data[id] = cached[id];
            }
          }
          return data;
        },
        set: async (data: any) => {
          // Merge new keys with existing ones
          for (const type in data) {
            if (!keysData[type]) {
              keysData[type] = {};
            }
            for (const id in data[type]) {
              keysData[type][id] = data[type][id];
            }
          }
          // Persist to DB (keys only, not full state)
          await db.saveWhatsappSession(sessionId, undefined, keysData);
        }
      }
    };

    // Callback to save credentials
    const saveCreds = async () => {
      await db.saveWhatsappSession(sessionId, creds, keysData);
    };

    return { state, saveCreds };
  } catch (error) {
    console.error('Error loading WhatsApp session from DB:', error);
    // Fallback to fresh credentials
    const creds = initAuthCreds();
    const keysData: any = {};

    const state = {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          const cached = keysData[type] || {};
          for (const id of ids) {
            if (cached[id]) {
              data[id] = cached[id];
            }
          }
          return data;
        },
        set: async (data: any) => {
          for (const type in data) {
            if (!keysData[type]) {
              keysData[type] = {};
            }
            for (const id in data[type]) {
              keysData[type][id] = data[type][id];
            }
          }
          await db.saveWhatsappSession(sessionId, undefined, keysData);
        }
      }
    };

    const saveCreds = async () => {
      await db.saveWhatsappSession(sessionId, creds, keysData);
    };

    return { state, saveCreds };
  }
};
