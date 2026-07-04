import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { BACKPACK_CATEGORY, itemOf, newId, useStore } from '../store'

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
  const [maxLoad, setMaxLoad] = useState(
    existing?.maxLoadGrams != null ? (existing.maxLoadGrams / 1000).toString() : '',
  )
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>(
    existing?.specs?.map((s) => ({ ...s })) ?? [],
  )

  function setSpec(index: number, field: 'label' | 'value', text: string) {
    setSpecs(specs.map((s, i) => (i === index ? { ...s, [field]: text } : s)))
  }

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
    const cleanSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value)
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
      maxLoadGrams:
        categoryId !== BACKPACK_CATEGORY || maxLoad.trim() === ''
          ? undefined
          : Math.max(0, Math.round(Number(maxLoad.replace(',', '.')) * 1000)),
      specs: cleanSpecs.length > 0 ? cleanSpecs : undefined,
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

        {categoryId === BACKPACK_CATEGORY && (
          <label>
            {t('form.maxLoad')} <span className="hint">{t('form.maxLoadHint')}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={maxLoad}
              onChange={(e) => setMaxLoad(e.target.value)}
              placeholder="0"
            />
          </label>
        )}

        <label>
          {t('item.placement')} <span className="hint">{t('form.placementHint')}</span>
          <input
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder={t('form.placementPlaceholder')}
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

        <fieldset className="specs-editor">
          <legend>{t('item.specs')}</legend>
          {specs.map((spec, i) => (
            <div key={i} className="spec-row">
              <input
                value={spec.label}
                onChange={(e) => setSpec(i, 'label', e.target.value)}
                placeholder={t('form.specLabelPlaceholder')}
                aria-label={t('form.specLabelPlaceholder')}
              />
              <input
                value={spec.value}
                onChange={(e) => setSpec(i, 'value', e.target.value)}
                placeholder={t('form.specValuePlaceholder')}
                aria-label={t('form.specValuePlaceholder')}
              />
              <button
                type="button"
                className="row-remove"
                aria-label={t('form.specRemove')}
                onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
              >
                −
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setSpecs([...specs, { label: '', value: '' }])}
          >
            {t('form.specAdd')}
          </button>
        </fieldset>

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
