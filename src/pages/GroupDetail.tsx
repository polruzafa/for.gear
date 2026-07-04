import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WeightBar from '../components/WeightBar'
import { useI18n } from '../i18n'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  collectGroupItemIds,
  formatWeight,
  groupContainsGroup,
  groupContentsWeight,
  groupLoadPercent,
  groupOf,
  groupPath,
  groupUnitCount,
  groupUnmetNeeds,
  groupWeight,
  groupWeightByCategory,
  groupWornWeight,
  itemOf,
  useStore,
  type GearItem,
  type Group,
  type GroupMember,
} from '../store'

export default function GroupDetail() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [pickQuery, setPickQuery] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const group = id ? groupOf(data, id) : undefined
  const isPack = group?.backpackId != null

  const q = pickQuery.trim().toLowerCase()

  const groupCandidates = useMemo(() => {
    if (!group) return []
    return data.groups
      .filter(
        (g) =>
          g.id !== group.id &&
          !group.groupIds.includes(g.id) &&
          // sense cicles: no es pot afegir un grup que ja conté aquest
          !groupContainsGroup(data, g, group.id),
      )
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  }, [data, group, q])

  const itemCandidates = useMemo(() => {
    if (!group) return []
    const covered = collectGroupItemIds(data, group)
    return data.items
      .filter((it) => it.categoryId !== BACKPACK_CATEGORY && !covered.has(it.id))
      .filter((it) => !q || `${it.name} ${it.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  }, [data, group, q])

  if (!group) {
    return (
      <div className="empty">
        <p>{t('pack.missing')}</p>
        <Link to="/motxilles" className="btn">
          {t('pack.backToPacks')}
        </Link>
      </div>
    )
  }

  const listPath = isPack ? '/motxilles' : '/kits'
  const backpack = group.backpackId ? itemOf(data, group.backpackId) : undefined
  const nested = group.groupIds
    .map((childId) => groupOf(data, childId))
    .filter((g): g is Group => Boolean(g))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  const directMembers = group.members
    .map((member) => ({ member, item: itemOf(data, member.id) }))
    .filter((e): e is { member: GroupMember; item: GearItem } => Boolean(e.item))

  const grouped = new Map<string, { member: GroupMember; item: GearItem }[]>()
  for (const entry of directMembers) {
    const list = grouped.get(entry.item.categoryId) ?? []
    list.push(entry)
    grouped.set(entry.item.categoryId, list)
  }
  const itemSections = [...grouped.entries()].sort((a, b) =>
    categoryOf(data, a[0]).name.localeCompare(categoryOf(data, b[0]).name, 'ca'),
  )

  const pct = groupLoadPercent(data, group)
  const unmetNeeds = groupUnmetNeeds(data, group)
  const isEmpty = group.members.length === 0 && group.groupIds.length === 0

  function acceptRename() {
    if (!group) return
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== group.name) {
      dispatch({ type: 'group/rename', id: group.id, name: trimmed })
    }
    setEditingName(false)
  }

  function removeGroup() {
    if (!group) return
    const message = isPack
      ? t('pack.confirmDelete', { name: group.name })
      : t('kit.confirmDelete', { name: group.name })
    if (!window.confirm(message)) return
    dispatch({ type: 'group/delete', id: group.id })
    navigate(listPath)
  }

  return (
    <>
      <Link to={listPath} className="backlink">
        ← {isPack ? t('tabs.packs') : t('tabs.kits')}
      </Link>
      {editingName ? (
        <form
          className="rename"
          onSubmit={(e) => {
            e.preventDefault()
            acceptRename()
          }}
        >
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
            autoFocus
            aria-label={t('group.rename')}
          />
          <button type="submit" className="icon-btn icon-btn-ok" aria-label={t('common.save')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('common.cancel')}
            onClick={() => setEditingName(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>
      ) : (
        <h1 className="detail-name detail-name-row">
          {group.name}
          <button
            className="icon-btn"
            aria-label={t('group.rename')}
            onClick={() => {
              setNameDraft(group.name)
              setEditingName(true)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 20l1.2-4.2L15.5 5.5a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20Zm9.5-12.5l3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </h1>
      )}

      {backpack && (
        <p className="card-sub">
          {t('pack.inside')}{' '}
          <Link to={`/element/${backpack.id}`} className="inline-link">
            {backpack.name}
          </Link>{' '}
          · {formatWeight(backpack.weightGrams)}
        </p>
      )}

      <p className="total-weight mono">{formatWeight(groupWeight(data, group))}</p>
      {isPack && <p className="hint">{t('pack.totalHint')}</p>}
      {groupWornWeight(data, group) > 0 && (
        <p className="hint mono">
          {t('group.wornWeight', { weight: formatWeight(groupWornWeight(data, group)) })}
        </p>
      )}

      {backpack?.maxLoadGrams != null && pct != null && (
        <div className={`loadgauge${pct > 100 ? ' loadgauge-over' : ''}`}>
          <div className="loadgauge-bar">
            <span style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="hint">
            <span className="mono">
              {t('pack.load', {
                load: formatWeight(groupContentsWeight(data, group)),
                max: formatWeight(backpack.maxLoadGrams),
                pct,
              })}
            </span>
            {pct > 100 && (
              <>
                {' · '}
                <strong className="load-over">
                  {t('pack.overBy', {
                    amount: formatWeight(groupContentsWeight(data, group) - backpack.maxLoadGrams),
                  })}
                </strong>
              </>
            )}
          </p>
        </div>
      )}

      {unmetNeeds.length > 0 && (
        <div className="needs-warn" role="note">
          <p className="needs-warn-title">{t('group.needsTitle')}</p>
          <ul>
            {unmetNeeds.map((unmet) => (
              <li key={unmet.item.id}>
                {t('group.needsWarn', { name: unmet.item.name, needs: unmet.needs.join(', ') })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <WeightBar data={data} weights={groupWeightByCategory(data, group)} />

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
          {groupCandidates.length === 0 && itemCandidates.length === 0 ? (
            <p className="hint">{t('pack.noCandidates')}</p>
          ) : (
            <>
              {groupCandidates.length > 0 && (
                <>
                  <h3 className="group-title">{t('tabs.kits')}</h3>
                  <ul className="rows">
                    {groupCandidates.map((g) => (
                      <li key={g.id}>
                        <button
                          className="row row-button"
                          onClick={() =>
                            dispatch({ type: 'group/toggleGroup', groupId: group.id, childId: g.id })
                          }
                        >
                          <span className="row-bar row-bar-kit" />
                          <span className="row-main">
                            <span className="row-name">{g.name}</span>
                          </span>
                          <span className="mono row-weight">{formatWeight(groupWeight(data, g))}</span>
                          <span className="row-plus" aria-hidden="true">
                            +
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {itemCandidates.length > 0 && (
                <ul className="rows">
                  {itemCandidates.map((item) => (
                    <li key={item.id}>
                      <button
                        className="row row-button"
                        onClick={() =>
                          dispatch({ type: 'group/addItem', groupId: group.id, itemId: item.id })
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
            </>
          )}
        </div>
      )}

      {isEmpty && !picking && (
        <div className="empty">
          <p>{isPack ? t('pack.empty') : t('kit.empty')}</p>
        </div>
      )}

      {nested.length > 0 && (
        <section className="group">
          <h3 className="group-title">{t('tabs.kits')}</h3>
          <ul className="rows">
            {nested.map((child) => (
              <li key={child.id} className="row">
                <span className="row-bar row-bar-kit" />
                <Link to={groupPath(child)} className="row-main inline-link">
                  <span className="row-name">{child.name}</span>
                  <span className="row-tags">
                    {groupUnitCount(data, child)}{' '}
                    {groupUnitCount(data, child) === 1 ? t('common.item') : t('common.items')}
                  </span>
                </Link>
                <span className="mono row-weight">{formatWeight(groupWeight(data, child))}</span>
                <button
                  className="row-remove"
                  aria-label={t('pack.removeItem', { name: child.name })}
                  onClick={() =>
                    dispatch({ type: 'group/toggleGroup', groupId: group.id, childId: child.id })
                  }
                >
                  −
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {itemSections.map(([categoryId, entries]) => {
        const category = categoryOf(data, categoryId)
        return (
          <section key={categoryId} className="group">
            <h3 className="group-title">
              <span className="dot" style={{ background: category.color }} />
              {category.name}
            </h3>
            <ul className="rows">
              {entries.map(({ member, item }) => {
                const qty = member.qty ?? 1
                const wornQty = Math.min(member.wornQty ?? 0, qty)
                const fullWorn = wornQty > 0 && wornQty === qty
                const wornLabel =
                  wornQty === 0
                    ? null
                    : fullWorn
                      ? t('item.worn').toLowerCase()
                      : t('group.wornPartial', { worn: wornQty, qty })
                return (
                  <li key={item.id} className="row">
                    <span className="row-bar" style={{ background: category.color }} />
                    <Link to={`/element/${item.id}`} className="row-main inline-link">
                      <span className="row-name">{item.name}</span>
                      {(item.placement || wornLabel) && (
                        <span className="row-tags">
                          {[wornLabel, item.placement].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </Link>
                    <span className="row-side">
                      <span className={`mono row-weight${fullWorn ? ' row-weight-worn' : ''}`}>
                        {qty > 1 && `${qty} × `}
                        {formatWeight(item.weightGrams === null ? null : qty * item.weightGrams)}
                      </span>
                      <span className="row-ctrls">
                        <button
                          className={`ctrl-btn ctrl-worn${wornQty > 0 ? ' ctrl-worn-on' : ''}`}
                          aria-label={t('group.cycleWorn', { name: item.name })}
                          onClick={() =>
                            dispatch({ type: 'group/cycleWorn', groupId: group.id, itemId: item.id })
                          }
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M8.5 3 4 5.5 5.8 9l1.7-.7V20h9V8.3l1.7.7L20 5.5 15.5 3a3.5 3.5 0 0 1-7 0Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {wornQty > 0 && qty > 1 && (
                            <span className="worn-badge mono">{wornQty}</span>
                          )}
                        </button>
                        <button
                          className="ctrl-btn"
                          aria-label={t('group.decQty', { name: item.name })}
                          onClick={() =>
                            qty <= 1
                              ? dispatch({ type: 'group/removeItem', groupId: group.id, itemId: item.id })
                              : dispatch({ type: 'group/setItemQty', groupId: group.id, itemId: item.id, qty: qty - 1 })
                          }
                        >
                          −
                        </button>
                        <span className="mono row-qty">{qty}</span>
                        <button
                          className="ctrl-btn ctrl-btn-plus"
                          aria-label={t('group.incQty', { name: item.name })}
                          onClick={() =>
                            dispatch({ type: 'group/setItemQty', groupId: group.id, itemId: item.id, qty: qty + 1 })
                          }
                        >
                          +
                        </button>
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <div className="actions">
        <button className="btn btn-danger" onClick={removeGroup}>
          {isPack ? t('pack.delete') : t('kit.delete')}
        </button>
      </div>
    </>
  )
}
