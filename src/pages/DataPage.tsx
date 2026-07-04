import { useRef } from 'react'
import { LANGS, useI18n } from '../i18n'
import { formatWeight, isGearData, useStore, type GearData } from '../store'

export default function DataPage() {
  const { data, dispatch } = useStore()
  const { lang, setLang, t } = useI18n()
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
      const parsed: unknown = JSON.parse(await file.text())
      if (!isGearData(parsed)) {
        window.alert(t('data.importInvalid'))
        return
      }
      const incoming = parsed as GearData
      const ok = window.confirm(
        t('data.importConfirm', { items: incoming.items.length, packs: incoming.packs.length }),
      )
      if (ok) dispatch({ type: 'data/import', data: incoming })
    } catch {
      window.alert(t('data.importError'))
    }
  }

  function reset() {
    if (window.confirm(t('data.resetConfirm'))) dispatch({ type: 'data/reset' })
  }

  return (
    <>
      <h1>{t('tabs.data')}</h1>

      <h2>{t('data.language')}</h2>
      <div className="chips" role="group" aria-label={t('data.language')}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            className={`chip${lang === l.code ? ' chip-on' : ''}`}
            lang={l.code}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <dl className="facts">
        <div>
          <dt>{t('data.items')}</dt>
          <dd className="mono">{data.items.length}</dd>
        </div>
        <div>
          <dt>{t('data.packs')}</dt>
          <dd className="mono">{data.packs.length}</dd>
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
