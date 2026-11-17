import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

/** Page affichée quand une erreur survient pendant l'affichage d'une page. */
export function ErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : null

  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="eyebrow">{t('error.eyebrow')}</p>
      <h1 className="mt-3 text-3xl font-extrabold">{t('error.title')}</h1>
      <p className="mt-3 text-gray-500">{t('error.text')}</p>
      {import.meta.env.DEV && detail && (
        <pre className="mt-6 overflow-x-auto rounded-lg bg-brand-mist p-4 text-left text-xs text-rose-700">{detail}</pre>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
          {t('error.reload')}
        </button>
        <Link to="/" className="btn-primary">
          {t('notFound.back')}
        </Link>
      </div>
    </section>
  )
}
