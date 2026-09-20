const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 650,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: transparent;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .splash-card {
          width: 630px;
          height: 360px;
          border-radius: 16px;
          background: linear-gradient(135deg, #090d16 0%, #111827 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.15);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-sizing: border-box;
          padding: 30px;
        }
        .logo-emblem {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .logo-emblem img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 18px;
          border: 1px solid rgba(6, 182, 212, 0.4);
          box-shadow: 0 0 25px rgba(6, 182, 212, 0.4);
        }
        .title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 2px;
          background: linear-gradient(to right, #ffffff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          text-transform: uppercase;
        }
        .subtitle {
          font-size: 13px;
          color: #38bdf8;
          letter-spacing: 1px;
          margin-top: 6px;
          margin-bottom: 24px;
          font-weight: 500;
        }
        .progress-bar-container {
          width: 80%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        .progress-bar-fill {
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #f97316);
          border-radius: 4px;
          position: absolute;
          animation: loading 1.8s infinite ease-in-out;
        }
        @keyframes loading {
          0% { left: -40%; width: 30%; }
          50% { left: 40%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }
        .status-text {
          font-size: 11px;
          color: #64748b;
          margin-top: 10px;
        }
        .author-credit {
          position: absolute;
          bottom: 14px;
          right: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>
      <div class="splash-card">
        <div class="logo-emblem">
          <img src="data:image/png;base64,${require('fs').readFileSync(path.join(__dirname, 'public/logo-av.png')).toString('base64')}" alt="AV" />
        </div>
        <h1 class="title">ASISTENTE VIRTUAL</h1>
        <div class="subtitle">Sistema de Gestión & Automatización Operativa</div>
        
        <div class="progress-bar-container">
          <div class="progress-bar-fill"></div>
        </div>
        <div class="status-text">Inicializando entorno local y base de datos...</div>
        
        <div class="author-credit">Creado por Lz MiLLa</div>
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

function createMainWindow() {
  const { Menu } = require('electron');

  const template = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Recargar', role: 'reload' },
        { label: 'Forzar Recarga', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Pantalla Completa', role: 'togglefullscreen' },
        { label: 'Zoom +', role: 'zoomIn' },
        { label: 'Zoom -', role: 'zoomOut' },
        { label: 'Tamaño Real', role: 'resetZoom' }
      ]
    },
    {
      label: 'Ventana',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Cerrar', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    title: 'ASISTENTE VIRTUAL - Creado por Lz MiLLa',
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const showMainAndCloseSplash = () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { splashWindow.destroy(); } catch (e) {}
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  };

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Electron] mainWindow failed to load (${errorCode}: ${errorDescription}). Reintentando en 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_URL);
      }
    }, 1000);
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    showMainAndCloseSplash();
  });

  // Temporizador de seguridad: garantizar apertura máxima en 6s si ready-to-show se demorara
  setTimeout(() => {
    showMainAndCloseSplash();
  }, 6000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServerAndOpen() {
  let attempts = 0;
  const maxAttempts = 40; // Max 20 segundos de espera

  const checkServer = () => {
    attempts++;
    http.get(SERVER_URL, (res) => {
      createMainWindow();
    }).on('error', () => {
      if (attempts >= maxAttempts) {
        console.warn('[Electron] Forzando apertura de ventana principal tras tiempo de espera...');
        createMainWindow();
      } else {
        setTimeout(checkServer, 500);
      }
    });
  };
  checkServer();
}

function startNextServer() {
  if (process.env.NODE_ENV === 'development') {
    waitForServerAndOpen();
  } else {
    try {
      const next = require('next');
      const nextApp = next({ dev: false, dir: __dirname });
      const handle = nextApp.getRequestHandler();

      nextApp.prepare().then(() => {
        const server = http.createServer((req, res) => {
          handle(req, res);
        });

        server.on('error', (err) => {
          console.error('[Next.js Embedded Server error event]:', err);
          waitForServerAndOpen();
        });

        server.listen(PORT, () => {
          console.log(`[Next.js Embedded Server]: Ready on http://localhost:${PORT}`);
          waitForServerAndOpen();
        });
      }).catch((err) => {
        console.error('[Next.js Embedded Server Error]:', err);
        waitForServerAndOpen();
      });
    } catch (err) {
      console.error('[Next.js Embedded Import Error]:', err);
      waitForServerAndOpen();
    }
  }
}

app.whenReady().then(() => {
  createSplashScreen();
  startNextServer();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
