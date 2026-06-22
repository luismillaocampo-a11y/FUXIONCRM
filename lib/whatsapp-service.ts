import QRCode from 'qrcode';
import { useSupabaseAuthState } from './whatsapp-auth-store';
import { db } from './db';
import { queryKnowledgeBase } from './gemini';

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
  private isResetting = false;
  private wasConnected = false;
  private flowState = new Map<string, string>(); // Guarda en qué nodo del flujo está cada cliente

  public async initialize(force: boolean = false) {
    if (force) {
      console.log('[WhatsAppService] Inicialización forzada. Desconectando sockets y promesas anteriores...');
      if (this.socket) {
        try {
          this.socket.end();
        } catch (e) {}
        this.socket = null;
      }
      this.initPromise = null;
      this.wasConnected = false;
    }

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
          browser: ['NutraflowCRM', 'Desktop', '1.0'],
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 30000
        });

        // Persist credentials to Supabase when Baileys emits updates
        sock.ev.on('creds.update', saveCreds);

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

            for (const incoming of messagesToProcess) {
              const key = incoming?.key || {};
              const message = incoming?.message;
              if (!message || (!key.remoteJid && !key.remoteJidAlt)) continue;

              const hasAlt = !!key.remoteJidAlt;
              const phoneJid = hasAlt ? key.remoteJidAlt.toString() : key.remoteJid.toString();
              const lidJid = hasAlt ? key.remoteJid.toString() : null;

              if (phoneJid === 'status@broadcast' || phoneJid.endsWith('@broadcast') || phoneJid.endsWith('@g.us')) continue;
              const fromMe = incoming.key?.fromMe ?? false;
              if (message.protocolMessage || message.messageStubType) continue;

              // Extract text directly. No cleaning or sanitization is done here,
              // ensuring full preservation of special characters and utf8mb4 emojis (e.g. 🥺).
              console.log('[WhatsAppService] 🔍 Debug - fromMe:', fromMe, 'rawMsg:', JSON.stringify(message));
              let text = this.extractMessageText(message);
              if (!text) {
                console.warn('[WhatsAppService] ⚠️ Texto vacío. fromMe:', fromMe);
                if (fromMe) {
                  text = message?.conversation || message?.extendedTextMessage?.text || '';
                }
                if (!text) continue;
              }

              let phone = this.getPhoneFromWhatsappId(phoneJid);
              let lid = lidJid ? this.getPhoneFromWhatsappId(lidJid) : null;

              // Normalización Universal de JID tipo LID
              if (phoneJid.endsWith('@lid') && phone) {
                const normalizedPhoneJid = await db.normalizeJid(phoneJid);
                if (normalizedPhoneJid !== phoneJid) {
                  lid = phone;
                  phone = this.getPhoneFromWhatsappId(normalizedPhoneJid);
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

              console.log('[WhatsAppService] 📱 Phone:', phone, 'Lid:', lid);
              if (!phone) {
                console.error('[WhatsAppService] ERROR: No se pudo extraer el remitente del mensaje. Mensaje completo:', JSON.stringify(incoming, null, 2));
                continue;
              }

              // Ignorar números de prueba de Meta/Sandbox (141532090908916), pero solo si no están mapeados a un cliente real
              if ((phone === '141532090908916' || phone.startsWith('1415')) && !lid) {
                console.log('[WhatsAppService] Ignorando número de prueba de Meta/Sandbox:', phone);
                continue;
              }

              const leadId = phone;
              const leadName = incoming.pushName || `WhatsApp ${phone}`;
              const sender = fromMe ? 'agent' : 'customer';
              const msgId = incoming.key?.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

              // Guardar/actualizar cliente si no existe o si el mensaje es del cliente para actualizar sus datos
              const leadExists = await db.getLeadById(leadId);
              if (!leadExists || sender === 'customer') {
                await db.upsertLead({ 
                  id: leadId, 
                  name: leadName, 
                  phone, 
                  whatsapp_lid: lid,
                  status: 'New', 
                  tags: [], 
                  bot_active: true 
                });
              }

              await db.addMessage(leadId, sender, text, msgId);
              console.log(`[WhatsAppService] ✅ Mensaje GUARDADO en BD. Lead: ${leadId}, Sender: ${sender}`);
              console.log(`Saved WhatsApp message for lead ${leadId}: sender = ${sender}, text:`, text.slice(0, 100));

              // ==========================================
              // FLUJO AUTOMÁTICO vs IA (Gemini)
              // ==========================================
              if (sender === 'customer' && leadExists?.bot_active) {
                try {
                  const flowContext = { overrideText: null };
                  const flowReply = await this.executeActiveFlow(leadId, text, phone, flowContext);
                  
                  if (flowReply) {
                    // El flujo envió bienvenida o botones. NO guardar en BD aquí, el eco de WhatsApp (append) lo hará para evitar duplicados.
                    console.log(`[WhatsAppService] 🔀 Flujo ejecutado para ${leadId}`);
                  } else {
                    // 2. SI NO HAY FLUJO, USAR IA (GEMINI RAG)
                    // Usar el texto real o el texto del botón seleccionado
                    const textForAI = flowContext.overrideText || text;
                    const recentMsgs = await db.getMessages(leadId);
                    const history = recentMsgs.slice(-5).map((m: any) => ({ sender: m.sender, message: m.message }));
                    const reply = await queryKnowledgeBase(textForAI, history);

                    if (reply.trim() === '[UNKNOWN]') {
                      console.log(`[WhatsAppService] ⚠️ IA no pudo responder. Activando Shadow Mode para ${leadId}`);
                      await db.updateLeadBotActive(leadId, false);
                      let newStatus = 'Engaged';
                      const lowerText = textForAI.toLowerCase();
                      if (lowerText.includes('pay') || lowerText.includes('comprar') || lowerText.includes('pago')) newStatus = 'Pending Verification';
                      await db.updateLeadStatus(leadId, newStatus);

                      const contextSnippet = history.slice(-4).map((m: any) => `${m.sender}: ${m.message}`).join('\n');
                      const gapId = `gap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                      await db.addGap(gapId, leadId, textForAI, contextSnippet);

                      const fallbackReply = 'Lo siento, no tengo esa información en este momento. Un agente humano revisará su pregunta y le responderá a la brevedad.';
                      await db.addMessage(leadId, 'bot', fallbackReply);
                      await this.sendMessageToPhone(phone, fallbackReply);
                    } else {
                      console.log(`[WhatsAppService] 🤖 Bot (Gemini) respondiendo a ${leadId}: ${reply.slice(0, 60)}...`);
                      await db.addMessage(leadId, 'bot', reply);
                      await this.sendMessageToPhone(phone, reply);
                    }
                  }
                } catch (aiError) {
                  console.error('[WhatsAppService] Error en flujo/IA:', aiError);
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
            this.status = 'disconnected';
            
            const loggedOut = statusCode === baileys.DisconnectReason?.loggedOut || statusCode === 401;
            
            // Reintentar solo si ya estaba conectado y no es un logout manual
            if (this.wasConnected && !loggedOut && !this.isResetting) {
              console.log(`Auto-reconnect triggered: socket closed with status ${statusCode}. Reconnecting in 5s...`);
              setTimeout(() => {
                this.initialize().catch((err) => console.error('Error in WhatsApp auto-reconnect:', err));
              }, 5000);
            } else {
              console.log(`Auto-reconnect skipped: wasConnected=${this.wasConnected}, loggedOut=${loggedOut}, isResetting=${this.isResetting}`);
              this.latestQrText = null;
              this.latestQrDataUrl = null;
            }
            // Resetear el flag de conexión
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
    this.latestQrDataUrl = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      width: 420
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

  private getWhatsappJid(phone: string): string {
    if (!phone || typeof phone !== 'string') throw new Error('Invalid WhatsApp phone');
    const raw = phone.replace(/\D/g, '');
    if (!raw) throw new Error('Invalid WhatsApp phone');
    return `${raw}@s.whatsapp.net`;
  }

  // --- MOTOR DE FLUJOS BACKEND ---
  private async executeActiveFlow(leadId: string, text: string, phone: string, flowContext: { overrideText: string | null }): Promise<string | null> {
    const flow = await db.getActiveFlow();
    if (!flow || !flow.nodes || !flow.edges) return null;

    const nodes = flow.nodes;
    const edges = flow.edges;

    if (!this.flowState.has(leadId)) {
      const triggerNode = nodes.find((n: any) => n.type === 'trigger');
      if (triggerNode) {
        const keywords = (triggerNode.data.keyword || '').split(',').map((k: string) => k.trim().toLowerCase());
        if (keywords.some((k: string) => text.toLowerCase().includes(k))) {
          const edge = edges.find((e: any) => e.source === triggerNode.id);
          if (edge) {
            this.flowState.set(leadId, edge.target);
            return await this.processFlowNode(leadId, edge.target, nodes, edges, phone);
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
            return await this.processFlowNode(leadId, edge.target, nodes, edges, phone);
          } else {
            // NO HAY NODO SIGUIENTE: Pasar el texto del botón a Gemini para que responda con la Biblioteca
            this.flowState.delete(leadId);
            flowContext.overrideText = selectedButtonText; // Ej: "Informacion de Productos"
            return null;
          }
        }
      }
      this.flowState.delete(leadId);
      return null; 
    }
  }

  private async processFlowNode(leadId: string, nodeId: string, nodes: any[], edges: any[], phone: string): Promise<string | null> {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      this.flowState.delete(leadId); 
      return null;
    }

    if (node.type === 'message') {
      let msgText = node.data.message;
      
      const nextEdge = edges.find((e: any) => e.source === node.id);
      if (nextEdge) {
        const nextNode = nodes.find((n: any) => n.id === nextEdge.target);
        if (nextNode?.type === 'buttons') {
          const btnText = (nextNode.data.buttons || []).map((b: string, i: number) => `👉 *${i+1}.* ${b}`).join('\n');
          msgText = `${msgText}\n\n${btnText}`;
          this.flowState.set(leadId, nextNode.id); 
        } else {
          this.flowState.set(leadId, nextEdge.target); 
        }
      } else {
        this.flowState.delete(leadId); 
      }

      await this.sendMessageToPhone(phone, msgText);
      return msgText;
    }

    if (node.type === 'buttons') {
      const btnText = (node.data.buttons || []).map((b: string, i: number) => `👉 *${i+1}.* ${b}`).join('\n');
      const fullMsg = `Selecciona una de las siguientes opciones:\n\n${btnText}`;
      await this.sendMessageToPhone(phone, fullMsg);
      return fullMsg;
    }

    this.flowState.delete(leadId);
    return null;
  }

  public async sendMessageToPhone(phone: string, text: string) {
    if (!text || !text.toString().trim()) throw new Error('Message text is required');
    const jid = this.getWhatsappJid(phone);
    if (!this.socket) {
      await this.initialize();
    }
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }
    return this.socket.sendMessage(jid, { text: text.toString().trim() });
  }

  public async sendMessageToLead(leadId: string, text: string) {
    const lead = await db.getLeadById(leadId);
    if (!lead || !lead.phone) {
      throw new Error('Lead not found or missing phone');
    }
    return this.sendMessageToPhone(lead.phone, text);
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
    // Si no hay un socket activo ni se está intentando conectar, no bloqueamos esperando el QR
    if (!this.socket && this.status !== 'connecting') {
      return null;
    }
    try {
      const qrText = await this.waitForQr(timeoutMs);
      return this.buildQrDataUrl(qrText);
    } catch (err: any) {
      console.warn('[WhatsAppService] Timeout o error al esperar QR:', err?.message || err);
      return null;
    }
  }

  public async reset() {
    this.isResetting = true;
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
    
    setTimeout(() => {
      this.isResetting = false;
    }, 1000);
  }
}

const globalAny = globalThis as any;
const singleton = globalAny.__whatsappService || new WhatsAppService();
if (!globalAny.__whatsappService) {
  globalAny.__whatsappService = singleton;
}

export const whatsappService = singleton;
