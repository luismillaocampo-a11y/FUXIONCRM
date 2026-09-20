import QRCode from 'qrcode';
import { db, getAppDataStorageDir } from './db';
import { queryKnowledgeBase, logRecommendedProduct, snapshotOrderForLead, sanitizeAiReply, stripInternalTagsForSending } from './gemini';
import { sendEmailNotification } from './notifications';
import { getAiGloballyEnabled } from './ai-settings';

const DEFAULT_QR_TIMEOUT_MS = Number(process.env.WHATSAPP_QR_TIMEOUT_MS || '30000');

type QrWaiter = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class PersistentFlowStateMap extends Map<string, string> {
  set(key: string, value: string): this {
    super.set(key, value);
    db.setLeadFlowState(key, value).catch(err => console.error('[FlowStateMap] Error setting DB flow state:', err));
    return this;
  }
  delete(key: string): boolean {
    const res = super.delete(key);
    db.setLeadFlowState(key, null).catch(err => console.error('[FlowStateMap] Error deleting DB flow state:', err));
    return res;
  }
  loadStates(states: any) {
    if (!states || typeof states !== 'object') return;
    if (Array.isArray(states)) {
      for (const s of states) {
        if (s?.lead_id && s?.node_id) super.set(s.lead_id, s.node_id);
      }
    } else {
      for (const [key, value] of Object.entries(states)) {
        if (key && typeof value === 'string') super.set(key, value);
      }
    }
  }
}

/**
 * Adaptador de estado de autenticación de Baileys persistido en Base de Datos (Supabase PostgreSQL / SQLite).
 * Mantiene la sesión de WhatsApp 24/7 en contenedores (Google Cloud Run / Docker) sin depender
 * de sistemas de archivos efímeros que se pierden con cada reinicio o despliegue.
 */
async function useDatabaseAuthState(baileys: any, sessionId: string = 'default') {
  const initAuthCreds = baileys.initAuthCreds || baileys.default?.initAuthCreds;
  const proto = baileys.proto || baileys.default?.proto;

  // 1. Recuperar sesión almacenada en Supabase o SQLite
  let sessionRow: any = null;
  try {
    sessionRow = await db.getWhatsappSession(sessionId);
  } catch (err) {
    console.warn('[WhatsAppService] Error consultando sesión previa en BD:', err);
  }

  // 2. Determinar credenciales iniciales
  let creds: any = null;
  if (sessionRow?.creds && typeof sessionRow.creds === 'object' && Object.keys(sessionRow.creds).length > 0) {
    creds = sessionRow.creds;
  } else {
    // Si no hay sesión en BD, revisar si existen credenciales locales previas para migración transparente
    try {
      const pathMod = await import('path');
      const fsMod = await import('fs');
      const legacyCredsFile = pathMod.join(getAppDataStorageDir(), 'baileys_auth_info', 'creds.json');
      if (fsMod.existsSync(legacyCredsFile)) {
        const legacyRaw = fsMod.readFileSync(legacyCredsFile, 'utf-8');
        const parsed = JSON.parse(legacyRaw);
        if (parsed?.me?.id) {
          console.log('[WhatsAppService] 🚚 Migrando credenciales locales existentes a la Base de Datos...');
          creds = parsed;
          await db.saveWhatsappSession(sessionId, creds, {});
        }
      }
    } catch (migErr) {
      console.warn('[WhatsAppService] Error en migración local:', migErr);
    }
  }

  if (!creds || !creds.noiseKey) {
    creds = typeof initAuthCreds === 'function' ? initAuthCreds() : {};
  }

  // 3. Almacén de llaves criptográficas en memoria (pre-keys, sender-keys, sessions)
  const keysStore: Record<string, Record<string, any>> = (sessionRow?.keys && typeof sessionRow.keys === 'object')
    ? sessionRow.keys
    : {};

  let saveKeysTimer: NodeJS.Timeout | null = null;
  let hasPendingKeyChanges = false;

  const flushKeysToDb = async () => {
    if (!hasPendingKeyChanges) return;
    hasPendingKeyChanges = false;
    try {
      await db.saveWhatsappSession(sessionId, creds, keysStore);
    } catch (saveErr) {
      console.error('[WhatsAppService] Error persistiendo llaves en BD:', saveErr);
    }
  };

  const scheduleSaveKeys = () => {
    hasPendingKeyChanges = true;
    if (saveKeysTimer) clearTimeout(saveKeysTimer);
    saveKeysTimer = setTimeout(flushKeysToDb, 600);
  };

  const saveCreds = async () => {
    try {
      await db.saveWhatsappSession(sessionId, creds, keysStore);
      console.log('[WhatsAppService] 💾 Credenciales de WhatsApp sincronizadas con la Base de Datos.');
    } catch (saveErr) {
      console.error('[WhatsAppService] Error guardando credenciales en BD:', saveErr);
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          for (const id of ids) {
            let value = keysStore[type]?.[id] ?? null;
            if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
              try {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              } catch (e) {}
            }
            data[id] = value;
          }
          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            if (!keysStore[category]) {
              keysStore[category] = {};
            }
            for (const id in data[category]) {
              const val = data[category][id];
              if (val) {
                keysStore[category][id] = val;
              } else {
                delete keysStore[category][id];
              }
            }
          }
          scheduleSaveKeys();
        }
      }
    },
    saveCreds
  };
}

class WhatsAppService {
  private initPromise: Promise<void> | null = null;
  private socket: any | null = null;
  public latestQrText: string | null = null;
  private latestQrDataUrl: string | null = null;
  public status: string | null = null;
  public error: string | null = null;
  private qrWaiters: QrWaiter[] = [];
  private isResetting = false;
  private wasConnected = false;
  private reconnectTimeout: any = null;
  // Generación del socket: cada initialize() la incrementa. Los eventos 'close'
  // de sockets viejos solo pueden reconectar si su generación sigue vigente.
  // Esto elimina la carrera reset→reconnect que duplicaba sockets y respuestas.
  private generation = 0;
  public flowState = new PersistentFlowStateMap(); // Guarda en qué nodo del flujo está cada cliente
  private recentBotMessages = new Set<string>();
  private processedMessageIds = new Set<string>();
  private lidToPhoneMap = new Map<string, string>();
  private recentRawMessages = new Map<string, any>();

  private async clearAuthFolder() {
    try {
      await db.clearWhatsappSession('default');
      console.log('[WhatsAppService] 🧹 Sesión de WhatsApp eliminada de la Base de Datos.');
    } catch (e) {
      console.warn('[WhatsAppService] Error al limpiar sesión en BD:', e);
    }

    try {
      const req = typeof eval !== 'undefined' ? eval('require') : require;
      const path = req('path');
      const fs = req('fs');
      const authFolder = path.join(getAppDataStorageDir(), 'baileys_auth_info');
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
        console.log('[WhatsAppService] 🧹 Carpeta de credenciales locales eliminada limpiamente:', authFolder);
      }
    } catch (e) {}
  }

  public async initialize(resetSession: boolean = false) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (resetSession) {
      if (this.socket) {
        try {
          if (typeof this.socket.logout === 'function') await this.socket.logout().catch(() => {});
          else if (typeof this.socket.end === 'function') this.socket.end();
          else if (typeof this.socket.ws?.close === 'function') this.socket.ws.close();
        } catch (e) {}
        this.socket = null;
      }
      this.initPromise = null;
      this.wasConnected = false;
      await this.clearAuthFolder();
    }

    if (this.socket && (this.status === 'connected' || this.status === 'open')) {
      return Promise.resolve();
    }

    if (this.initPromise) return this.initPromise;

    // Limpiar listeners del socket anterior para no duplicar procesamiento
    // (doble respuesta del bot + memory leak en cada refresh/reconnect).
    const prevSocket: any = this.socket;
    this.socket = null;
    if (prevSocket) {
      try {
        const ev = prevSocket.ev;
        if (ev && typeof ev.removeAllListeners === 'function') {
          ev.removeAllListeners('messages.upsert');
          ev.removeAllListeners('connection.update');
          ev.removeAllListeners('creds.update');
          ev.removeAllListeners('contacts.upsert');
          ev.removeAllListeners('contacts.update');
        }
        if (typeof prevSocket.end === 'function') {
          try { prevSocket.end(); } catch (e) {}
        } else if (prevSocket.ws && typeof prevSocket.ws.close === 'function') {
          try { prevSocket.ws.close(); } catch (e) {}
        }
      } catch (e) {}
    }

    this.status = 'connecting';
    this.error = null;
    this.latestQrText = null;
    this.latestQrDataUrl = null;
    // Un init fresco cancela el modo "reseteo manual": si este socket cae después,
    // la reconexión automática vuelve a estar permitida.
    this.isResetting = false;
    const gen = ++this.generation;
    this.initPromise = (async () => {
      try {
        // Preload active flow states from database
        try {
          const states = await db.getAllFlowStates();
          this.flowState.loadStates(states);
          console.log(`[WhatsAppService] Preloaded ${Object.keys(states).length} active flow states from database.`);
        } catch (stErr) {
          console.warn('[WhatsAppService] Could not preload flow states:', stErr);
        }

        let baileys: any;
        try {
          baileys = await import('@whiskeysockets/baileys');
        } catch (impErr) {
          const req = typeof eval !== 'undefined' ? eval('require') : require;
          baileys = req('@whiskeysockets/baileys');
        }
        const makeWASocket = baileys.makeWASocket || baileys.default?.makeWASocket || baileys.default;

        // Autenticación persistente en Base de Datos (Supabase PostgreSQL / SQLite)
        const authState = await useDatabaseAuthState(baileys, 'default');
        const { state, saveCreds } = authState;

        const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion || baileys.default?.fetchLatestBaileysVersion;
        let version;
        if (typeof fetchLatestBaileysVersion === 'function') {
          try {
            const versionRes = await fetchLatestBaileysVersion();
            version = versionRes?.version;
            console.log('[WhatsAppService] Versión de WhatsApp obtenida:', version);
          } catch (vErr) {
            console.warn('[WhatsAppService] No se pudo obtener versión en línea, usando versión por defecto:', vErr);
          }
        }

        let pinoModule: any;
        try {
          pinoModule = await import('pino');
        } catch (pErr) {
          const req = typeof eval !== 'undefined' ? eval('require') : require;
          pinoModule = req('pino');
        }
        const pino = pinoModule.default || pinoModule;
        const logger = pino({ level: 'silent' });

        const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore || baileys.default?.makeCacheableSignalKeyStore;
        const keys = typeof makeCacheableSignalKeyStore === 'function' 
          ? makeCacheableSignalKeyStore(state.keys, logger) 
          : state.keys;

        // Tupla de navegador oficial Mac OS Chrome 125.0.0 validada para vinculación multidevice instantánea
        const browserTuple: [string, string, string] = ['Mac OS', 'Chrome', '125.0.0'];

        const sock = makeWASocket({
          ...(version ? { version } : {}),
          auth: {
            creds: state.creds,
            keys
          },
          printQRInTerminal: false,
          logger,
          browser: browserTuple,
          syncFullHistory: false,
          markOnlineOnConnect: true,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 25000,
          retryRequestOptions: {
            maxRetries: 5,
            delayMs: 1000
          },
          getMessage: async (msgKey: any) => {
            try {
              if (!msgKey?.id) return undefined;
              if (this.recentRawMessages.has(msgKey.id)) {
                return this.recentRawMessages.get(msgKey.id);
              }
              const dbMsg = await db.getMessageById(msgKey.id);
              if (dbMsg?.message) {
                return { conversation: dbMsg.message };
              }
            } catch (gErr) {
              console.warn('[WhatsAppService] Error en getMessage:', gErr);
            }
            return undefined;
          }
        });

        this.socket = sock;

        // Persistir credenciales cuando Baileys emita actualizaciones
        sock.ev.on('creds.update', saveCreds);

        // Escuchar eventos de sincronización de contactos de WhatsApp para mapear LIDs a teléfonos
        // y asignar automáticamente el número real a leads que solo tenían el LID temporal.
        sock.ev.on('contacts.upsert', async (contacts: any[]) => {
          try {
            if (Array.isArray(contacts)) {
              for (const c of contacts) {
                if (c.id && c.lid) {
                  const phoneNum = this.getPhoneFromWhatsappId(c.id);
                  const lidNum = this.getPhoneFromWhatsappId(c.lid);
                  if (phoneNum && lidNum && phoneNum !== lidNum) {
                    await this.rememberLidMapping(lidNum, phoneNum);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[WhatsAppService] contacts.upsert handler:', err);
          }
        });

        sock.ev.on('contacts.update', async (updates: any[]) => {
          try {
            if (Array.isArray(updates)) {
              for (const u of updates) {
                if (u.id && u.lid) {
                  const phoneNum = this.getPhoneFromWhatsappId(u.id);
                  const lidNum = this.getPhoneFromWhatsappId(u.lid);
                  if (phoneNum && lidNum && phoneNum !== lidNum) {
                    await this.rememberLidMapping(lidNum, phoneNum);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[WhatsAppService] contacts.update handler:', err);
          }
        });

        sock.ev.on('messages.upsert', async (messageUpdate: any) => {
          console.log("Mensaje crudo recibido:", JSON.stringify(messageUpdate, null, 2));
          try {
            if (messageUpdate.type !== 'notify' && messageUpdate.type !== 'append') return;
            if (!Array.isArray(messageUpdate.messages)) return;

            // Si es un 'append' (eco de envío desde web o sincronización de celular), 
            // filtrar para SOLO procesar mensajes propios (fromMe: true).
            let messagesToProcess = messageUpdate.messages;
            if (messageUpdate.type === 'append') {
                messagesToProcess = messageUpdate.messages.filter((m: any) => m.key?.fromMe === true);
                if (messagesToProcess.length === 0) return;
            }

            // BLINDAJE CIFRADO E2E: Desempaquetar PLACEHOLDER_MESSAGE_RESEND (mensajes descifrados en diferido)
            const proto = baileys.proto || baileys.default?.proto;
            const expandedMessages: any[] = [];
            for (const msg of messagesToProcess) {
              const pm = msg?.message?.protocolMessage;
              const peerRes = pm?.peerDataOperationRequestResponseMessage;
              if (
                peerRes?.peerDataOperationRequestType === 'PLACEHOLDER_MESSAGE_RESEND' ||
                peerRes?.peerDataOperationRequestType === 1 ||
                peerRes?.peerDataOperationResult
              ) {
                const results = peerRes.peerDataOperationResult || [];
                let unpackedCount = 0;
                for (const item of results) {
                  const bytes = item?.placeholderMessageResendResponse?.webMessageInfoBytes;
                  if (bytes && proto?.WebMessageInfo) {
                    try {
                      const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'base64');
                      const decodedMsg = proto.WebMessageInfo.decode(buf);
                      if (decodedMsg && decodedMsg.message && decodedMsg.key) {
                        console.log(`[WhatsAppService] 🔓 PLACEHOLDER_MESSAGE_RESEND descifrado exitosamente: ID ${decodedMsg.key.id} de ${decodedMsg.key.remoteJid}`);
                        if (!decodedMsg.pushName && msg.pushName) {
                          decodedMsg.pushName = msg.pushName;
                        }
                        expandedMessages.push(decodedMsg);
                        unpackedCount++;
                      }
                    } catch (decErr) {
                      console.warn('[WhatsAppService] Error decodificando webMessageInfoBytes:', decErr);
                    }
                  }
                }
                if (unpackedCount === 0) {
                  expandedMessages.push(msg);
                }
              } else {
                expandedMessages.push(msg);
              }
            }
            messagesToProcess = expandedMessages;

            for (const incoming of messagesToProcess) {
              const key = incoming?.key || {};
              const message = incoming?.message;
              if (!message || (!key.remoteJid && !key.remoteJidAlt)) continue;

              // Si es un stub (mensaje en espera de llaves E2E / CIPHERTEXT_UNAVAILABLE),
              // NO registrarlo en processedMessageIds para permitir que el mensaje descifrado se procese al llegar.
              if (message.messageStubType || incoming.messageStubType) {
                console.log(`[WhatsAppService] ⏳ Mensaje stub en espera de llaves E2E (ID: ${key.id}, Tipo: ${incoming.messageStubType || message.messageStubType}).`);
                continue;
              }

              // Si es un protocolMessage general que no es contenido de usuario (ephemeral, revoke, etc.), ignorar
              if (message.protocolMessage) {
                continue;
              }

              // FILTRO DE MENSAJES HISTÓRICOS / SINCRONIZACIÓN INICIAL
              // Si el mensaje tiene más de 120 segundos de antigüedad respecto a la hora actual,
              // es un mensaje viejo transmitido por WhatsApp durante la sincronización inicial al vincular.
              // NO debe crear leads, NO debe abrir chats y NO debe disparar bots ni flujos.
              const rawTimestamp = incoming.messageTimestamp;
              const msgTimestampSec = typeof rawTimestamp === 'number'
                ? rawTimestamp
                : (rawTimestamp?.low ?? (typeof rawTimestamp?.toNumber === 'function' ? rawTimestamp.toNumber() : 0));
              const nowSec = Math.floor(Date.now() / 1000);
              if (msgTimestampSec > 0 && (nowSec - msgTimestampSec) > 120) {
                console.log(`[WhatsAppService] ⏳ Mensaje histórico ignorado (edad: ${nowSec - msgTimestampSec}s, ID: ${key.id} de ${key.remoteJid}). No se abrirá chat.`);
                continue;
              }

              // FILTRO ANTI-DUPLICADOS POR ID DE MENSAJE
              const rawMsgId = key.id;
              if (rawMsgId && this.processedMessageIds.has(rawMsgId)) {
                console.log(`[WhatsAppService] 🛡️ Mensaje entrante con ID ${rawMsgId} ya procesado, omitiendo duplicado.`);
                continue;
              }
              if (rawMsgId) {
                this.processedMessageIds.add(rawMsgId);
                setTimeout(() => this.processedMessageIds.delete(rawMsgId), 60000);
              }

              // Guardar en caché crudo para resolución de getMessage
              if (rawMsgId && message) {
                this.recentRawMessages.set(rawMsgId, message);
                if (this.recentRawMessages.size > 500) {
                  const firstK = this.recentRawMessages.keys().next().value;
                  if (firstK) this.recentRawMessages.delete(firstK);
                }
              }

              const hasAlt = !!key.remoteJidAlt;
              const rawRemoteJid = (key.remoteJid || '').toString();
              const rawRemoteJidAlt = (key.remoteJidAlt || '').toString();
              const rawParticipant = (key.participant || incoming.participant || '').toString();
              const rawSenderPn = (key.senderPn || incoming.senderPn || incoming.sender_pn || key.participantPn || incoming.participantPn || '').toString();
              const pushName = (incoming.pushName || '').trim();

              let phoneJid = hasAlt ? rawRemoteJidAlt : rawRemoteJid;
              let lidJid: string | null = hasAlt ? rawRemoteJid : null;

              // Si existe senderPn (Phone Number real provisto por WhatsApp en cuentas LID), usarlo directamente como phoneJid prioritario
              if (rawSenderPn && rawSenderPn.endsWith('@s.whatsapp.net')) {
                phoneJid = rawSenderPn;
                if (rawRemoteJid.endsWith('@lid')) {
                  lidJid = rawRemoteJid;
                }
              } else if (rawRemoteJid.endsWith('@lid') && !hasAlt) {
                // Si remoteJid principal es LID y remoteJidAlt no estaba presente, revisar participante
                lidJid = rawRemoteJid;
                if (rawParticipant.endsWith('@s.whatsapp.net')) {
                  phoneJid = rawParticipant;
                }
              }

              if (rawRemoteJid === 'status@broadcast' || rawRemoteJid.endsWith('@broadcast') || rawRemoteJid.endsWith('@g.us')) continue;
              const fromMe = incoming.key?.fromMe ?? false;

              // Extract text directly. No cleaning or sanitization is done here,
              // ensuring full preservation of special characters and utf8mb4 emojis (e.g. 🥺).
              console.log('[WhatsAppService] 🔍 Debug - fromMe:', fromMe, 'rawMsg:', JSON.stringify(message));
              let extractedRaw = await this.extractMessageText(incoming, baileys);
              let text: string = extractedRaw || '';
              if (!text) {
                console.warn('[WhatsAppService] ⚠️ Texto vacío. fromMe:', fromMe);
                if (fromMe) {
                  text = message?.conversation || message?.extendedTextMessage?.text || '';
                  if (!text) continue;
                } else {
                  text = 'Hola';
                }
              }

              let extractedPhone = this.getPhoneFromWhatsappId(phoneJid);
              let extractedLid = lidJid ? this.getPhoneFromWhatsappId(lidJid) : null;

              if (extractedLid && extractedPhone && extractedPhone !== extractedLid) {
                this.lidToPhoneMap.set(extractedLid, extractedPhone);
                // Persistir el mapeo en segundo plano (auto-asigna real_phone si aplica)
                void this.rememberLidMapping(extractedLid, extractedPhone);
              }

              // Si el teléfono extraído tiene 14+ dígitos es (casi seguro) un LID: resolverlo.
              // Los de 13 (ej. móviles AR) son números reales y no deben guardarse como LID.
              if (extractedPhone && extractedPhone.length >= 14) {
                if (!extractedLid) extractedLid = extractedPhone;

                // 1. Revisar memoria de mapeo LID -> Teléfono
                if (this.lidToPhoneMap.has(extractedLid)) {
                  extractedPhone = this.lidToPhoneMap.get(extractedLid) || extractedPhone;
                }

                // 2. Buscar en BD por whatsapp_lid
                if (extractedPhone && extractedPhone.length >= 14) {
                  const existingLeadId = await db.getLeadIdByWhatsappLid(extractedLid);
                  if (existingLeadId) {
                    const existingLead = await db.getLeadById(existingLeadId);
                    if (existingLead && existingLead.phone && existingLead.phone.length < 14) {
                      extractedPhone = existingLead.phone;
                    }
                  }
                }

                // 3. Buscar si existe algún lead que tenga este ID como whatsapp_lid o como ID
                if (extractedPhone && extractedPhone.length >= 14) {
                  const allLeads = await db.getLeads();
                  const match = allLeads.find((l: any) => 
                    (l.whatsapp_lid === extractedLid || l.id === extractedLid) && 
                    l.phone && l.phone.length < 14
                  );
                  if (match) {
                    extractedPhone = match.phone;
                  }

                  // 4. Si aún no se resolvió pero tenemos pushName (ej. "Mosley21"), buscar coincidencia por nombre de lead
                  if (extractedPhone && extractedPhone.length >= 13 && pushName && pushName.length >= 3) {
                    const matchByName = allLeads.find((l: any) => 
                      l.name && l.name.toLowerCase().trim() === pushName.toLowerCase().trim() && 
                      l.phone && l.phone.length < 13
                    );
                    if (matchByName && extractedLid && matchByName.phone) {
                      console.log(`[WhatsAppService] 🎯 Coincidencia por nombre detectada: '${pushName}' -> Lead ${matchByName.id} (${matchByName.phone})`);
                      extractedPhone = matchByName.phone;
                      this.lidToPhoneMap.set(extractedLid, matchByName.phone);
                      await db.upsertLead({ ...matchByName, whatsapp_lid: extractedLid });
                    }
                  }
                }
              }

              let phone = extractedPhone;
              let lid = extractedLid;

              // Normalización Universal de JID tipo LID
              if (phoneJid.endsWith('@lid') && phone) {
                const normalizedPhoneJid = await db.normalizeJid(phoneJid);
                if (normalizedPhoneJid !== phoneJid) {
                  lid = phone;
                  phone = this.getPhoneFromWhatsappId(normalizedPhoneJid);
                }
              }

              // Si phone sigue siendo un LID (14+ dígitos) pero existe un lead con número real, usarlo
              if (phone && phone.length >= 14) {
                const existingLead = await db.getLeadById(phone);
                if (existingLead && existingLead.phone && existingLead.phone.length < 14) {
                  phone = existingLead.phone;
                }
              }

              // Tabla de Mapeo de Identidad estática para celular vinculado
              if (phone && db.IDENTITY_MAPPING[phone]) {
                const staticEquivs = db.IDENTITY_MAPPING[phone];
                const realPhone = staticEquivs.find((id: string) => id !== phone && id.startsWith('51'));
                if (realPhone) {
                  console.log(`[WhatsAppService] Normalizando ID ${phone} a número real mapeado estáticamente: ${realPhone}`);
                  if (!lid) lid = phone;
                  phone = realPhone;
                }
              }

              // Ignorar tráfico propio: si la contraparte es nuestra propia cuenta vinculada
              // (notas a uno mismo, ecos del dispositivo), no es un cliente. Sin esto, el
              // número del propio CRM se crea como lead fantasma.
              const myRawId = ((sock as any)?.user?.id || '').toString();
              if (myRawId) {
                const myBare = myRawId.split(':')[0];
                const myDigits = myBare.split('@')[0].replace(/\D/g, '');
                const sameJid = (j: string) => !!j && (j === myBare || j.split(':')[0] === myBare);
                const isSelfChat =
                  sameJid(rawRemoteJid) || sameJid(rawRemoteJidAlt) ||
                  (myDigits !== '' && (phone === myDigits || lid === myDigits));
                if (isSelfChat) {
                  continue;
                }
              }

              console.log('[WhatsAppService] 📱 Phone:', phone, 'Lid:', lid, 'PushName:', pushName, 'RemoteJid:', key.remoteJid);
              if (!phone) {
                console.error('[WhatsAppService] ERROR: No se pudo extraer el remitente del mensaje. Mensaje completo:', JSON.stringify(incoming, null, 2));
                continue;
              }

              // Usar el JID exacto de origen para garantizar entrega al cliente
              const replyJid = key.remoteJid || (phone.endsWith('@lid') || phone.length >= 14 ? `${phone}@lid` : `${phone}@s.whatsapp.net`);

              const leadId = phone;
              const leadName = pushName || `WhatsApp ${phone}`;
              const sender = fromMe ? 'agent' : 'customer';

              // Si el lead temporal con ID tipo LID existía en BD y ahora sabemos el lead principal, fusionar de inmediato
              if (lid && lid !== leadId) {
                const tempLidLead = await db.getLeadById(lid);
                if (tempLidLead) {
                  console.log(`[WhatsAppService] 🔀 Fusionando lead temporal ${lid} con lead real ${leadId}`);
                  await db.mergeLeads(lid, leadId);
                }
              }

              // FILTRO ANTI-DUPLICADOS: Ignorar el eco de WhatsApp si el bot acaba de enviar este mensaje
              if (fromMe && text && this.recentBotMessages.has(text.substring(0, 50))) {
                console.log('[WhatsAppService] ⏭️ Eco del bot detectado, ignorando duplicado.');
                continue;
              }

              const msgId = incoming.key?.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

              // Guardar/actualizar cliente si no existe
              let currentLead = await db.getLeadById(leadId);
              // Si ya conocemos el teléfono real (7-13 dígitos; los LIDs tienen 14+) pero el lead
              // quedó con LID, persistirlo en real_phone para mostrarlo y escribirle directo
              const phoneDigits = phone ? phone.replace(/\D/g, '') : '';
              const shortPhone = phoneDigits.length >= 7 && phoneDigits.length < 14 ? phone : null;
              if (!currentLead) {
                await db.upsertLead({ 
                  id: leadId, 
                  name: leadName, 
                  phone, 
                  whatsapp_lid: lid,
                  real_phone: shortPhone,
                  status: 'New', 
                  tags: [], 
                  bot_active: true 
                });
                currentLead = await db.getLeadById(leadId);
              } else {
                let needsUpdate = false;
                let updatedName = currentLead.name;
                let updatedLid = currentLead.whatsapp_lid;

                if (lid && currentLead.whatsapp_lid !== lid) {
                  updatedLid = lid;
                  needsUpdate = true;
                }
                if (pushName && (!currentLead.name || currentLead.name.startsWith('WhatsApp ') || currentLead.name.length < 3)) {
                  updatedName = pushName;
                  needsUpdate = true;
                }
                const updatedRealPhone = shortPhone || currentLead.real_phone || null;
                if (updatedRealPhone && currentLead.real_phone !== updatedRealPhone) {
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  await db.upsertLead({
                    id: leadId,
                    name: updatedName,
                    phone,
                    whatsapp_lid: updatedLid,
                    real_phone: updatedRealPhone,
                    status: currentLead.status,
                    tags: currentLead.tags,
                    bot_active: currentLead.bot_active !== false && currentLead.bot_active !== 0
                  });
                  currentLead = await db.getLeadById(leadId);
                }
              }

              try {
                await db.addMessage(leadId, sender, text, msgId);
                console.log(`[WhatsAppService] ✅ Mensaje GUARDADO en BD. Lead: ${leadId}, Sender: ${sender}`);
              } catch (msgSaveErr) {
                console.warn(`[WhatsAppService] ⚠️ No se pudo guardar mensaje entrante en BD, continuando respuesta:`, msgSaveErr);
              }

              // Detectar si el cliente envió un comprobante REAL (imagen/foto/documento adjunto)
              const isImageOrDoc = Boolean(
                message.imageMessage || 
                message.documentMessage || 
                (typeof text === 'string' && (text.startsWith('[Foto]') || text.startsWith('[Documento]')))
              );

              if (sender === 'customer' && isImageOrDoc) {
                const recentMsgs = await db.getMessages(leadId);
                const hasSentPaymentDetails = recentMsgs.slice(-8).some(m => {
                  const msgLower = (m.message || '').toLowerCase();
                  return msgLower.includes('yape') || msgLower.includes('plin') || msgLower.includes('transferenci') || msgLower.includes('banco') || msgLower.includes('cuenta') || msgLower.includes('comprobante') || msgLower.includes('titular');
                });

                if (hasSentPaymentDetails) {
                  console.log(`[WhatsAppService] 💳 Comprobante (FOTO/DOCUMENTO) recibido para el lead ${leadId}. Actualizando a Pendiente de Verificación y enviando alerta SMTP.`);
                  await db.updateLeadStatus(leadId, 'Pending Verification');
                  await db.updateLeadBotActive(leadId, false);
                  // Fase 2 pedidos: congelar producto x cantidad = total (no bloquea)
                  void snapshotOrderForLead(leadId);
                  
                  // Despachar alerta SMTP al Administrador con número telefónico real
                  try {
                    let realCustomerPhone = currentLead?.real_phone || currentLead?.phone || phone;
                    if (realCustomerPhone && realCustomerPhone.length >= 14 && this.lidToPhoneMap.has(realCustomerPhone)) {
                      realCustomerPhone = this.lidToPhoneMap.get(realCustomerPhone) || realCustomerPhone;
                    }
                    const { alertPaymentVerification } = await import('./notifications');
                    await alertPaymentVerification({
                      name: currentLead?.name || realCustomerPhone,
                      phone: realCustomerPhone,
                      status: 'Pendiente de Verificación de Pago'
                    });
                    console.log(`[WhatsAppService] 📧 Alerta SMTP de pago enviada para ${leadId} con teléfono ${realCustomerPhone}`);
                  } catch (smtpErr) {
                    console.error('[WhatsAppService] Error enviando alerta SMTP de pago:', smtpErr);
                  }

                  const autoReply = '¡Muchas gracias por tu pago! Tu comprobante ha sido recibido. Un asesor humano lo verificará en unos minutos y procederemos con tu entrega. ¡Que tengas un excelente día! 😊';
                  await db.addMessage(leadId, 'bot', autoReply);
                  await this.sendMessageToPhone(replyJid, autoReply);
                  continue; // Ya respondimos al comprobante real, saltar procesamiento normal
                }
              }

              // ==========================================
              // FLUJO AUTOMÁTICO vs IA (Gemini)
              // ==========================================
              let isBotActive = currentLead ? (currentLead.bot_active !== 0 && currentLead.bot_active !== false) : true;
              const aiGloballyEnabled = await getAiGloballyEnabled();

              // Detectar si el mensaje es un disparador de un flujo activo para reactivar el bot
              if (sender === 'customer') {
                const flows = await db.getFlows();
                const activeFlows = flows.filter((f: any) => f.is_active);
                let messageTriggersFlow = false;
                for (const flow of activeFlows) {
                  if (flow.nodes) {
                    const triggerNode = flow.nodes.find((n: any) => n.type === 'trigger');
                    if (triggerNode) {
                      let keywordStr = triggerNode.data.keyword || '';
                      if (!keywordStr.trim()) {
                        keywordStr = 'hola, hi, hello, empezar, inicio, menú, menu, buenas, buenos días, buenos dias, buen dia, informacion, info, precio, comprar';
                      }
                      const keywords = keywordStr.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
                      const cleanText = text.toLowerCase().trim();
                      const matches = keywords.some((k: string) => cleanText === k || (cleanText.length <= k.length + 5 && cleanText.includes(k)));
                      if (matches) {
                        messageTriggersFlow = true;
                        break;
                      }
                    }
                  }
                }

                if (messageTriggersFlow || !isBotActive) {
                  console.log(`[WhatsAppService] Mensaje entrante de cliente. Asegurando bot activo para ${leadId}.`);
                  await db.updateLeadBotActive(leadId, true);
                  isBotActive = true;
                  this.flowState.delete(leadId);
                }
              }

              if (sender === 'customer' && isBotActive) {
                try {
                  const flowContext: { overrideText: string | null; outOfMenuContext?: boolean } = { overrideText: null };
                  const flowReply = await this.executeActiveFlow(leadId, text, replyJid, flowContext);
                  
                  if (flowReply) {
                    console.log(`[WhatsAppService] 🔀 Flujo ejecutado para ${leadId}`);
                  } else if (aiGloballyEnabled) {
                    // 2. SI NO HAY FLUJO Y LA IA ESTA HABILITADA, USAR IA (GEMINI RAG)
                    const textForAI = flowContext.overrideText || text;
                    const recentMsgs = await db.getMessages(leadId);
                    const history = recentMsgs.slice(-5).map((m: any) => ({ sender: m.sender, message: m.message }));
                    const rawReply = await queryKnowledgeBase(textForAI, history);
                    // queryKnowledgeBase ya sanitiza, doble barrera por si el proveedor cambió
                    const reply = sanitizeAiReply(rawReply);
                    console.log(`[WhatsAppService] 🔑 Gemini respondió: ${reply.substring(0, 80)}`);

                    if (reply.trim() === '[UNKNOWN]' || reply.trim().startsWith('[UNKNOWN] ')) {
                      console.log(`[WhatsAppService] ⚠️ IA no pudo responder. Registrando duda sin desactivar bot para ${leadId}`);
                      let newStatus = 'Engaged';
                      const lowerText = textForAI.toLowerCase();
                      if (lowerText.includes('pay') || lowerText.includes('comprar') || lowerText.includes('pago')) newStatus = 'Pending Verification';
                      await db.updateLeadStatus(leadId, newStatus);

                      const contextSnippet = history.slice(-4).map((m: any) => `${m.sender}: ${m.message}`).join('\n');
                      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                      await db.addGap(gapId, leadId, textForAI, contextSnippet);

                      const fallbackReply = 'Lo siento, no tengo esa información exacta en este momento. Un asesor revisará tu pregunta a la brevedad. ¿Hay algún otro producto sobre el que quisieras consultar? 😊';
                      this.recentBotMessages.add(fallbackReply.substring(0, 50));
                      setTimeout(() => this.recentBotMessages.delete(fallbackReply.substring(0, 50)), 6000);
                      await this.sendMessageToPhone(replyJid, fallbackReply);
                      try { await db.addMessage(leadId, 'bot', fallbackReply); } catch (e) {}
                    } else {
                      // Detectar registro oficial (mismo protocolo que el webhook): nunca enviar el tag
                      const registroMatch = reply.match(/\[REGISTRO_DETECTADO:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);
                      const visibleReply = stripInternalTagsForSending(reply);
                      if (!visibleReply) {
                        console.warn(`[WhatsAppService] Respuesta vacía tras sanitizar para ${leadId}, se omite envío.`);
                      } else if (registroMatch) {
                        console.log(`[WhatsAppService] 🎯 Registro detectado para lead ${leadId}. Bot pausado.`);
                        await this.sendMessageToPhone(replyJid, visibleReply);
                        try { await db.addMessage(leadId, 'bot', visibleReply); } catch (e) {}
                        void logRecommendedProduct(leadId, visibleReply);
                        await db.updateLeadBotActive(leadId, false).catch(() => {});
                        await db.updateLeadStatus(leadId, 'Por Registrar en Web').catch(() => {});
                      } else {
                        console.log(`[WhatsAppService] 🤖 Bot (Gemini) respondiendo a ${leadId}: ${visibleReply.slice(0, 60)}...`);
                        this.recentBotMessages.add(visibleReply.substring(0, 50));
                        setTimeout(() => this.recentBotMessages.delete(visibleReply.substring(0, 50)), 10000);
                        await this.sendMessageToPhone(replyJid, visibleReply);
                        try { await db.addMessage(leadId, 'bot', visibleReply); } catch (e) {}
                        void logRecommendedProduct(leadId, visibleReply);

                        // Disparador de intención de compra (avanzar a Engaged si era New)
                        if (currentLead?.status === 'New') {
                          await db.updateLeadStatus(leadId, 'Engaged').catch(() => {});
                        }
                      }
                    }
                  } else {
                    console.log(`[WhatsAppService] AI is globally disabled. Skipping AI response for ${leadId}.`);
                  }
                } catch (aiError) {
                  console.error('[WhatsAppService] Error en flujo/IA:', aiError);
                  try {
                    const fallbackReply = '¡Hola! Gracias por comunicarte con NutraFlow. Un asesor humano te atenderá en unos minutos. Si deseas consultar por algún producto (Thermo T3, Prunex1, Vita Energía, etc.), por favor indícanos el nombre 😊';
                    await db.addMessage(leadId, 'bot', fallbackReply);
                    await this.sendMessageToPhone(replyJid, fallbackReply);
                  } catch (fallbackErr) {
                    console.error('[WhatsAppService] Error enviando respuesta de contingencia:', fallbackErr);
                  }
                }
              }
            }
          } catch (messageError: any) {
            console.error('Error processing incoming WhatsApp messages:', messageError?.message || messageError, messageError?.stack);
          }
        });

        sock.ev.on('connection.update', (update: any) => {
          if (update.qr) {
            this.latestQrText = update.qr;
            this.latestQrDataUrl = null;
            this.resolveQrWaiters(update.qr);
            console.log('WhatsApp QR event received, qr length:', update.qr?.length ?? 0);
          }

          if (update.connection) {
            const normalizedStatus = update.connection === 'open' ? 'connected' : update.connection;
            this.status = normalizedStatus;
            if (normalizedStatus === 'connected') {
              this.wasConnected = true;
            }
            console.log('WhatsApp connection update:', update.connection, 'normalized:', normalizedStatus);
          }

          if (update.connection === 'close') {
            const statusCode = update.lastDisconnect?.error?.output?.statusCode;
            const reason = update.lastDisconnect?.error?.output?.payload?.reason;
            console.warn('WhatsApp socket closed:', statusCode, reason);
            this.socket = null;
            this.initPromise = null;
            this.latestQrText = null;
            this.latestQrDataUrl = null;
            
            // Cancelar inmediatamente promesas de QR pendientes
            this.rejectQrWaiters(new Error(`Socket de WhatsApp cerrado (${statusCode || 'desconocido'})`));

            if (this.reconnectTimeout) {
              clearTimeout(this.reconnectTimeout);
              this.reconnectTimeout = null;
            }

            // Códigos terminales: sesión cerrada desde el celular (401), prohibido (403)
            // o sesión corrupta (500). Reconectar sería un loop infinito: se pide nuevo QR.
            const TERMINAL_CODES = [401, 403, 500];
            if (TERMINAL_CODES.includes(statusCode)) {
              this.status = 'logged_out';
              this.error = 'Sesión de WhatsApp cerrada. Vincula de nuevo con el código QR.';
              this.wasConnected = false;
              console.warn(`[WhatsAppService] Sesión terminada (código ${statusCode}). Sin reconexión automática: se requiere nuevo QR.`);
              return;
            }

            this.status = 'disconnected';

            // NO BORRAR CREDENCIALES NUNCA AUTOMÁTICAMENTE. Las credenciales solo se borran en logout manual.
            // Solo reconectar si este 'close' pertenece al socket vigente (misma generación)
            // y no hay un reseteo manual en curso. Evita sockets duplicados tras refresh.
            if (!this.isResetting && gen === this.generation) {
              const delay = statusCode === 440 ? 5000 : 3000;
              console.log(`[WhatsAppService] Reconexión automática programada (código ${statusCode}) en ${delay / 1000}s...`);
              this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                this.initialize(false).catch((err) => console.error('[WhatsAppService] Error en reconexión automática:', err));
              }, delay);
            } else {
              console.log(`[WhatsAppService] Reconexión omitida (reseteo manual o socket obsoleto).`);
            }
            this.wasConnected = false;
          }
        });

        this.socket = sock;
      } catch (error: any) {
        // Record and log full error for readable logs in serverless environments (Vercel)
        this.error = error?.message || String(error);
        this.status = 'error';
        this.socket = null;
        this.initPromise = null;
        this.rejectQrWaiters(new Error(this.error ?? 'WhatsAppService initialization failed'));
        console.error('WhatsAppService initialization failed:', this.error);
        if (error && error.stack) console.error(error.stack);
        // Re-throw so callers (API routes) can catch and return a descriptive response
        throw error;
      }
    })();

    return this.initPromise;
  }

  private resolveQrWaiters(qrText: string) {
    const waiters = this.qrWaiters.splice(0, this.qrWaiters.length);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(qrText);
    }
  }

  private rejectQrWaiters(error: Error) {
    const waiters = this.qrWaiters.splice(0, this.qrWaiters.length);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  public async waitForQr(timeoutMs: number = DEFAULT_QR_TIMEOUT_MS): Promise<string> {
    if (this.latestQrText) return this.latestQrText;
    if (this.error) throw new Error(this.error);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.qrWaiters = this.qrWaiters.filter((waiter) => waiter.timer !== timer);
        reject(new Error('Timeout al esperar el QR de WhatsApp'));
      }, timeoutMs);

      this.qrWaiters.push({ resolve, reject, timer });
    });
  }

  private async buildQrDataUrl(qrText: string) {
    if (this.latestQrDataUrl && this.latestQrText === qrText) {
      return this.latestQrDataUrl;
    }
    // Extraer la cadena de emparejamiento pura de WhatsApp (removiendo wrappers como wa.me/settings/linked_devices#)
    let cleanQrText = qrText;
    if (cleanQrText.includes('#')) {
      cleanQrText = cleanQrText.split('#')[1] || cleanQrText;
    }
    this.latestQrDataUrl = await QRCode.toDataURL(cleanQrText, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 400
    });
    return this.latestQrDataUrl;
  }

  private getPhoneFromWhatsappId(id: string): string | null {
    if (!id || typeof id !== 'string') return null;
    const raw = id.split('@')[0] || '';
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9')) {
      digits = '51' + digits;
    }
    return digits.length > 0 ? digits : null;
  }

  /**
   * Guarda el mapeo LID -> teléfono real en memoria y en BD.
   * Si el lead solo existía bajo el LID temporal, le asigna el número real automáticamente.
   */
  private async rememberLidMapping(lidNum: string, phoneNum: string): Promise<void> {
    if (!lidNum || !phoneNum || lidNum === phoneNum) return;
    this.lidToPhoneMap.set(lidNum, phoneNum);
    try {
      // Solo un número corto cuenta como teléfono real (el id podría ser otro LID)
      const shortNum = phoneNum.replace(/\D/g, '').length < 13 ? phoneNum : null;
      const leadByPhone = await db.getLeadById(phoneNum).catch(() => null);
      if (leadByPhone && leadByPhone.whatsapp_lid !== lidNum) {
        await db.upsertLead({ ...leadByPhone, whatsapp_lid: lidNum });
      }
      if (shortNum) {
        const leadByLid = await db.getLeadById(lidNum).catch(() => null);
        if (leadByLid && !leadByLid.real_phone) {
          console.log(`[WhatsAppService] 📞 Número real auto-asignado al lead ${lidNum}: ${shortNum}`);
          await db.upsertLead({ ...leadByLid, real_phone: shortNum });
        }
      }
    } catch (err) {
      console.warn('[WhatsAppService] rememberLidMapping:', err);
    }
  }

  private getWhatsappJid(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Número de WhatsApp inválido o no especificado');
    }
    if (phone.endsWith('@lid') || phone.endsWith('@s.whatsapp.net')) return phone;
    
    let raw = phone.replace(/\D/g, '');
    if (!raw || raw.length < 7) {
      throw new Error(`El número telefónico "${phone}" no es válido para WhatsApp.`);
    }

    // Auto-anteponer código de país 51 si es número móvil de Perú (9 dígitos)
    if (raw.length === 9 && raw.startsWith('9')) {
      raw = '51' + raw;
    }

    if (raw.length >= 14) {
      return `${raw}@lid`;
    }
    return `${raw}@s.whatsapp.net`;
  }

  // --- MOTOR DE FLUJOS BACKEND ---
  public async executeActiveFlow(
    leadId: string,
    text: string,
    phone: string,
    flowContext: { overrideText: string | null; outOfMenuContext?: boolean },
    sendMessageFn?: (phone: string, text: string) => Promise<any>
  ): Promise<string | null> {
    const flow = await db.getActiveFlow();
    if (!flow || !flow.nodes || !flow.edges) return null;

    const nodes = flow.nodes;
    const edges = flow.edges;

    if (!this.flowState.has(leadId)) {
      const triggerNode = nodes.find((n: any) => n.type === 'trigger');
      if (triggerNode) {
        let keywordStr = triggerNode.data.keyword || '';
        if (!keywordStr.trim()) {
          keywordStr = 'hola, hi, hello, empezar, inicio, menú, menu, buenas, buenos días, buenos dias, buen dia, informacion, info, precio, comprar';
        }
        const keywords = keywordStr.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
        if (keywords.some((k: string) => text.toLowerCase().includes(k))) {
          const edge = edges.find((e: any) => e.source === triggerNode.id);
          if (edge) {
            this.flowState.set(leadId, edge.target);
            return await this.processFlowNode(leadId, edge.target, nodes, edges, phone, sendMessageFn);
          }
        }
      }
      return null; 
    } else {
      const currentNodeId = this.flowState.get(leadId)!;
      const currentNode = nodes.find((n: any) => n.id === currentNodeId);

      if (currentNode?.type === 'buttons') {
        const buttons = currentNode.data.buttons || [];
        // ACEPTAR TEXTO EXACTO O NÚMERO (1, 2, 3)
        const btnIndex = buttons.findIndex((b: string, i: number) => text.trim() === b.trim() || text.trim() === String(i + 1));
        
        if (btnIndex !== -1) {
          const selectedButtonText = buttons[btnIndex];
          const handleId = `btn-${btnIndex}`;
          const edge = edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === handleId);
          
          if (edge) {
            this.flowState.set(leadId, edge.target);
            return await this.processFlowNode(leadId, edge.target, nodes, edges, phone, sendMessageFn);
          } else {
            // NO HAY NODO SIGUIENTE: Pasar el texto del botón a Gemini para que responda con la Biblioteca
            this.flowState.delete(leadId);
            flowContext.overrideText = selectedButtonText; // Ej: "Informacion de Productos"
            return null;
          }
        }
      }
      // SI ESCRIBIÓ ALGO QUE NO ES UN BOTÓN: 
      // Solo reiniciar si es una palabra clave EXACTA y corta (evitar cruzar saludos si preguntan "hola, cuanto cuesta X")
      const triggerNode = nodes.find((n: any) => n.type === 'trigger');
      let triggerKeywordStr = triggerNode?.data?.keyword || '';
      if (!triggerKeywordStr.trim()) {
        triggerKeywordStr = 'hola, empezar, inicio, menú, menu';
      }
      const triggerKeywords = triggerKeywordStr.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0);
      const cleanText = text.toLowerCase().trim();
      
      const isExactKeyword = triggerKeywords.some((k: string) => cleanText === k || (cleanText.length <= k.length + 3 && cleanText.includes(k)));
      
      if (isExactKeyword) {
        this.flowState.delete(leadId);
        const edge = edges.find((e: any) => e.source === triggerNode.id);
        if (edge) {
          this.flowState.set(leadId, edge.target);
          return await this.processFlowNode(leadId, edge.target, nodes, edges, phone, sendMessageFn);
        }
      }

      // Si no es palabra clave exacta, es una pregunta. Dejar que Gemini responda sin perder el menú.
      flowContext.outOfMenuContext = true;
      return null; 
    }
  }

  public async processFlowNode(
    leadId: string,
    nodeId: string,
    nodes: any[],
    edges: any[],
    phone: string,
    sendMessageFn?: (phone: string, text: string) => Promise<any>
  ): Promise<string | null> {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      this.flowState.delete(leadId);
      return null;
    }

    const sendMsg = sendMessageFn || ((p: string, t: string) => this.sendMessageToPhone(p, t));

    if (node.type === 'message') {
      let msgText = node.data.message;

      // Multi-branching: get ALL outgoing edges from this node
      const outEdges = edges.filter((e: any) => e.source === node.id);

      if (outEdges.length > 0) {
        const nextNode = nodes.find((n: any) => n.id === outEdges[0].target);
        if (nextNode?.type === 'buttons') {
          const btnText = (nextNode.data.buttons || []).map((b: string, i: number) => `🔹 *${i+1}.* ${b}`).join('\n');
          msgText = `${msgText}\n\n${btnText}`;
          this.flowState.set(leadId, nextNode.id);
        } else {
          this.flowState.set(leadId, outEdges[0].target);
        }

        // Fire any additional parallel branches (multi-branching)
        if (outEdges.length > 1) {
          for (let i = 1; i < outEdges.length; i++) {
            this.processFlowNode(leadId, outEdges[i].target, nodes, edges, phone, sendMessageFn)
              .catch((err: any) => console.error('[WhatsAppService] Multi-branch error:', err));
          }
        }
      } else {
        this.flowState.delete(leadId);
      }

      await sendMsg(phone, msgText);
      try {
        await db.addMessage(leadId, 'bot', msgText);
      } catch (e) {}
      return msgText;
    }

    if (node.type === 'buttons') {
      const btnText = (node.data.buttons || []).map((b: string, i: number) => `🔹 *${i+1}.* ${b}`).join('\n');
      const fullMsg = `Selecciona una de las siguientes opciones:\n\n${btnText}`;
      await sendMsg(phone, fullMsg);
      try {
        await db.addMessage(leadId, 'bot', fullMsg);
      } catch (e) {}
      return fullMsg;
    }

    // --- NODO: ESPERAR / WAIT DELAY ---
    if (node.type === 'waitDelay') {
      const delayHours = Number(node.data.delayHours || 24);
      const followUpMessage = node.data.message || `Hola, te escribimos para hacer un seguimiento de tu consulta sobre Fuxion Perú. ¿Pudiste revisar la información que te compartimos? ¿Te animaste con el Thermo T3 o el Prunex1? 😊`;
      const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
      const remId = `rem-flow-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      try {
        await db.addReminder(remId, leadId, followUpMessage, scheduledAt);
        console.log(`[WhatsAppService] waitDelay node: reminder scheduled in ${delayHours}h for lead ${leadId}`);
      } catch (err) {
        console.error('[WhatsAppService] Error creating waitDelay reminder:', err);
      }
      // Advance flow to next node if any
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) this.flowState.set(leadId, nextEdge.target);
      else this.flowState.delete(leadId);
      return null; // No immediate message
    }

    // --- NODO: CUPÓN / COUPON ---
    if (node.type === 'coupon') {
      const code = node.data.code || 'FUXION10';
      const product = node.data.product || 'Thermo T3 o Prunex1';
      const expiryHours = Number(node.data.expiryHours || 48);
      const expiryDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      const expiryStr = expiryDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const couponMsg = node.data.message ||
        `🎁 *¡Oferta exclusiva para ti!*\n\n` +
        `Como parte de nuestra comunidad Fuxion Perú, tienes acceso a un descuento especial en *${product}*.\n\n` +
        `🏷️ Usa el código: *${code}*\n` +
        `⏰ Válido hasta: ${expiryStr}\n\n` +
        `¡Escríbenos ahora para aprovechar esta oferta antes de que expire! 🔥`;
      await sendMsg(phone, couponMsg);
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) this.flowState.set(leadId, nextEdge.target);
      else this.flowState.delete(leadId);
      return couponMsg;
    }

    // --- NODO: CONDICIÓN LÓGICA / LOGIC JUMP ---
    if (node.type === 'logicJump') {
      const tagToCheck = node.data.tag || '';
      const lead = await db.getLeadById(leadId);
      const leadTags: string[] = lead?.tags || [];
      const hasTag = leadTags.includes(tagToCheck);
      
      const sourceHandle = hasTag ? 'yes' : 'no';
      const nextEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === sourceHandle);
      
      if (nextEdge) {
        this.flowState.set(leadId, nextEdge.target);
        return await this.processFlowNode(leadId, nextEdge.target, nodes, edges, phone, sendMessageFn);
      }
      this.flowState.delete(leadId);
      return null;
    }

    // --- NODO: PROGRAMAR ENVÍO / DELIVERY ENGINE ---
    if (node.type === 'deliveryEngine') {
      const today = new Date();
      const d24 = new Date(today);
      d24.setDate(today.getDate() + 1);
      const d48 = new Date(today);
      d48.setDate(today.getDate() + 2);
      
      const options = { weekday: 'long', day: 'numeric', month: 'long' } as const;
      const t24 = d24.toLocaleDateString('es-PE', options);
      const t48 = d48.toLocaleDateString('es-PE', options);
      
      const deliveryMsg = `🚚 *Opciones de Entrega Fuxion Flow:*\n\n` +
        `1. *Entrega Express (24h):* Disponible el *${t24}*\n` +
        `2. *Entrega Regular (48h):* Disponible el *${t48}*\n\n` +
        `¿Cuál prefieres para programar tu envío?`;
      
      await sendMsg(phone, deliveryMsg);
      
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) {
        this.flowState.set(leadId, nextEdge.target);
      } else {
        this.flowState.delete(leadId);
      }
      return deliveryMsg;
    }

    // --- NODO: CAMBIAR ESTADO / UPDATE STATUS ---
    if (node.type === 'updateStatus') {
      const newStatus = node.data.status || 'Engaged';
      try {
        await db.updateLeadStatus(leadId, newStatus);
        console.log(`[WhatsAppService] updateStatus node: lead ${leadId} → ${newStatus}`);
      } catch (err) {
        console.error('[WhatsAppService] Error in updateStatus node:', err);
      }
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) {
        this.flowState.set(leadId, nextEdge.target);
        return await this.processFlowNode(leadId, nextEdge.target, nodes, edges, phone, sendMessageFn);
      }
      this.flowState.delete(leadId);
      return null;
    }

    // --- NODO: ALERTAR AGENTE / ALERT AGENT ---
    if (node.type === 'alertAgent') {
      const alertMsg = node.data.message || `🔔 Alerta: Un cliente requiere atención manual en el flujo de ventas.`;
      
      // 1. Envío por correo electrónico SMTP
      try {
        await sendEmailNotification(
          `🚨 ALERTA DE AGENTE: Cliente ${phone} requiere atención`,
          `Un cliente activó la alerta de atención manual en el flujo:\n\n📱 Teléfono: ${phone}\n📝 Mensaje: ${alertMsg}\n\nPor favor ingresa a la Bandeja de Entrada para responder.`
        );
        console.log(`[WhatsAppService] alertAgent node: enviado correo de alerta SMTP para el cliente ${phone}`);
      } catch (e: any) {
        console.error('[WhatsAppService] Error enviando correo en alertAgent:', e?.message || e);
      }

      // 2. Envío opcional por WhatsApp al Admin si está configurado
      const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
      if (adminPhone) {
        try {
          await sendMsg(adminPhone, `[Alerta de Flujo — Asistente Virtual]\nCliente: ${phone}\n\n${alertMsg}`);
          console.log(`[WhatsAppService] alertAgent node: sent alert to admin ${adminPhone}`);
        } catch (err) {
          console.error('[WhatsAppService] Error sending alertAgent message:', err);
        }
      }
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) {
        this.flowState.set(leadId, nextEdge.target);
        return await this.processFlowNode(leadId, nextEdge.target, nodes, edges, phone, sendMessageFn);
      }
      this.flowState.delete(leadId);
      return null;
    }

    this.flowState.delete(leadId);
    return null;
  }

  public async sendMessageToPhone(phone: string, text: string, mediaUrl?: string, jidOverride?: string) {
    if (!text || !text.toString().trim()) throw new Error('Message text is required');
    // Última barrera anti-fuga: ningún <think>/prompt/tag interno sale al cliente,
    // aunque el caller olvide sanitizar (flujos, broadcasts, IA directa).
    const safeText = stripInternalTagsForSending(sanitizeAiReply(text.toString()));
    if (!safeText) throw new Error('Message text is empty after sanitization');
    // jidOverride evita la heurística por longitud (clave para LIDs y números internacionales largos)
    const jid = jidOverride || this.getWhatsappJid(phone);
    if (!this.socket) {
      await this.initialize();
    }
    if (!this.socket || this.status !== 'connected') {
      throw new Error('WhatsApp socket is not connected or authenticated');
    }
    if (mediaUrl) {
      // Baileys solo entiende Buffer, data:, http(s) o ruta de archivo real.
      // Una ruta web /uploads/... (con opcional subdirectorio status/) se resuelve
      // a Buffer desde public/uploads.
      let imageSource: unknown = { url: mediaUrl };
      try {
        if (typeof mediaUrl === 'string' && mediaUrl.startsWith('/uploads/')) {
          const req = eval('require') as NodeRequire;
          const pathMod = req('path');
          const fsMod = req('fs');
          const rest = mediaUrl.slice('/uploads/'.length);
          const segs = rest.split('/');
          if (
            !rest || rest.includes('\\') || rest.includes('..') || segs.some((s: string) => !s) ||
            segs.length > 2 || (segs.length === 2 && segs[0] !== 'status')
          ) {
            throw new Error('Ruta de imagen inválida');
          }
          const localPath = pathMod.join(process.cwd(), 'public', 'uploads', ...segs);
          if (fsMod.existsSync(localPath)) {
            imageSource = fsMod.readFileSync(localPath);
          } else {
            // En Cloud Run: recuperar desde Supabase (db.system_settings)
            try {
              const rel = segs.join('/');
              const filename = segs[segs.length - 1];
              const saved = (await db.getSystemSetting(`media:${rel}`)) || (await db.getSystemSetting(`media:${filename}`));
              if (saved && typeof saved === 'string' && saved.startsWith('data:')) {
                const b64 = saved.split(',')[1] || '';
                if (b64) {
                  const restored = Buffer.from(b64, 'base64');
                  imageSource = restored;
                  try {
                    const parentDir = pathMod.dirname(localPath);
                    if (!fsMod.existsSync(parentDir)) fsMod.mkdirSync(parentDir, { recursive: true });
                    fsMod.writeFileSync(localPath, restored);
                  } catch (_) {}
                }
              }
            } catch (dbErr) {
              console.warn('[WhatsAppService] Falló recuperación de imagen desde DB:', dbErr);
            }
          }
        } else if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:')) {
          const base64 = mediaUrl.split(',')[1] || '';
          if (!base64) throw new Error('Imagen data: inválida');
          imageSource = Buffer.from(base64, 'base64');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`No se pudo leer la imagen adjunta (${msg})`);
      }
      return this.socket.sendMessage(jid, {
        image: imageSource,
        caption: safeText
      });
    }
    return this.socket.sendMessage(jid, { text: safeText });
  }

  public async sendWhatsAppButtons(phone: string, bodyText: string, buttonTexts: string[]) {
    if (!this.socket) await this.initialize();
    if (!this.socket || this.status !== 'connected') throw new Error('WhatsApp socket is not connected or authenticated');
    
    const jid = this.getWhatsappJid(phone);
    
    // WhatsApp permite máximo 3 botones
    const buttons = buttonTexts.slice(0, 3).map((text, index) => ({
      buttonId: `btn-${index}`,
      buttonText: { displayText: text },
      type: 1
    }));

    return this.socket.sendMessage(jid, {
      buttonsMessage: {
        contentText: bodyText,
        footerText: 'Fuxion Flow CRM',
        buttons: buttons,
        headerType: 1
      }
    });
  }

  public async sendMessageToLead(leadId: string, text: string) {
    const lead = await db.getLeadById(leadId);
    if (!lead || !lead.phone) {
      throw new Error('Lead not found or missing phone');
    }
    return this.sendMessageToPhone(lead.phone, text);
  }

  public async publishStatusToWhatsApp(options: {
    mediaUrl: string;
    mediaType?: string;
    caption?: string;
  }) {
    const { mediaUrl, mediaType = 'image', caption = '' } = options;
    if (!mediaUrl) throw new Error('Se requiere un archivo multimedia para publicar el estado de WhatsApp.');

    if (!this.socket) await this.initialize();
    if (!this.socket || this.status !== 'connected') {
      throw new Error('WhatsApp no está conectado o autenticado.');
    }

    const path = await import('path');
    const fs = await import('fs');

    let mediaBuffer: Buffer | null = null;
    let mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

    // 1. Resolver Buffer desde archivo local o URL
    if (mediaUrl.startsWith('data:')) {
      const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        mediaBuffer = Buffer.from(match[2], 'base64');
      }
    } else if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('uploads/')) {
      const cleanRel = mediaUrl.startsWith('/') ? mediaUrl.slice(1) : mediaUrl;
      const localPath = path.join(process.cwd(), 'public', cleanRel);
      if (fs.existsSync(localPath)) {
        try {
          mediaBuffer = fs.readFileSync(localPath);
        } catch (readErr) {
          console.warn('[WhatsAppService] Error leyendo archivo local de estado:', readErr);
        }
      }

      // En Cloud Run: si el archivo no existe en el disco temporal del contenedor, recuperarlo de Supabase
      if (!mediaBuffer) {
        try {
          const segs = cleanRel.replace(/^uploads\//, '');
          const filename = path.basename(cleanRel);
          console.log(`[WhatsAppService] ☁️ Buscando estado en Supabase para Cloud Run: media:${segs} o media:${filename}`);
          const savedDataUri = (await db.getSystemSetting(`media:${segs}`)) || (await db.getSystemSetting(`media:${filename}`));
          if (savedDataUri && typeof savedDataUri === 'string' && savedDataUri.startsWith('data:')) {
            const base64Data = savedDataUri.split(',')[1];
            if (base64Data) {
              mediaBuffer = Buffer.from(base64Data, 'base64');
              console.log(`[WhatsAppService] ✅ Estado multimedia recuperado con éxito desde Supabase (${mediaBuffer.length} bytes)`);
              // Restaurar archivo en disco temporal del contenedor para lecturas subsiguientes
              try {
                const parentDir = path.dirname(localPath);
                if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
                fs.writeFileSync(localPath, mediaBuffer);
              } catch (_) {}
            }
          }
        } catch (dbErr) {
          console.warn('[WhatsAppService] Falló recuperación de estado desde DB:', dbErr);
        }
      }

      if (localPath.endsWith('.png')) mimeType = 'image/png';
      else if (localPath.endsWith('.webp')) mimeType = 'image/webp';
      else if (localPath.endsWith('.mp4')) mimeType = 'video/mp4';
    } else if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      try {
        const fetchRes = await fetch(mediaUrl);
        if (fetchRes.ok) {
          const contentType = fetchRes.headers.get('content-type');
          if (contentType) mimeType = contentType;
          const arrayBuf = await fetchRes.arrayBuffer();
          mediaBuffer = Buffer.from(arrayBuf);
        }
      } catch (fetchErr) {
        console.warn('[WhatsAppService] Error fetching remote media for status:', fetchErr);
      }
    } else if (fs.existsSync(mediaUrl)) {
      mediaBuffer = fs.readFileSync(mediaUrl);
      if (mediaUrl.endsWith('.png')) mimeType = 'image/png';
      else if (mediaUrl.endsWith('.webp')) mimeType = 'image/webp';
      else if (mediaUrl.endsWith('.mp4')) mimeType = 'video/mp4';
    }

    const isVideo = mediaType === 'video' || mimeType.startsWith('video/') || Boolean(mediaUrl.match(/\.(mp4|mov|webm|avi)$/i));
    const statusJid = 'status@broadcast';

    // Si el medio no se pudo resolver a buffer y no es una URL pública, fallar con
    // mensaje claro en vez de enviar un payload que WhatsApp rechaza en silencio.
    const isPublicUrl = mediaUrl.startsWith('https://');
    if (!mediaBuffer && !isPublicUrl) {
      throw new Error(
        `No se pudo leer el archivo del estado (${mediaUrl}). ` +
        'Si es un archivo subido, verifica que exista en public/uploads.'
      );
    }

    // 2. Obtener lista de destinatarios (contactos válidos + número propio para verlo en el propio teléfono)
    const jidSet = new Set<string>();

    // Incluir propio usuario SIEMPRE (aunque sea LID): sin esto el estado se publica
    // pero no aparece en el propio teléfono y parece que "no lo hace".
    const myId = this.socket?.user?.id;
    if (myId) {
      const myBare = myId.split(':')[0].split('@')[0];
      const mySuffix = myId.includes('@lid') ? '@lid' : '@s.whatsapp.net';
      if (myBare.replace(/\D/g, '')) {
        jidSet.add(`${myBare.replace(/\D/g, '')}${mySuffix}`);
      }
      const myClean = myBare.replace(/\D/g, '');
      if (myClean && myClean.length <= 13) {
        jidSet.add(`${myClean}@s.whatsapp.net`);
      }
    }

    try {
      const leads = await db.getLeads();
      for (const l of leads) {
        let rawPhone = l.real_phone || l.phone || l.id || '';
        
        // Si el teléfono es un LID (14-15 dígitos), intentar resolverlo a través del mapa de memoria
        if (rawPhone.length >= 14 && this.lidToPhoneMap.has(rawPhone)) {
          rawPhone = this.lidToPhoneMap.get(rawPhone) || rawPhone;
        }

        let clean = rawPhone.replace(/\D/g, '');
        if (clean.length === 9 && clean.startsWith('9')) {
          clean = '51' + clean;
        }

        // Solo agregar números telefónicos reales E.164 válidos (entre 9 y 13 dígitos)
        if (clean && clean.length >= 9 && clean.length <= 13) {
          jidSet.add(`${clean}@s.whatsapp.net`);
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] No se pudieron cargar leads para statusJidList:', e);
    }

    // Filtrar destinatarios que realmente existen en WhatsApp para evitar 'No sessions'
    const candidateList = Array.from(jidSet);
    const validJids: string[] = [];

    try {
      if (typeof this.socket?.onWhatsApp === 'function' && candidateList.length > 0) {
        const results = await this.socket.onWhatsApp(...candidateList);
        if (Array.isArray(results)) {
          for (const r of results) {
            if (r && r.exists && r.jid) {
              validJids.push(r.jid);
            }
          }
        }
      }
    } catch (verErr) {
      console.warn('[WhatsAppService] onWhatsApp verification warning:', verErr);
    }

    const statusJidList = validJids.length > 0 ? validJids : candidateList;
    console.log(`[WhatsAppService] 📱 Publicando estado oficial de WhatsApp (${isVideo ? 'Video' : 'Imagen'}) para ${statusJidList.length} contactos verificados:`, statusJidList);

    const sendOptions: any = {
      broadcast: true
    };
    if (statusJidList.length > 0) {
      sendOptions.statusJidList = statusJidList;
    }

    if (isVideo) {
      const videoPayload: any = mediaBuffer 
        ? { video: mediaBuffer, caption: caption || '', mimetype: mimeType } 
        : { video: { url: mediaUrl }, caption: caption || '', mimetype: mimeType };
      const msgId = await this.socket.sendMessage(statusJid, videoPayload, sendOptions);
      console.log(`[WhatsAppService] ✅ Estado (video) enviado. ID: ${msgId}. Visible para ${statusJidList.length} contactos.`);
      return msgId;
    } else {
      const imagePayload: any = mediaBuffer 
        ? { image: mediaBuffer, caption: caption || '', mimetype: mimeType } 
        : { image: { url: mediaUrl }, caption: caption || '', mimetype: mimeType };
      const msgId = await this.socket.sendMessage(statusJid, imagePayload, sendOptions);
      console.log(`[WhatsAppService] ✅ Estado (imagen) enviado. ID: ${msgId}. Visible para ${statusJidList.length} contactos.`);
      return msgId;
    }
  }

  public async checkAndProcessPendingStatuses() {
    if (!this.socket || this.status !== 'connected') return;
    try {
      const pending = await db.getPendingStatusSchedules();
      if (pending && pending.length > 0) {
        console.log(`[Status Cron Engine] ⏰ Procesando ${pending.length} estados programados pendientes...`);
        for (const item of pending) {
          try {
            await this.publishStatusToWhatsApp({
              mediaUrl: item.media_url,
              mediaType: item.media_type,
              caption: item.caption
            });
            await db.markStatusSchedulePublished(item.id);
            console.log(`[Status Cron Engine] ✅ Estado ${item.id} publicado con éxito.`);
          } catch (err: any) {
            console.error(`[Status Cron Engine] ❌ Error al publicar estado ${item.id}:`, err);
            await db.markStatusSchedulePublished(item.id, err?.message || 'Error en publicación');
          }
        }
      }
    } catch (e) {
      console.error('[Status Cron Engine] Error al verificar estados pendientes:', e);
    }
  }

  private async extractMessageText(incoming: any, baileysModule?: any): Promise<string | null> {
    const message = incoming?.message;
    if (!message || typeof message !== 'object') return null;

    const messageTypes = [
      'conversation',
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'documentMessage',
      'audioMessage',
      'stickerMessage',
      'buttonsResponseMessage',
      'templateButtonReplyMessage',
      'listResponseMessage',
      'reactionMessage'
    ];

    for (const type of messageTypes) {
      if (message[type]) {
        const payload = message[type];
        if (type === 'conversation') return payload;
        if (type === 'extendedTextMessage') return payload?.text || payload?.contextInfo?.quotedMessage?.conversation || null;
        if (type === 'imageMessage' || type === 'videoMessage' || type === 'documentMessage' || type === 'audioMessage') {
          let mediaUrl = '';
          
          if (baileysModule && typeof baileysModule.downloadMediaMessage === 'function') {
            try {
              const buffer = await baileysModule.downloadMediaMessage(incoming, 'buffer', {});
              if (buffer && buffer.length > 0) {
                const mime = type === 'audioMessage' ? 'audio/ogg' : 'image/jpeg';
                mediaUrl = `data:${mime};base64,${buffer.toString('base64')}`;
              }
            } catch (err) {
              console.warn('[WhatsAppService] No se pudo desencriptar buffer multimedia con downloadMediaMessage:', err);
            }
          }

          // Fallback a jpegThumbnail o base64 embebido si downloadMediaMessage falla o es lento
          if (!mediaUrl && payload?.jpegThumbnail) {
            const thumbBase64 = Buffer.isBuffer(payload.jpegThumbnail)
              ? payload.jpegThumbnail.toString('base64')
              : String(payload.jpegThumbnail);
            mediaUrl = thumbBase64.startsWith('data:') ? thumbBase64 : `data:image/jpeg;base64,${thumbBase64}`;
          }

          if (!mediaUrl && payload?.base64) {
            mediaUrl = payload.base64.startsWith('data:') ? payload.base64 : `data:image/jpeg;base64,${payload.base64}`;
          }

          let transcription = '';
          if (type === 'audioMessage' && mediaUrl) {
            try {
              const { transcribeAudioFile } = require('./gemini');
              if (typeof transcribeAudioFile === 'function') {
                const textResult = await transcribeAudioFile(mediaUrl, 'audio/ogg');
                if (textResult && textResult.trim().length > 0) {
                  transcription = textResult.trim();
                  console.log('[WhatsAppService] 🎙️ Audio de voz transcrito exitosamente con Gemini:', transcription);
                }
              }
            } catch (sttErr) {
              console.error('[WhatsAppService] Error al transcribir audio de voz:', sttErr);
            }
          }

          const caption = payload?.caption ? `${payload.caption} ` : '';
          if (type === 'imageMessage') return mediaUrl ? `[Foto] ${caption}${mediaUrl}`.trim() : `[Foto] ${caption}`.trim();
          if (type === 'audioMessage') {
            const transSuffix = transcription ? `\n[Transcripción de Voz]: "${transcription}"` : '';
            return mediaUrl ? `[Audio] ${mediaUrl}${transSuffix}`.trim() : `[Audio]${transSuffix}`.trim();
          }
          if (type === 'documentMessage') return mediaUrl ? `[Documento] ${caption}${mediaUrl}`.trim() : `[Documento] ${caption}`.trim();
          if (type === 'videoMessage') return mediaUrl ? `[Video] ${caption}${mediaUrl}`.trim() : `[Video] ${caption}`.trim();
          return null;
        }
        if (type === 'stickerMessage') return 'Hola';
        if (type === 'buttonsResponseMessage') return payload?.selectedButtonId || payload?.selectedDisplayText || null;
        if (type === 'templateButtonReplyMessage') return payload?.selectedId || payload?.selectedDisplayText || null;
        if (type === 'listResponseMessage') return payload?.singleSelectReply?.selectedRowId || payload?.singleSelectReply?.title || null;
        if (type === 'reactionMessage') return payload?.text || null;
      }
    }

    if (message.locationMessage || message.liveLocationMessage) {
      const loc = message.locationMessage || message.liveLocationMessage;
      return `[Ubicación: lat ${loc?.degreesLatitude || ''}, lon ${loc?.degreesLongitude || ''}]`;
    }
    if (message.contactMessage || message.contactsArrayMessage) {
      return '[Contacto compartido]';
    }
    if (message.interactiveResponseMessage) {
      const ir = message.interactiveResponseMessage;
      try {
        const params = JSON.parse(ir?.nativeFlowResponseMessage?.paramsJson || '{}');
        return params?.id || ir?.body?.text || 'Hola';
      } catch (_) {
        return ir?.body?.text || 'Hola';
      }
    }

    return null;
  }

  public async getQrDataUrl(timeoutMs: number = DEFAULT_QR_TIMEOUT_MS): Promise<string | null> {
    if (this.latestQrText) {
      return this.buildQrDataUrl(this.latestQrText);
    }
    if (this.status === 'connected' || this.status === 'open') {
      return null;
    }
    if (this.status === 'logged_out') {
      throw new Error(this.error || 'Sesión de WhatsApp cerrada. Vincula de nuevo con el código QR.');
    }

    // Si el estado es desconectado o no hay socket activo, inicializar usando credenciales existentes
    if (!this.socket && !this.initPromise) {
      this.initialize(false).catch(err => console.error('[WhatsAppService] Error initializing for QR:', err));
    }

    // Si la inicialización está en progreso, esperar a que la promesa se resuelva
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (e) {
        console.warn('[WhatsAppService] Error en la promesa de inicialización:', e);
      }
    }

    if (this.latestQrText) {
      return this.buildQrDataUrl(this.latestQrText);
    }

    try {
      const qrText = await this.waitForQr(timeoutMs);
      return this.buildQrDataUrl(qrText);
    } catch (err: any) {
      const msg = err?.message || 'Timeout esperando el QR';
      console.warn('[WhatsAppService] Timeout o error al esperar QR:', msg);
      throw new Error(`${msg} (estado: ${this.status ?? 'desconocido'})`);
    }
  }

  public async reset() {
    // Invalidar cualquier socket/timer pendiente: sus eventos 'close' tardíos
    // ya no podrán disparar reconexiones (ver generación en connection.update).
    this.generation++;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isResetting = true;
    if (this.socket) {
      try {
        // logout() puede colgarse si el socket está en mal estado: timeout de 6s y
        // limpieza forzada igual (antes esto dejaba la sesión "igual" para siempre).
        if (typeof this.socket.logout === 'function') {
          await Promise.race([
            this.socket.logout().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 6000)),
          ]);
        } else if (typeof this.socket.end === 'function') {
          try {
            this.socket.end();
          } catch (e) {}
        }
      } catch (e) {}
      // Cerrar listeners y socket viejo aunque logout haya fallado
      try {
        const ev = this.socket?.ev;
        if (ev && typeof ev.removeAllListeners === 'function') {
          ev.removeAllListeners('messages.upsert');
          ev.removeAllListeners('connection.update');
          ev.removeAllListeners('creds.update');
          ev.removeAllListeners('contacts.upsert');
          ev.removeAllListeners('contacts.update');
        }
        if (typeof this.socket?.end === 'function') {
          try {
            this.socket.end();
          } catch (e) {}
        } else if (this.socket?.ws && typeof this.socket.ws.close === 'function') {
          try {
            this.socket.ws.close();
          } catch (e) {}
        }
      } catch (e) {}
    }

    // Limpiar cachés de sesión: pertenecen a la cuenta anterior. Sin esto, al
    // vincular OTRO número se reutilizan mapeos LID y ecos viejos.
    this.lidToPhoneMap.clear();
    this.processedMessageIds.clear();
    this.recentBotMessages.clear();

    try {
      await db.clearWhatsappSession('default');
    } catch (error: any) {
      console.error('Failed to clear WhatsApp session from database during reset:', error?.message || error);
    }

    // Limpieza completa de credenciales locales de Baileys
    this.clearAuthFolder();

    this.socket = null;
    this.initPromise = null;
    this.latestQrText = null;
    this.latestQrDataUrl = null;
    this.status = 'disconnected';
    this.error = null;
    this.rejectQrWaiters(new Error('WhatsApp service reset'));
    // Nota: isResetting se libera en initialize() al arrancar el socket nuevo.
    // Sin initialize() posterior, queda en true y bloquea reconexiones: correcto
    // tras un logout manual.
  }
}

const globalAny = globalThis as any;
if (!globalAny.__whatsappService || typeof globalAny.__whatsappService.publishStatusToWhatsApp !== 'function') {
  globalAny.__whatsappService = new WhatsAppService();
}

export const whatsappService: WhatsAppService = globalAny.__whatsappService;
