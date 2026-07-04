import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { categoryOf, formatWeight, itemOf, useStore } from '../store'

export default function ItemDetail() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const item = id ? itemOf(data, id) : undefined
  if (!item) {
    return (
      <div className="empty">
        <p>{t('item.missing')}</p>
        <Link to="/" className="btn">
          {t('item.backToGear')}
        </Link>
      </div>
    )
  }

  const category = categoryOf(data, item.categoryId)
  const kitMates =
    item.kit == null ? [] : data.items.filter((it) => it.kit === item.kit && it.id !== item.id)
  const inPacks = data.packs.filter(
    (p) => p.backpackId === item.id || p.itemIds.includes(item.id),
  )

  function remove() {
    if (!item) return
    if (!window.confirm(t('item.confirmDelete', { name: item.name }))) return
    dispatch({ type: 'item/delete', id: item.id })
    navigate('/')
  }

  return (
    <>
      <Link to="/" className="backlink">
        ← {t('tabs.gear')}
      </Link>

      <div className="photo-slot" aria-label={t('item.photo')}>
        {item.photo ? <img src={item.photo} alt={item.name} /> : <span>{t('item.noPhoto')}</span>}
      </div>

      <h1 className="detail-name">{item.name}</h1>

      <dl className="facts">
        <div>
          <dt>{t('item.category')}</dt>
          <dd>
            <span className="dot" style={{ background: category.color }} />
            {category.name}
          </dd>
        </div>
        <div>
          <dt>{t('item.weight')}</dt>
          <dd className="mono">{formatWeight(item.weightGrams)}</dd>
        </div>
        {item.caseWeightGrams != null && (
          <div>
            <dt>{t('item.caseWeight')}</dt>
            <dd className="mono">{formatWeight(item.caseWeightGrams)}</dd>
          </div>
        )}
        {item.placement && (
          <div>
            <dt>{t('item.placement')}</dt>
            <dd>{item.placement}</dd>
          </div>
        )}
        {item.kit != null && (
          <div>
            <dt>
              {t('item.kit')} {item.kit}
            </dt>
            <dd>
              {kitMates.length > 0
                ? kitMates.map((mate) => (
                    <Link key={mate.id} to={`/element/${mate.id}`} className="tag tag-link">
                      {mate.name}
                    </Link>
                  ))
                : t('item.kitAlone')}
            </dd>
          </div>
        )}
        {item.tags.length > 0 && (
          <div>
            <dt>{t('item.tags')}</dt>
            <dd>
              {item.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </dd>
          </div>
        )}
        {item.notes && (
          <div>
            <dt>{t('item.notes')}</dt>
            <dd>{item.notes}</dd>
          </div>
        )}
        {inPacks.length > 0 && (
          <div>
            <dt>{t('item.inPacks')}</dt>
            <dd>
              {inPacks.map((p) => (
                <Link key={p.id} to={`/motxilles/${p.id}`} className="tag tag-link">
                  {p.name}
                </Link>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="actions">
        <Link to={`/element/${item.id}/edita`} className="btn btn-primary">
          {t('common.edit')}
        </Link>
        <button className="btn btn-danger" onClick={remove}>
          {t('common.delete')}
        </button>
      </div>
    </>
  )
}
