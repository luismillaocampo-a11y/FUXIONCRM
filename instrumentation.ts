export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('[Instrumentation] Servidor iniciado. Comprobando sesión activa de WhatsApp...');
      const { whatsappService } = await import('./lib/whatsapp-service');
      const { db } = await import('./lib/db');
      
      const session = await db.getWhatsappSession('default');
      if (session && session.creds && session.creds.me && session.creds.me.id && !session.creds.me.id.startsWith('placeholder')) {
        console.log('[Instrumentation] Sesión de WhatsApp activa detectada en la base de datos. Auto-inicializando conexión...');
        whatsappService.initialize().catch((err: any) => {
          console.error('[Instrumentation] Error en la inicialización automática de WhatsApp:', err);
        });
      } else {
        console.log('[Instrumentation] No hay sesión de WhatsApp activa guardada. El bot esperará a que el usuario escanee el QR.');
      }
    } catch (error) {
      console.error('[Instrumentation] Error al cargar los servicios de base de datos o WhatsApp en el arranque:', error);
    }
  }
}
