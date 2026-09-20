export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('[Instrumentation] Servidor iniciado. Comprobando sesión activa de WhatsApp...');
      const { whatsappService } = await import('./lib/whatsapp-service');
      const { db, backupSqliteDb } = await import('./lib/db');
      
      // Respaldo diario automático de SQLite (conserva últimos 7) + uno al arrancar
      const runBackup = () => {
        backupSqliteDb(7).catch((err: any) =>
          console.warn('[Instrumentation] Backup omitido:', err?.message || err)
        );
      };
      runBackup();
      setInterval(runBackup, 24 * 60 * 60 * 1000);

      // Ejecutar unificación de leads duplicados al arrancar el servidor
      await db.unifyDuplicateLeads();
      
      const session = await db.getWhatsappSession('default');
      const fs = require('fs');
      const path = require('path');
      const credsFile = path.join(process.env.APPDATA || process.env.HOME || process.cwd(), 'NutraFlow CRM', 'baileys_auth_info', 'creds.json');
      const hasDiskCreds = fs.existsSync(credsFile);

      if ((session && session.creds && session.creds.me && session.creds.me.id && !session.creds.me.id.startsWith('placeholder')) || hasDiskCreds) {
        console.log('[Instrumentation] Sesión de WhatsApp activa detectada (DB o disco). Auto-inicializando conexión...');
        whatsappService.initialize(false).catch((err: any) => {
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
