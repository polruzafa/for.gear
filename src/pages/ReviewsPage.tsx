import { Link } from 'react-router-dom'
import { StarRating } from '../components/Stars'
import { getLocale, useI18n } from '../i18n'
import { photoKeys, usePhotos } from '../photos'
import {
  categoryOf,
  groupOf,
  itemOf,
  reviewScore,
  useStore,
  type GearData,
  type GearItem,
  type Group,
  type Review,
} from '../store'

/** Amfitrió de l'enllaç («www.» fora), o l'adreça sencera si no es pot llegir. */
function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function ReviewCard({ data, review }: { data: GearData; review: Review }) {
  const { t } = useI18n()
  const photoUrls = usePhotos(photoKeys(review.id)).filter((u): u is string => u != null)

  const kits = review.kitIds
    .map((kitId) => groupOf(data, kitId))
    .filter((g): g is Group => Boolean(g))
  const items = review.itemIds
    .map((itemId) => itemOf(data, itemId))
    .filter((it): it is GearItem => Boolean(it))
  const sub: string[] = [new Date(review.date).toLocaleDateString(getLocale())]
  if (review.price != null) {
    sub.push(review.price.toLocaleString(getLocale(), { style: 'currency', currency: 'EUR' }))
  }
  const subratings = [
    { key: 'taste', value: review.taste, label: t('review.taste'), stars: 'review.tasteStars' },
    { key: 'cleaning', value: review.cleaning, label: t('review.cleaning'), stars: 'review.cleaningStars' },
    { key: 'price', value: review.priceRating, label: t('review.priceRating'), stars: 'review.priceStars' },
    { key: 'difficulty', value: review.difficulty, label: t('review.difficulty'), stars: 'review.difficultyStars' },
  ] as const
  const score = reviewScore(review)
  const scoreText =
    score !== null ? score.toLocaleString(getLocale(), { maximumFractionDigits: 1 }) : null

  return (
    <div className="card card-link review-card">
      <div className="card-head">
        <Link to={`/menjar/${review.id}`} className="card-title card-title-link">
          {review.name}
        </Link>
        {score !== null && (
          <span className="review-score">
            <StarRating value={Math.round(score)} label={t('review.stars', { n: scoreText! })} />
            <span className="mono review-score-num">{scoreText}</span>
          </span>
        )}
      </div>
      <p className="card-sub">{sub.join(' · ')}</p>
      {(kits.length > 0 || items.length > 0) && (
        <div className="review-gear">
          {kits.map((kit) => (
            <span key={kit.id} className="tag">
              <span className="dot dot-kit" />
              {kit.name}
            </span>
          ))}
          {items.map((item) => (
            <span key={item.id} className="tag">
              <span className="dot" style={{ background: categoryOf(data, item.categoryId).color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}
      {subratings.some((s) => s.value != null) && (
        <div className="review-subratings">
          {subratings.map(
            (s) =>
              s.value != null && (
                <span key={s.key} className="review-subrating">
                  {s.label}
                  <StarRating value={s.value} label={t(s.stars, { n: s.value })} small />
                </span>
              ),
          )}
        </div>
      )}
      <div className="review-body">
        {review.notes && <p className="review-notes">{review.notes}</p>}
        {review.extraIngredients && review.extraIngredients.length > 0 && (
          <p className="hint review-ingredients">+ {review.extraIngredients.join(', ')}</p>
        )}
        {review.url && (
          <a
            className="tag tag-link review-url"
            href={review.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('review.openUrl')}
          >
            {urlHost(review.url)} ↗
          </a>
        )}
        {photoUrls.length > 0 && (
          <div className="review-photos">
            {photoUrls.map((url, i) => (
              <img key={i} className="review-photo" src={url} alt="" loading="lazy" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewsPage() {
  const { data } = useStore()
  const { t } = useI18n()

  // Les més noves primer (la data és ISO: l'ordre alfabètic és cronològic).
  const reviews = [...data.reviews].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <div className="page-head">
        <h1>{t('tabs.reviews')}</h1>
        <Link to="/menjar/nova" className="btn btn-primary">
          {t('reviews.new')}
        </Link>
      </div>

      {reviews.length === 0 && (
        <div className="empty">
          <p>{t('reviews.empty')}</p>
        </div>
      )}

      <ul className="cards">
        {reviews.map((review) => (
          <li key={review.id}>
            <ReviewCard data={data} review={review} />
          </li>
        ))}
      </ul>
    </>
  )
}
