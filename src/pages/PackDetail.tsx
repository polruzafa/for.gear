import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WeightBar from '../components/WeightBar'
import { useI18n } from '../i18n'
import {
  categoryOf,
  formatWeight,
  itemOf,
  packWeight,
  packWeightByCategory,
  useStore,
  type GearItem,
} from '../store'

export default function PackDetail() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [pickQuery, setPickQuery] = useState('')

  const pack = data.packs.find((p) => p.id === id)

  const candidates = useMemo(() => {
    if (!pack) return []
    const q = pickQuery.trim().toLowerCase()
    return data.items
      .filter((it) => it.id !== pack.backpackId && !pack.itemIds.includes(it.id))
      .filter((it) => !q || `${it.name} ${it.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  }, [data.items, pack, pickQuery])

  if (!pack) {
    return (
      <div className="empty">
        <p>{t('pack.missing')}</p>
        <Link to="/motxilles" className="btn">
          {t('pack.backToPacks')}
        </Link>
      </div>
    )
  }

  const backpack = itemOf(data, pack.backpackId)
  const contents = pack.itemIds
    .map((itemId) => itemOf(data, itemId))
    .filter((it): it is GearItem => Boolean(it))

  const grouped = new Map<string, GearItem[]>()
  for (const item of contents) {
    const list = grouped.get(item.categoryId) ?? []
    list.push(item)
    grouped.set(item.categoryId, list)
  }
  const groups = [...grouped.entries()].sort((a, b) =>
    categoryOf(data, a[0]).name.localeCompare(categoryOf(data, b[0]).name, 'ca'),
  )

  function removePack() {
    if (!pack) return
    if (!window.confirm(t('pack.confirmDelete', { name: pack.name }))) return
    dispatch({ type: 'pack/delete', id: pack.id })
    navigate('/motxilles')
  }

  return (
    <>
      <Link to="/motxilles" className="backlink">
        ← {t('tabs.packs')}
      </Link>
      <h1 className="detail-name">{pack.name}</h1>

      {backpack && (
        <p className="card-sub">
          {t('pack.inside')}{' '}
          <Link to={`/element/${backpack.id}`} className="inline-link">
            {backpack.name}
          </Link>{' '}
          · {formatWeight(backpack.weightGrams)}
        </p>
      )}

      <p className="total-weight mono">{formatWeight(packWeight(data, pack))}</p>
      <p className="hint">{t('pack.totalHint')}</p>

      <WeightBar data={data} weights={packWeightByCategory(data, pack)} />

      <div className="page-head">
        <h2>{t('pack.contents')}</h2>
        <button className="btn btn-primary" onClick={() => setPicking(!picking)}>
          {picking ? t('common.done') : t('pack.addItems')}
        </button>
      </div>

      {picking && (
        <div className="picker card">
          <input
            type="search"
            className="search"
            placeholder={t('pack.searchPlaceholder')}
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
            autoFocus
          />
          {candidates.length === 0 ? (
            <p className="hint">{t('pack.noCandidates')}</p>
          ) : (
            <ul className="rows">
              {candidates.map((item) => (
                <li key={item.id}>
                  <button
                    className="row row-button"
                    onClick={() =>
                      dispatch({ type: 'pack/toggleItem', packId: pack.id, itemId: item.id })
                    }
                  >
                    <span
                      className="row-bar"
                      style={{ background: categoryOf(data, item.categoryId).color }}
                    />
                    <span className="row-main">
                      <span className="row-name">{item.name}</span>
                    </span>
                    <span className="mono row-weight">{formatWeight(item.weightGrams)}</span>
                    <span className="row-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {contents.length === 0 && !picking ? (
        <div className="empty">
          <p>{t('pack.empty')}</p>
        </div>
      ) : (
        groups.map(([categoryId, items]) => {
          const category = categoryOf(data, categoryId)
          return (
            <section key={categoryId} className="group">
              <h3 className="group-title">
                <span className="dot" style={{ background: category.color }} />
                {category.name}
              </h3>
              <ul className="rows">
                {items.map((item) => (
                  <li key={item.id} className="row">
                    <span className="row-bar" style={{ background: category.color }} />
                    <Link to={`/element/${item.id}`} className="row-main inline-link">
                      <span className="row-name">{item.name}</span>
                      {item.placement && <span className="row-tags">{item.placement}</span>}
                    </Link>
                    <span className="mono row-weight">{formatWeight(item.weightGrams)}</span>
                    <button
                      className="row-remove"
                      aria-label={t('pack.removeItem', { name: item.name })}
                      onClick={() =>
                        dispatch({ type: 'pack/toggleItem', packId: pack.id, itemId: item.id })
                      }
                    >
                      −
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}

      <div className="actions">
        <button className="btn btn-danger" onClick={removePack}>
          {t('pack.delete')}
        </button>
      </div>
    </>
  )
}
