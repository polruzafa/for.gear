import { LANGS, useI18n } from '../i18n'

export default function SettingsPage() {
  const { lang, setLang, t } = useI18n()

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <h2>{t('settings.language')}</h2>
      <div className="chips" role="group" aria-label={t('settings.language')}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            className={`chip${lang === l.code ? ' chip-on' : ''}`}
            lang={l.code}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <dl className="facts">
        <div>
          <dt>{t('settings.version')}</dt>
          <dd className="mono">
            {__VERSION__} · {__COMMIT__}
          </dd>
        </div>
      </dl>
    </>
  )
}
