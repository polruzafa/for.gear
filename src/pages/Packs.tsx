import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import WeightBar from '../components/WeightBar'
import { useI18n } from '../i18n'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  collectGroupItemIds,
  formatWeight,
  groupLoadPercent,
  groupWeight,
  groupWeightByCategory,
  itemOf,
  newId,
  useStore,
} from '../store'

export default function Packs() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const packs = data.groups.filter((g) => g.backpackId != null)
  const backpacks = data.items.filter((it) => it.categoryId === BACKPACK_CATEGORY)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [backpackId, setBackpackId] = useState('')

  function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const chosen = backpackId || backpacks[0]?.id
    if (!trimmed || !chosen) return
    const pack = { id: newId(), name: trimmed, backpackId: chosen, itemIds: [], groupIds: [] }
    dispatch({ type: 'group/add', group: pack })
    navigate(`/motxilles/${pack.id}`)
  }

  return (
    <>
      <div className="page-head">
        <h1>{t('tabs.packs')}</h1>
        {!creating && backpacks.length > 0 && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('packs.new')}
          </button>
        )}
      </div>

      {creating && (
        <form className="form card" onSubmit={create}>
          <label>
            {t('packs.tripName')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder={t('packs.tripNamePlaceholder')}
            />
          </label>
          <label>
            {t('packs.backpack')}
            <select
              value={backpackId || backpacks[0]?.id}
              onChange={(e) => setBackpackId(e.target.value)}
            >
              {backpacks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({formatWeight(b.weightGrams)})
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              {t('packs.create')}
            </button>
            <button type="button" className="btn" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {backpacks.length === 0 && (
        <div className="empty">
          <p>
            {t('packs.needBackpack', {
              category: categoryOf(data, BACKPACK_CATEGORY).name,
            })}
          </p>
          <Link to="/element/nou" className="btn btn-primary">
            {t('packs.addBackpack')}
          </Link>
        </div>
      )}

      {packs.length === 0 && backpacks.length > 0 && !creating && (
        <div className="empty">
          <p>{t('packs.empty')}</p>
        </div>
      )}

      <ul className="cards">
        {packs.map((pack) => {
          const backpack = pack.backpackId ? itemOf(data, pack.backpackId) : undefined
          const pct = groupLoadPercent(data, pack)
          const count = collectGroupItemIds(data, pack).size
          return (
            <li key={pack.id}>
              <Link to={`/motxilles/${pack.id}`} className="card card-link">
                <div className="card-head">
                  <span className="card-title">{pack.name}</span>
                  <span className="mono">
                    {formatWeight(groupWeight(data, pack))}
                    {pct != null && (
                      <>
                        {' · '}
                        <span className={pct > 100 ? 'load-over' : undefined}>{pct} %</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="card-sub">
                  {backpack?.name ?? t('packs.unknownBackpack')} · {count}{' '}
                  {count === 1 ? t('common.item') : t('common.items')}
                </p>
                <WeightBar data={data} weights={groupWeightByCategory(data, pack)} legend={false} />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
