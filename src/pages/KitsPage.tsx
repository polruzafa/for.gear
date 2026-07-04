import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import WeightBar from '../components/WeightBar'
import { useI18n } from '../i18n'
import {
  collectGroupItemIds,
  formatWeight,
  groupWeight,
  groupWeightByCategory,
  newId,
  useStore,
} from '../store'

export default function KitsPage() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const kits = data.groups.filter((g) => g.backpackId == null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const kit = { id: newId(), name: trimmed, backpackId: null, itemIds: [], groupIds: [] }
    dispatch({ type: 'group/add', group: kit })
    navigate(`/kits/${kit.id}`)
  }

  return (
    <>
      <div className="page-head">
        <h1>{t('tabs.kits')}</h1>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('kits.new')}
          </button>
        )}
      </div>

      {creating && (
        <form className="form card" onSubmit={create}>
          <label>
            {t('kits.name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder={t('kits.namePlaceholder')}
            />
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

      {kits.length === 0 && !creating && (
        <div className="empty">
          <p>{t('kits.empty')}</p>
        </div>
      )}

      <ul className="cards">
        {kits.map((kit) => {
          const count = collectGroupItemIds(data, kit).size
          return (
            <li key={kit.id}>
              <Link to={`/kits/${kit.id}`} className="card card-link">
                <div className="card-head">
                  <span className="card-title">{kit.name}</span>
                  <span className="mono">{formatWeight(groupWeight(data, kit))}</span>
                </div>
                <p className="card-sub">
                  {count} {count === 1 ? t('common.item') : t('common.items')}
                </p>
                <WeightBar data={data} weights={groupWeightByCategory(data, kit)} legend={false} />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
