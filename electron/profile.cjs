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
const LEGACY_HOST = 'life-os'
/**
 * Folders a pre-ATLAS install may have used: the old product name, and the
 * lower-case folder an interim build pinned explicitly. Checked in order.
 */
const LEGACY_FOLDERS = ['life-os', 'LIFE OS']

/** @param {string} dir  @param {(p: string) => boolean} exists */
const hasData = (dir, exists) => exists(path.join(dir, 'IndexedDB')) || exists(path.join(dir, 'Local Storage'))

/**
 * @param {string} appDataDir  app.getPath('appData')
 * @param {(p: string) => boolean} [exists]
 * @returns {{ userData: string, host: string, legacy: boolean }}
 */
function resolveProfile(appDataDir, exists = fs.existsSync) {
  const current = path.join(appDataDir, PRODUCT)
  // A populated ATLAS profile always wins (the user has run ATLAS before).
  if (hasData(current, exists)) return { userData: current, host: HOST, legacy: false }
  const legacy = LEGACY_FOLDERS.map((name) => path.join(appDataDir, name))
  // Prefer a legacy folder that actually holds app data, then any that exists.
  const found = legacy.find((dir) => hasData(dir, exists)) ?? legacy.find((dir) => exists(dir))
  if (found) return { userData: found, host: LEGACY_HOST, legacy: true }
  return { userData: current, host: HOST, legacy: false }
}

module.exports = { resolveProfile, PRODUCT, HOST, LEGACY_HOST, LEGACY_FOLDERS }
