// ATLAS — Windows desktop shell.
// Serves the production build (dist/) through a privileged custom protocol so
// BrowserRouter routes and IndexedDB behave exactly as they do on the web.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { resolveProfile, PRODUCT } = require('./profile.cjs')

const SCHEME = 'app'
// Must run before the app is ready: it decides where storage lives.
const profile = resolveProfile(app.getPath('appData'))
app.setPath('userData', profile.userData)
const HOST = profile.host
const DIST = path.join(__dirname, '..', 'dist')

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

function resolveRequest(requestUrl) {
  const { pathname } = new URL(requestUrl)
  let rel = decodeURIComponent(pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  const file = path.normalize(path.join(DIST, rel))
  // Block path traversal outside dist/.
  if (!file.startsWith(DIST)) return path.join(DIST, 'index.html')
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  // Files with an extension that don't exist are real 404s; everything else is an app route.
  if (path.extname(rel)) return null
  return rel.startsWith('/m/') || rel === '/m' ? path.join(DIST, 'm', 'index.html') : path.join(DIST, 'index.html')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0d10',
    title: PRODUCT,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) {
      event.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })
  win.loadURL(`${SCHEME}://${HOST}/`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    protocol.handle(SCHEME, (request) => {
      const file = resolveRequest(request.url)
      if (!file) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    })
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
