import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { categoryOf, formatWeight, useStore, type GearItem } from '../store'

export default function GearList() {
  const { data } = useStore()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.items.filter((it) => {
      if (categoryFilter && it.categoryId !== categoryFilter) return false
      if (!q) return true
      const haystack = `${it.name} ${it.tags.join(' ')} ${it.notes}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [data.items, query, categoryFilter])

  const totalWeight = filtered.reduce((sum, it) => sum + (it.weightGrams ?? 0), 0)

  const usedCategories = data.categories.filter((c) =>
    data.items.some((it) => it.categoryId === c.id),
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, GearItem[]>()
    for (const item of filtered) {
      const list = groups.get(item.categoryId) ?? []
      list.push(item)
      groups.set(item.categoryId, list)
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ca'))
    return [...groups.entries()].sort((a, b) =>
      categoryOf(data, a[0]).name.localeCompare(categoryOf(data, b[0]).name, 'ca'),
    )
  }, [filtered, data])

  return (
    <>
      <div className="page-head">
        <h1>{t('tabs.gear')}</h1>
        <Link to="/element/nou" className="btn btn-primary">
          {t('gear.add')}
        </Link>
      </div>

      <p className="tally mono">
        {filtered.length} {t(filtered.length === 1 ? 'common.item' : 'common.items')} ·{' '}
        {formatWeight(totalWeight)}
      </p>

      <input
        type="search"
        className="search"
        placeholder={t('gear.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('gear.searchLabel')}
      />

      <div className="chips" role="group" aria-label={t('gear.filterByCategory')}>
        <button
          className={`chip${categoryFilter === null ? ' chip-on' : ''}`}
          onClick={() => setCategoryFilter(null)}
        >
          {t('gear.all')}
        </button>
        {usedCategories.map((c) => (
          <button
            key={c.id}
            className={`chip${categoryFilter === c.id ? ' chip-on' : ''}`}
            style={{ '--chip-color': c.color } as React.CSSProperties}
            onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
          >
            <span className="dot" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>{t('gear.emptyFiltered')}</p>
          {data.items.length === 0 && (
            <Link to="/element/nou" className="btn btn-primary">
              {t('gear.addFirst')}
            </Link>
          )}
        </div>
      ) : (
        grouped.map(([categoryId, items]) => {
          const category = categoryOf(data, categoryId)
          return (
            <section key={categoryId} className="group">
              <h2 className="group-title">
                <span className="dot" style={{ background: category.color }} />
                {category.name}
              </h2>
              <ul className="rows">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link to={`/element/${item.id}`} className="row">
                      <span className="row-bar" style={{ background: category.color }} />
                      <span className="row-main">
                        <span className="row-name">{item.name}</span>
                        {item.tags.length > 0 && (
                          <span className="row-tags">{item.tags.join(' · ')}</span>
                        )}
                      </span>
                      <span className="mono row-weight">{formatWeight(item.weightGrams)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </>
  )
}
