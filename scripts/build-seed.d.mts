/** Type declarations for build-seed.mjs, so TypeScript tests can import it. */

export declare const SEED_SCHEMA_VERSION: number
export declare const SCRIPT_PATH: string
/** Allowed values mirrored from src/data/constants.ts. */
export declare const ENUMS: Record<string, readonly string[]>

export declare class ProfileError extends Error {
  constructor(path: string, message: string)
}

export interface SeedBackup {
  app: 'atlas'
  kind: 'backup'
  exportedAt: string
  schemaVersion: number
  data: Record<string, unknown> & { schemaVersion: number; settings: Record<string, unknown>; activity: unknown[] }
}

export interface SeedSummary {
  counts: Record<string, number>
  warnings: string[]
}

export declare function buildSeed(profile: unknown, options?: { now?: Date; today?: string }): { backup: SeedBackup; summary: SeedSummary }
export declare function main(argv?: string[]): number
export declare function toMinor(value: unknown, path: string): number
export declare function addDays(iso: string, days: number): string
export declare function addMonths(iso: string, months: number, preferredDay?: number): string
export declare function nextDayOfMonth(today: string, dayOfMonth: number): string
export declare function humanDate(iso: string): string
