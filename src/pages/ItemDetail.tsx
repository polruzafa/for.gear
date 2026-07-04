import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { deletePhoto, downscale, savePhoto, usePhoto } from '../photos'
import { categoryOf, formatWeight, groupPath, itemOf, useStore } from '../store'

export default function ItemDetail() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const item = id ? itemOf(data, id) : undefined
  const { url: photoUrl, refresh: refreshPhoto } = usePhoto(item?.id)
  const fileInput = useRef<HTMLInputElement>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)

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
  const inGroups = data.groups.filter(
    (g) => g.backpackId === item.id || g.itemIds.includes(item.id),
  )

  function remove() {
    if (!item) return
    if (!window.confirm(t('item.confirmDelete', { name: item.name }))) return
    void deletePhoto(item.id)
    dispatch({ type: 'item/delete', id: item.id })
    navigate('/')
  }

  async function onPhotoPicked(file: File) {
    if (!item) return
    setSavingPhoto(true)
    try {
      await savePhoto(item.id, await downscale(file))
      refreshPhoto()
    } catch {
      window.alert(t('item.photoError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  function removePhoto() {
    if (!item) return
    void deletePhoto(item.id).then(refreshPhoto)
  }

  return (
    <>
      <Link to="/" className="backlink">
        ← {t('tabs.gear')}
      </Link>

      <div className="photo-slot" aria-label={t('item.photo')}>
        {photoUrl ? (
          <img src={photoUrl} alt={item.name} />
        ) : (
          <button
            className="photo-add"
            disabled={savingPhoto}
            onClick={() => fileInput.current?.click()}
          >
            {savingPhoto ? '…' : t('item.addPhoto')}
          </button>
        )}
      </div>
      {photoUrl && (
        <div className="actions photo-actions">
          <button className="btn btn-small" disabled={savingPhoto} onClick={() => fileInput.current?.click()}>
            {t('item.changePhoto')}
          </button>
          <button className="btn btn-small" onClick={removePhoto}>
            {t('item.deletePhoto')}
          </button>
          <span className="hint">{t('item.photoLocalHint')}</span>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPhotoPicked(file)
          e.target.value = ''
        }}
      />

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
        {item.maxLoadGrams != null && (
          <div>
            <dt>{t('item.maxLoad')}</dt>
            <dd className="mono">{formatWeight(item.maxLoadGrams)}</dd>
          </div>
        )}
        {item.specs?.map((spec) => (
          <div key={spec.label}>
            <dt>{spec.label}</dt>
            <dd className="mono">{spec.value}</dd>
          </div>
        ))}
        {item.placement && (
          <div>
            <dt>{t('item.placement')}</dt>
            <dd>{item.placement}</dd>
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
        {inGroups.length > 0 && (
          <div>
            <dt>{t('item.inPacks')}</dt>
            <dd>
              {inGroups.map((g) => (
                <Link key={g.id} to={groupPath(g)} className="tag tag-link">
                  {g.name}
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
