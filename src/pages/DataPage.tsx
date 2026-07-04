import { useRef } from 'react'
import { useI18n } from '../i18n'
import { prunePhotos } from '../photos'
import { formatWeight, parseGearData, seedData, useStore } from '../store'

export default function DataPage() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)

  const totalWeight = data.items.reduce((sum, it) => sum + (it.weightGrams ?? 0), 0)

  function exportJson() {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `for-gear-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(file: File) {
    try {
      const incoming = parseGearData(JSON.parse(await file.text()) as unknown)
      if (!incoming) {
        window.alert(t('data.importInvalid'))
        return
      }
      const ok = window.confirm(
        t('data.importConfirm', { items: incoming.items.length, groups: incoming.groups.length }),
      )
      if (ok) {
        dispatch({ type: 'data/import', data: incoming })
        void prunePhotos(new Set(incoming.items.map((it) => it.id)))
      }
    } catch {
      window.alert(t('data.importError'))
    }
  }

  function reset() {
    if (!window.confirm(t('data.resetConfirm'))) return
    dispatch({ type: 'data/reset' })
    void prunePhotos(new Set(seedData.items.map((it) => it.id)))
  }

  return (
    <>
      <h1>{t('tabs.data')}</h1>

      <dl className="facts">
        <div>
          <dt>{t('data.items')}</dt>
          <dd className="mono">{data.items.length}</dd>
        </div>
        <div>
          <dt>{t('data.kits')}</dt>
          <dd className="mono">{data.groups.filter((g) => g.backpackId == null).length}</dd>
        </div>
        <div>
          <dt>{t('data.packs')}</dt>
          <dd className="mono">{data.groups.filter((g) => g.backpackId != null).length}</dd>
        </div>
        <div>
          <dt>{t('data.totalWeight')}</dt>
          <dd className="mono">{formatWeight(totalWeight)}</dd>
        </div>
      </dl>

      <p className="hint">{t('data.storageHint')}</p>

      <div className="actions actions-column">
        <button className="btn btn-primary" onClick={exportJson}>
          {t('data.export')}
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          {t('data.import')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importJson(file)
            e.target.value = ''
          }}
        />
        <button className="btn btn-danger" onClick={reset}>
          {t('data.reset')}
        </button>
      </div>
    </>
  )
}
