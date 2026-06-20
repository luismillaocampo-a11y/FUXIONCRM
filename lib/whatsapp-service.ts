import QRCode from 'qrcode';
import { useSupabaseAuthState } from './whatsapp-auth-store';
import { db } from './db';

const DEFAULT_QR_TIMEOUT_MS = Number(process.env.WHATSAPP_QR_TIMEOUT_MS || '30000');

type QrWaiter = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class WhatsAppService {
  private initPromise: Promise<void> | null = null;
  private socket: any | null = null;
  public latestQrText: string | null = null;
  private latestQrDataUrl: string | null = null;
  public status: string | null = null;
  public error: string | null = null;
  private qrWaiters: QrWaiter[] = [];

  public async initialize() {
    if (this.socket) return;
    if (this.initPromise) return this.initPromise;
    this.status = 'connecting';
    this.error = null;
    this.latestQrText = null;
    this.latestQrDataUrl = null;
    this.initPromise = (async () => {
      try {
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.makeWASocket;

        // Use Supabase-backed auth state (no filesystem)
        const { state, saveCreds } = await useSupabaseAuthState('default');

        const sock = makeWASocket({
          auth: state,
          printQRInTerminal: false,
          browser: ['NutraflowCRM', 'Desktop', '1.0']
        });

        // Persist credentials to Supabase when Baileys emits updates
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (messageUpdate: any) => {
          try {
            if (messageUpdate.type !== 'notify' || !Array.isArray(messageUpdate.messages)) return;

            for (const incoming of messageUpdate.messages) {
              const key = incoming?.key || {};
              const message = incoming?.message;
              if (!message || !key.remoteJid) continue;

              const remoteJid = key.remoteJid.toString();
              if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue;
              if (incoming.key?.fromMe) continue;
              if (message.protocolMessage || message.messageStubType) continue;

              const text = this.extractMessageText(message);
              if (!text) continue;

              const phone = remoteJid.split('@')[0];
              const leadId = phone;
              const leadName = incoming.pushName || `WhatsApp ${phone}`;

              await db.upsertLead({ id: leadId, name: leadName, phone, status: 'New', tags: [], bot_active: true });
              await db.addMessage(leadId, 'customer', text);
              console.log('Saved incoming WhatsApp message for lead', leadId, 'text:', text.slice(0, 100));
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
    this.latestQrDataUrl = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      width: 420
    });
    return this.latestQrDataUrl;
  }

  private extractMessageText(message: any): string | null {
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
          return payload?.caption || null;
        }
        if (type === 'stickerMessage') return payload?.url ? 'Sticker' : null;
        if (type === 'buttonsResponseMessage') return payload?.selectedButtonId || payload?.selectedDisplayText || null;
        if (type === 'templateButtonReplyMessage') return payload?.selectedId || payload?.selectedDisplayText || null;
        if (type === 'listResponseMessage') return payload?.singleSelectReply?.selectedRowId || payload?.singleSelectReply?.title || null;
        if (type === 'reactionMessage') return payload?.text || null;
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
    const qrText = await this.waitForQr(timeoutMs);
    return this.buildQrDataUrl(qrText);
  }

  public async reset() {
    if (this.socket && typeof this.socket.logout === 'function') {
      await this.socket.logout().catch(() => {});
    }

    try {
      await db.clearWhatsappSession('default');
    } catch (error: any) {
      console.error('Failed to clear WhatsApp session from database during reset:', error?.message || error);
    }
    // No filesystem cleanup here — session persistence is handled via Supabase
    this.socket = null;
    this.initPromise = null;
    this.latestQrText = null;
    this.latestQrDataUrl = null;
    this.status = 'restarting';
    this.error = null;
    this.rejectQrWaiters(new Error('WhatsApp service reset'));
  }
}

const globalAny = globalThis as any;
const singleton = globalAny.__whatsappService || new WhatsAppService();
if (!globalAny.__whatsappService) {
  globalAny.__whatsappService = singleton;
}

export const whatsappService = singleton;
