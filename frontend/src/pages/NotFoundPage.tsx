import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <Link to="/" className="link mt-4 inline-block">
        {t('notFound.back')}
      </Link>
    </section>
  )
}
