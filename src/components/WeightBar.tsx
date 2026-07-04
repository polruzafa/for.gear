import { useI18n } from '../i18n'
import { categoryOf, formatWeight, type GearData } from '../store'

/**
 * Barra de pes apilada per categories: l'element de signatura de l'app.
 * Rep el pes en grams per categoria i pinta cada segment amb el color de la categoria.
 */
export default function WeightBar({
  data,
  weights,
  legend = true,
}: {
  data: GearData
  weights: Map<string, number>
  legend?: boolean
}) {
  const { t } = useI18n()
  const total = [...weights.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const segments = [...weights.entries()]
    .filter(([, grams]) => grams > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="weightbar-wrap">
      <div
        className="weightbar"
        role="img"
        aria-label={t('weightbar.total', { weight: formatWeight(total) })}
      >
        {segments.map(([categoryId, grams]) => (
          <span
            key={categoryId}
            className="weightbar-seg"
            style={{ width: `${(grams / total) * 100}%`, background: categoryOf(data, categoryId).color }}
          />
        ))}
      </div>
      {legend && (
        <ul className="weightbar-legend">
          {segments.map(([categoryId, grams]) => {
            const category = categoryOf(data, categoryId)
            return (
              <li key={categoryId}>
                <span className="dot" style={{ background: category.color }} />
                {category.name}
                <span className="mono">{formatWeight(grams)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
