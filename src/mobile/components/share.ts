import { downloadJson } from '@/store/backups'

/**
 * Save a file on iPhone: the share sheet (→ Save to Files, AirDrop, Mail…)
 * where supported, otherwise a normal download.
 */
export async function shareJsonFile(filename: string, value: unknown): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(value, null, 2)
  try {
    const file = new File([json], filename, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
  }
  downloadJson(filename, value)
  return 'downloaded'
}

/** Share text (reports); falls back to copying it. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed' | 'cancelled'> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
