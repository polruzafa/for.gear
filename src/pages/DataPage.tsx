import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { parseItemsJson, pickCategoryColor, slugify, type ImportIssue } from '../itemsImport'
import { prunePhotos } from '../photos'
import { formatWeight, parseGearData, seedData, useStore, type Category } from '../store'

export default function DataPage() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pasteText, setPasteText] = useState('')
  const [addedCount, setAddedCount] = useState<number | null>(null)

  const pasteResult = useMemo(
    () => (pasteText.trim() ? parseItemsJson(pasteText, data) : null),
    [pasteText, data],
  )
  const canAdd =
    pasteResult != null && pasteResult.issues.length === 0 && pasteResult.items.length > 0

  function issueText(issue: ImportIssue): string {
    switch (issue.code) {
      case 'parse':
        return t('data.errParse', { detail: issue.detail })
      case 'notList':
        return t('data.errNotList')
      case 'noName':
        return t('data.errNoName', { n: issue.n })
      case 'noCategory':
        return t('data.errNoCategory', { n: issue.n, name: issue.name })
      case 'badWeight':
        return t('data.errBadWeight', { n: issue.n, name: issue.name })
      case 'dupId':
        return t('data.errDupId', { n: issue.n, name: issue.name })
    }
  }

  const [newCatName, setNewCatName] = useState('')

  function addCategory(e: FormEvent) {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    let id = slugify(name)
    while (data.categories.some((c) => c.id === id)) id = `${id}-2`
    const color = pickCategoryColor(new Set(data.categories.map((c) => c.color)), name)
    dispatch({ type: 'category/add', category: { id, name, color } })
    setNewCatName('')
  }

  function removeCategory(category: Category, count: number) {
    const message =
      count > 0
        ? t('data.deleteCategoryConfirm', { name: category.name, count })
        : t('data.deleteCategoryConfirmEmpty', { name: category.name })
    if (window.confirm(message)) dispatch({ type: 'category/delete', id: category.id })
  }

  function addPasted() {
    if (!pasteResult || !canAdd) return
    dispatch({
      type: 'items/addMany',
      items: pasteResult.items,
      categories: pasteResult.newCategories,
    })
    setAddedCount(pasteResult.items.length)
    setPasteText('')
  }

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

      <h2>{t('data.categories')}</h2>
      <ul className="cat-rows">
        {data.categories.map((c) => {
          const count = data.items.filter((it) => it.categoryId === c.id).length
          return (
            <li key={c.id} className="cat-row">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#6e6a5e'}
                onChange={(e) =>
                  dispatch({ type: 'category/update', category: { ...c, color: e.target.value } })
                }
                aria-label={t('data.categoryColor', { name: c.name })}
              />
              <input
                className="cat-name"
                value={c.name}
                onChange={(e) =>
                  dispatch({ type: 'category/update', category: { ...c, name: e.target.value } })
                }
                aria-label={t('data.categoryName')}
              />
              <span className="mono cat-count">{count}</span>
              <button
                className="row-remove"
                aria-label={t('data.deleteCategory', { name: c.name })}
                onClick={() => removeCategory(c, count)}
              >
                −
              </button>
            </li>
          )
        })}
      </ul>
      <form className="cat-add" onSubmit={addCategory}>
        <input
          className="cat-name"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder={t('data.newCategoryPlaceholder')}
          aria-label={t('data.categoryName')}
        />
        <button type="submit" className="btn" disabled={!newCatName.trim()}>
          {t('gear.add')}
        </button>
      </form>

      <h2>{t('data.addTitle')}</h2>
      <p className="hint">{t('data.addHint')}</p>
      <textarea
        className="paste-box mono"
        rows={7}
        value={pasteText}
        onChange={(e) => {
          setPasteText(e.target.value)
          setAddedCount(null)
        }}
        placeholder='[{ "item": "…", "peso_g": 100, "categoria": "cocina", "tags": ["…"] }]'
        spellCheck={false}
        aria-label={t('data.addTitle')}
      />
      {pasteResult && pasteResult.issues.length > 0 && (
        <ul className="paste-issues">
          {pasteResult.issues.map((issue, i) => (
            <li key={i}>{issueText(issue)}</li>
          ))}
        </ul>
      )}
      {canAdd && (
        <p className="paste-ok">
          {t('data.addValid', { items: pasteResult.items.length })}
          {pasteResult.newCategories.length > 0 &&
            ` ${t('data.addValidCats', { cats: pasteResult.newCategories.length })}`}
        </p>
      )}
      {addedCount != null && <p className="paste-ok">{t('data.addDone', { items: addedCount })}</p>}
      <div className="actions">
        <button className="btn btn-primary" disabled={!canAdd} onClick={addPasted}>
          {t('data.addButton')}
        </button>
      </div>

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
