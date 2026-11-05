// Where the desktop app keeps its data, across the LIFE OS → ATLAS rename.
//
// Electron stores IndexedDB/localStorage in a profile folder named after the
// product (%APPDATA%\<productName>) and partitions it by page origin
// (app://<host>). Renaming the product moves the folder and renaming the host
// changes the origin — either would open existing users to an empty app.
// So an install that already has a LIFE OS profile keeps using it, under its
// original origin; fresh installs get ATLAS for both. Inside that origin the
// web app itself moves its `life-os` database and keys to `atlas`.
const path = require('node:path')
const fs = require('node:fs')

const PRODUCT = 'ATLAS'
const HOST = 'atlas'
const LEGACY_PRODUCT = 'LIFE OS'
const LEGACY_HOST = 'life-os'

/**
 * @param {string} appDataDir  app.getPath('appData')
 * @param {(p: string) => boolean} [exists]
 * @returns {{ userData: string, host: string, legacy: boolean }}
 */
function resolveProfile(appDataDir, exists = fs.existsSync) {
  const current = path.join(appDataDir, PRODUCT)
  const legacy = path.join(appDataDir, LEGACY_PRODUCT)
  // A populated ATLAS profile always wins (the user has run ATLAS before).
  if (exists(path.join(current, 'IndexedDB')) || exists(path.join(current, 'Local Storage'))) {
    return { userData: current, host: HOST, legacy: false }
  }
  if (exists(legacy)) return { userData: legacy, host: LEGACY_HOST, legacy: true }
  return { userData: current, host: HOST, legacy: false }
}

module.exports = { resolveProfile, PRODUCT, HOST, LEGACY_PRODUCT, LEGACY_HOST }
