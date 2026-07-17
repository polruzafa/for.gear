import { useMemo, useRef, useState, type FormEvent } from 'react'
import { defaultServerUrl, useAccount } from '../account'
import { getLocale, LANGS, useI18n, type TKey } from '../i18n'
import { parseItemsJson, pickCategoryColor, slugify, type ImportIssue } from '../itemsImport'
import { prunePhotos } from '../photos'
import { formatWeight, parseGearData, useStore, type Category } from '../store'
import { SCHEME_MODES, THEMES, useTheme } from '../theme'

export default function SettingsPage() {
  const { lang, setLang, t } = useI18n()
  const { theme, setTheme, mode, setMode } = useTheme()
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <section className="settings-section">
        <h2>{t('settings.language')}</h2>
        <div className="chips" role="group" aria-label={t('settings.language')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`chip${lang === l.code ? ' chip-on' : ''}`}
              aria-pressed={lang === l.code}
              lang={l.code}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.theme')}</h2>
        <div className="chips" role="group" aria-label={t('settings.scheme')}>
          {SCHEME_MODES.map((m) => (
            <button
              key={m.id}
              className={`chip${mode === m.id ? ' chip-on' : ''}`}
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <div className="theme-list" role="group" aria-label={t('settings.theme')}>
          {THEMES.map((th) => {
            const selected = theme === th.id
            const swatches = th.swatches[isDark ? 'dark' : 'light']
            return (
              <button
                key={th.id}
                className={`theme-option${selected ? ' theme-option-on' : ''}`}
                aria-pressed={selected}
                onClick={() => setTheme(th.id)}
              >
                <span className="theme-swatches">
                  {swatches.map((color, i) => (
                    <span
                      key={i}
                      className={`theme-swatch${i === swatches.length - 1 ? ' theme-swatch-paper' : ''}`}
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className="theme-label">{t(th.labelKey)}</span>
                {selected && (
                  <span className="theme-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('data.categories')}</h2>
        <CategoriesSection />
      </section>

      <section className="settings-section">
        <h2>{t('data.addTitle')}</h2>
        <AddItemsSection />
      </section>

      <section className="settings-section">
        <h2>{t('settings.account')}</h2>
        <AccountSection />
      </section>

      <section className="settings-section">
        <h2>{t('settings.backup')}</h2>
        <BackupSection />
      </section>

      <section className="settings-section">
        <StatsSection />
      </section>

      <section className="settings-section">
        <h2>{t('settings.danger')}</h2>
        <DangerSection />
      </section>
    </>
  )
}

function DangerSection() {
  const { dispatch } = useStore()
  const { t } = useI18n()

  function reset() {
    if (!window.confirm(t('data.resetConfirm'))) return
    dispatch({ type: 'data/reset' })
    // Les dades inicials no tenen cap element: fora totes les fotografies.
    void prunePhotos(new Set())
  }

  return (
    <div className="danger-zone">
      <p className="hint">{t('settings.dangerHint')}</p>
      <div className="actions actions-column">
        <button className="btn btn-danger" onClick={reset}>
          {t('data.reset')}
        </button>
      </div>
    </div>
  )
}

function CategoriesSection() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
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

  return (
    <>
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
    </>
  )
}

function AddItemsSection() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
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

  return (
    <>
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
    </>
  )
}

function StatsSection() {
  const { data } = useStore()
  const { t } = useI18n()
  const totalWeight = data.items.reduce((sum, it) => sum + (it.weightGrams ?? 0), 0)

  return (
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
        <dt>{t('data.reviews')}</dt>
        <dd className="mono">{data.reviews.length}</dd>
      </div>
      <div>
        <dt>{t('data.trips')}</dt>
        <dd className="mono">{data.trips.length}</dd>
      </div>
      <div>
        <dt>{t('data.totalWeight')}</dt>
        <dd className="mono">{formatWeight(totalWeight)}</dd>
      </div>
      <div>
        <dt>{t('settings.version')}</dt>
        <dd className="mono">
          {__VERSION__} · {__COMMIT__}
        </dd>
      </div>
    </dl>
  )
}

function BackupSection() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)

  function exportJson() {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fardell-${stamp}.json`
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
        void prunePhotos(
          new Set([
            ...incoming.items.map((it) => it.id),
            ...incoming.reviews.map((r) => r.id),
          ]),
        )
      }
    } catch {
      window.alert(t('data.importError'))
    }
  }

  return (
    <>
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
      </div>
    </>
  )
}

function AccountSection() {
  const { t } = useI18n()
  const { account, status, lastSyncedAt, errorKey, login, register, logout, deleteAccount, syncNow } =
    useAccount()

  const [serverUrl, setServerUrl] = useState(defaultServerUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [formError, setFormError] = useState<TKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(action: 'login' | 'register') {
    if (busy) return
    if (password.length < 8) {
      setFormError('account.errPassword')
      return
    }
    setBusy(true)
    setFormError(null)
    const error = await (action === 'login'
      ? login(serverUrl, email, password)
      : register(serverUrl, email, password, inviteCode))
    setBusy(false)
    if (error) {
      setFormError(error)
    } else {
      setEmail('')
      setPassword('')
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit('login')
  }

  async function removeAccount() {
    if (!window.confirm(t('account.deleteConfirm'))) return
    const pw = window.prompt(t('account.deletePassword'))
    if (pw == null) return
    const error = await deleteAccount(pw)
    if (error) window.alert(t(error))
  }

  if (!account) {
    return (
      <>
        <p className="hint">{t('account.hint')}</p>
        {errorKey && <p className="sync-status sync-status-error">{t(errorKey)}</p>}
        <form className="form" onSubmit={onSubmit}>
          <label>
            {t('account.server')} <span className="hint">{t('account.serverHint')}</span>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={t('account.serverPlaceholder')}
              required
              spellCheck={false}
              autoCapitalize="off"
            />
          </label>
          <label>
            {t('account.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            {t('account.password')} <span className="hint">{t('account.passwordHint')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </label>
          <label>
            {t('account.inviteCode')} <span className="hint">{t('account.inviteCodeHint')}</span>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
          {formError && <p className="sync-status sync-status-error">{t(formError)}</p>}
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('account.login')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void submit('register')}>
              {t('account.register')}
            </button>
          </div>
        </form>
      </>
    )
  }

  const statusText =
    status === 'syncing'
      ? t('account.statusSyncing')
      : status === 'dirty'
        ? t('account.statusDirty')
        : status === 'error'
          ? t(errorKey ?? 'account.errNetwork')
          : t('account.statusSynced')
  const statusClass =
    status === 'error'
      ? 'sync-status-error'
      : status === 'synced'
        ? 'sync-status-ok'
        : 'sync-status-busy'

  return (
    <>
      <dl className="facts">
        <div>
          <dt>{t('account.email')}</dt>
          <dd className="mono">{account.email}</dd>
        </div>
        <div>
          <dt>{t('account.lastSync')}</dt>
          <dd className="mono">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString(getLocale()) : t('account.never')}
          </dd>
        </div>
      </dl>
      <p className={`sync-status ${statusClass}`} role="status">
        {statusText}
      </p>
      <div className="actions actions-column">
        <button className="btn btn-primary" onClick={syncNow} disabled={status === 'syncing'}>
          {t('account.syncNow')}
        </button>
        <button className="btn" onClick={logout}>
          {t('account.logout')}
        </button>
        <button className="btn btn-danger" onClick={() => void removeAccount()}>
          {t('account.delete')}
        </button>
      </div>
    </>
  )
}
