import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import WeightBar from '../components/WeightBar'
import { useI18n } from '../i18n'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  formatWeight,
  itemOf,
  newId,
  packWeight,
  packWeightByCategory,
  useStore,
} from '../store'

export default function Packs() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const backpacks = data.items.filter((it) => it.categoryId === BACKPACK_CATEGORY)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [backpackId, setBackpackId] = useState('')

  function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const chosen = backpackId || backpacks[0]?.id
    if (!trimmed || !chosen) return
    const pack = { id: newId(), name: trimmed, backpackId: chosen, itemIds: [] }
    dispatch({ type: 'pack/add', pack })
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

      {data.packs.length === 0 && backpacks.length > 0 && !creating && (
        <div className="empty">
          <p>{t('packs.empty')}</p>
        </div>
      )}

      <ul className="cards">
        {data.packs.map((pack) => {
          const backpack = itemOf(data, pack.backpackId)
          return (
            <li key={pack.id}>
              <Link to={`/motxilles/${pack.id}`} className="card card-link">
                <div className="card-head">
                  <span className="card-title">{pack.name}</span>
                  <span className="mono">{formatWeight(packWeight(data, pack))}</span>
                </div>
                <p className="card-sub">
                  {backpack?.name ?? t('packs.unknownBackpack')} · {pack.itemIds.length}{' '}
                  {t(pack.itemIds.length === 1 ? 'common.item' : 'common.items')}
                </p>
                <WeightBar data={data} weights={packWeightByCategory(data, pack)} legend={false} />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
