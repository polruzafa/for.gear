import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { itemOf, newId, useStore } from '../store'

export default function ItemForm() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()

  const existing = id ? itemOf(data, id) : undefined
  const editing = Boolean(existing)

  const [name, setName] = useState(existing?.name ?? '')
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? data.categories[0]?.id ?? '')
  const [weight, setWeight] = useState(existing?.weightGrams?.toString() ?? '')
  const [caseWeight, setCaseWeight] = useState(existing?.caseWeightGrams?.toString() ?? '')
  const [placement, setPlacement] = useState(existing?.placement ?? '')
  const [kit, setKit] = useState(existing?.kit?.toString() ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  if (id && !existing) {
    return (
      <div className="empty">
        <p>{t('item.missing')}</p>
        <Link to="/" className="btn">
          {t('item.backToGear')}
        </Link>
      </div>
    )
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const item = {
      id: existing?.id ?? newId(),
      name: trimmed,
      categoryId,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      weightGrams: weight.trim() === '' ? null : Math.max(0, Math.round(Number(weight))),
      caseWeightGrams:
        caseWeight.trim() === '' ? undefined : Math.max(0, Math.round(Number(caseWeight))),
      placement: placement.trim() || undefined,
      kit: kit.trim() === '' ? undefined : Math.max(1, Math.round(Number(kit))),
      notes: notes.trim(),
      photo: existing?.photo ?? null,
    }
    dispatch({ type: editing ? 'item/update' : 'item/add', item })
    navigate(`/element/${item.id}`, { replace: true })
  }

  return (
    <>
      <Link to={editing ? `/element/${id}` : '/'} className="backlink">
        ← {editing ? existing!.name : t('tabs.gear')}
      </Link>
      <h1>{editing ? t('form.editTitle') : t('form.newTitle')}</h1>

      <form className="form" onSubmit={save}>
        <label>
          {t('form.name')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!editing}
            placeholder={t('form.namePlaceholder')}
          />
        </label>

        <label>
          {t('item.category')}
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t('form.weight')}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
          />
        </label>

        <label>
          {t('form.caseWeight')} <span className="hint">{t('form.caseWeightHint')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={caseWeight}
            onChange={(e) => setCaseWeight(e.target.value)}
            placeholder="0"
          />
        </label>

        <label>
          {t('item.placement')} <span className="hint">{t('form.placementHint')}</span>
          <input
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder={t('form.placementPlaceholder')}
          />
        </label>

        <label>
          {t('item.kit')} <span className="hint">{t('form.kitHint')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={kit}
            onChange={(e) => setKit(e.target.value)}
            placeholder="—"
          />
        </label>

        <label>
          {t('item.tags')} <span className="hint">{t('form.tagsHint')}</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('form.tagsPlaceholder')}
          />
        </label>

        <label>
          {t('item.notes')}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <div className="actions">
          <button type="submit" className="btn btn-primary">
            {t('common.save')}
          </button>
          <Link to={editing ? `/element/${id}` : '/'} className="btn">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </>
  )
}
