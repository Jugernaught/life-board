import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveProfile } = require('./profile.cjs') as {
  resolveProfile: (appData: string, exists: (p: string) => boolean) => { userData: string; host: string; legacy: boolean }
}

const APPDATA = path.join('C:', 'Users', 'me', 'AppData', 'Roaming')
const fsWith = (...present: string[]) => (p: string) => present.map((x) => path.join(APPDATA, x)).includes(p)

describe('desktop profile across the LIFE OS → ATLAS rename', () => {
  it('fresh install: ATLAS folder and atlas origin', () => {
    expect(resolveProfile(APPDATA, fsWith())).toEqual({ userData: path.join(APPDATA, 'ATLAS'), host: 'atlas', legacy: false })
  })

  it('upgrade: keeps the LIFE OS folder and its original origin so existing data opens', () => {
    expect(resolveProfile(APPDATA, fsWith('LIFE OS'))).toEqual({ userData: path.join(APPDATA, 'LIFE OS'), host: 'life-os', legacy: true })
  })

  it('an ATLAS profile that already holds data wins over a leftover LIFE OS folder', () => {
    for (const store of ['IndexedDB', 'Local Storage']) {
      expect(resolveProfile(APPDATA, fsWith('LIFE OS', 'ATLAS', path.join('ATLAS', store))).host).toBe('atlas')
    }
  })

  it('an empty ATLAS folder (e.g. created by a crash log) does not hide LIFE OS data', () => {
    expect(resolveProfile(APPDATA, fsWith('LIFE OS', 'ATLAS')).host).toBe('life-os')
  })
})
