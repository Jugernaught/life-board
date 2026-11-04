import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArchiveRestore, Database, Download, HardDrive, History, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import { COLLECTION_KEYS } from '@/data/schema'
import type { Database as Db } from '@/data/types'
import { type ValidationResult, countRecords, totalRecords } from '@/data/validate'
import { type BackupMeta, storageEstimate } from '@/storage'
import { type ImportMode, applyImport, createBackup, deleteBackup, downloadBackup, exportDatabase, inspectImportFile, listBackups, pruneAutoBackups, resetAllData, restoreBackup } from '@/store/backups'
import { actions, appStore, useApp, useDatabase, useSettings } from '@/store/store'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/display'
import { Segmented, Select, Switch } from '@/components/ui/inputs'
import { Modal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { confirmAction } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'

const REASON_LABEL: Record<BackupMeta['reason'], string> = {
  manual: 'Manual',
  auto: 'Automatic',
  'pre-import': 'Before import',
  'pre-restore': 'Before restore',
  'pre-reset': 'Before reset',
}

function ImportPreview({ result, onClose }: { result: (ValidationResult & { fileName: string }) | null; onClose: () => void }) {
  const db = useDatabase()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [busy, setBusy] = useState(false)
  if (!result) return null
  const incoming = result.ok ? countRecords(result.db) : {}
  const current = countRecords(db)
  const changed = COLLECTION_KEYS.filter((k) => (incoming[k] ?? 0) > 0 || (current[k] ?? 0) > 0)
  const apply = async () => {
    if (!result.ok) return
    if (mode === 'replace') {
      const ok = await confirmAction({
        title: 'Replace all current data?',
        message: `Your current ${totalRecords(db)} records will be replaced by the ${totalRecords(result.db)} records in this file. A safety backup is created first, so you can restore it from Backups.`,
        confirmLabel: 'Replace data',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const r = await applyImport(result.db as Db, mode)
      toast({ title: 'Import complete', description: mode === 'merge' ? `${r.added ?? 0} added, ${r.updated ?? 0} updated. Safety backup saved.` : 'Data replaced. Safety backup saved.' })
      onClose()
    } catch (e) {
      toast({ title: 'Import failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Review import"
      description={result.fileName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {result.ok && (
            <Button variant="primary" onClick={apply} loading={busy} data-testid="apply-import">
              {mode === 'merge' ? 'Merge into my data' : 'Replace my data'}
            </Button>
          )}
        </>
      }
    >
      {!result.ok ? (
        <div className="rounded-lg border border-bad/30 bg-bad/10 p-4 text-[13.5px] text-bad">
          <p className="font-medium">This file can’t be imported.</p>
          <p className="mt-1 text-ink-muted">{result.error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[13px] text-ok">
            <ShieldCheck size={15} /> Validated {totalRecords(result.db)} records. Nothing has been changed yet.
          </div>
          {result.rejected.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-[13px]">
              <p className="flex items-center gap-1.5 font-medium text-warn">
                <AlertTriangle size={14} /> {result.rejected.length} record(s) are invalid and will be skipped:
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-[11.5px] text-ink-muted">
                {result.rejected.slice(0, 30).map((r, i) => (
                  <li key={i}>
                    {r.collection}[{r.index}]: {r.problems.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-[12px] font-medium text-ink-muted">How should it be applied?</p>
            <Segmented
              value={mode}
              onChange={setMode}
              fullWidth
              ariaLabel="Import mode"
              options={[
                { value: 'merge', label: 'Merge (keep both)' },
                { value: 'replace', label: 'Replace everything' },
              ]}
            />
            <p className="mt-2 text-[12px] text-ink-subtle">
              {mode === 'merge' ? 'Adds new records and updates records that exist in both — whichever copy was edited most recently wins. Nothing is deleted. Your settings are kept.' : 'Swaps all current data (including settings) for the file’s contents.'}
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-panel-2/50 text-ink-subtle">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Collection</th>
                  <th className="px-3 py-1.5 text-right font-medium">Current</th>
                  <th className="px-3 py-1.5 text-right font-medium">In file</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((k) => (
                  <tr key={k} className="border-t border-line/60">
                    <td className="px-3 py-1.5 text-ink">{COLLECTIONS[k].plural}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink-muted">{current[k]}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-ink">{incoming[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function DataSettings() {
  const db = useDatabase()
  const settings = useSettings()
  const storage = useApp((s) => s.storage)
  const save = useApp((s) => s.save)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const [preview, setPreview] = useState<(ValidationResult & { fileName: string }) | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setBackups(await listBackups())
    } catch {
      setBackups([])
    }
    setEstimate(await storageEstimate())
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh, db.settings.backupsToKeep])

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key)
    try {
      await fn()
      if (success) toast({ title: success })
    } catch (e) {
      toast({ title: 'Something went wrong', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  const records = totalRecords(db)
  return (
    <div className="space-y-4">
      <Panel title="Where your data lives" icon={HardDrive}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-panel-2/30 p-3">
            <p className="eyebrow">Storage</p>
            <p className="mt-1 text-[13.5px] text-ink">{storage?.label ?? '—'}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">{storage?.persistent ? 'Survives refresh & restart' : 'Not persistent'}</p>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/30 p-3">
            <p className="eyebrow">Records</p>
            <p className="mt-1 font-display text-[20px] text-ink">{records}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">{db.activity.length} activity entries</p>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/30 p-3">
            <p className="eyebrow">Space used</p>
            <p className="mt-1 text-[13.5px] text-ink">{estimate.usage !== undefined ? formatBytes(estimate.usage) : 'Unknown'}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">{estimate.quota ? `of ~${formatBytes(estimate.quota)} available` : ''}</p>
          </div>
          <div className="rounded-lg border border-line bg-panel-2/30 p-3">
            <p className="eyebrow">Eviction protection</p>
            <p className={cn('mt-1 text-[13.5px]', estimate.persisted ? 'text-ok' : 'text-ink')}>{estimate.persisted ? 'Granted' : estimate.persisted === false ? 'Not granted' : 'Unknown'}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-subtle">Browser may clear unprotected data when low on space</p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-subtle">
          Last saved: {save.lastSavedAt ? new Date(save.lastSavedAt).toLocaleString() : '—'} {save.status === 'error' && <span className="text-bad">· Save error: {save.error}</span>}. Data stays in this browser on this device — clearing site data or using another browser won’t carry it over, so export backups regularly.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Export" icon={Download}>
          <p className="mb-3 text-[13px] text-ink-muted">Download everything — every record and setting — as a single JSON file you can keep or import later.</p>
          <Button variant="primary" icon={Download} onClick={() => exportDatabase()} data-testid="export-json">
            Export JSON backup
          </Button>
        </Panel>
        <Panel title="Import" icon={Upload}>
          <p className="mb-3 text-[13px] text-ink-muted">Import an Atlas JSON backup. It’s fully validated and previewed before anything changes, and a safety backup is taken first.</p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setPreview(await inspectImportFile(f))
            }}
          />
          <Button icon={Upload} onClick={() => fileInput.current?.click()}>
            Choose file…
          </Button>
        </Panel>
      </div>

      <Panel
        title="Backups"
        icon={History}
        actions={
          <Button size="sm" icon={ArchiveRestore} loading={busy === 'create'} onClick={() => run('create', () => createBackup('manual'), 'Backup created')} data-testid="create-backup">
            Back up now
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2.5">
            <Switch checked={settings.autoBackup} onChange={(autoBackup) => actions.updateSettings({ autoBackup })} label="Daily automatic backup" description="Taken when you open Atlas, at most once a day" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/40 px-3 py-2.5">
            <div>
              <p className="text-sm text-ink">Automatic backups to keep</p>
              <p className="text-[12.5px] text-ink-subtle">Manual & safety backups are never removed automatically</p>
            </div>
            <Select
              size="sm"
              value={String(settings.backupsToKeep)}
              onChange={(e) => {
                const keep = Number(e.target.value)
                actions.updateSettings({ backupsToKeep: keep })
                void pruneAutoBackups(keep).then(refresh)
              }}
              aria-label="Automatic backups to keep"
              className="w-20"
            >
              {[3, 7, 14, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {backups.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">No backups yet. One is created automatically each day once you have data, and before any import, restore or reset.</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="backup-list">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink">{new Date(b.createdAt).toLocaleString()}</p>
                  <p className="truncate text-[11.5px] text-ink-subtle">
                    {b.recordCount} records · {formatBytes(b.sizeBytes)}
                    {b.label ? ` · ${b.label}` : ''}
                  </p>
                </div>
                <Badge tone={b.reason === 'manual' ? 'cyan' : b.reason === 'auto' ? 'muted' : 'violet'}>{REASON_LABEL[b.reason]}</Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  loading={busy === `restore-${b.id}`}
                  onClick={async () => {
                    if (await confirmAction({ title: 'Restore this backup?', message: `Your current data will be replaced with the backup from ${new Date(b.createdAt).toLocaleString()} (${b.recordCount} records). A safety backup of the current data is taken first.`, confirmLabel: 'Restore', tone: 'default' }))
                      await run(`restore-${b.id}`, () => restoreBackup(b.id), 'Backup restored')
                  }}
                >
                  Restore
                </Button>
                <Button size="xs" variant="ghost" icon={Download} onClick={() => run(`dl-${b.id}`, () => downloadBackup(b.id))}>
                  <span className="sr-only sm:not-sr-only">Download</span>
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={Trash2}
                  className="text-ink-subtle hover:text-bad"
                  aria-label="Delete backup"
                  onClick={async () => {
                    if (await confirmAction({ title: 'Delete this backup?', message: 'The backup file will be permanently removed. Your current data is not affected.' })) await run(`del-${b.id}`, () => deleteBackup(b.id), 'Backup deleted')
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Danger zone" icon={AlertTriangle} className="border-bad/25">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="text-sm text-ink">Clear activity log</p>
            <p className="text-[12.5px] text-ink-subtle">Removes the “Recent activity” history only. Your records are untouched.</p>
          </div>
          <Button
            size="sm"
            variant="danger"
            icon={RefreshCw}
            onClick={async () => {
              if (await confirmAction({ title: 'Clear activity log?', message: `${db.activity.length} activity entries will be removed. Records are not affected.`, confirmLabel: 'Clear log' })) {
                await createBackup('manual', 'Before clearing activity log')
                appStore.getState().clearActivity()
                toast({ title: 'Activity log cleared', description: 'A backup was taken first.' })
              }
            }}
          >
            Clear log
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-sm text-ink">Erase all data</p>
            <p className="text-[12.5px] text-ink-subtle">Deletes every record. A backup is saved first so it can be restored.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              icon={Database}
              onClick={async () => {
                if (await confirmAction({ title: 'Erase all records?', message: `All ${records} records will be erased. Your settings are kept. A backup is created first.`, requireText: 'ERASE', confirmLabel: 'Erase records' }))
                  await run('reset', () => resetAllData({ keepSettings: true }), 'All records erased — backup saved')
              }}
            >
              Erase records
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (await confirmAction({ title: 'Factory reset?', message: 'Erases every record AND your settings, then shows first-time setup again. A backup is created first.', requireText: 'RESET', confirmLabel: 'Factory reset' }))
                  await run('factory', () => resetAllData({ keepSettings: false }), 'Reset complete — backup saved')
              }}
            >
              Factory reset
            </Button>
          </div>
        </div>
      </Panel>
      <ImportPreview result={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
