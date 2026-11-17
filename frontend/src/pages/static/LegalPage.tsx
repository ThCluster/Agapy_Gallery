import { Building2, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

interface Section {
  id: string
  title: string
  body: string[]
}

/** Téléphone de G’A HOLDING, affiché et composable */
const PHONE = '+225 25 22 00 86 05'

/** Mentions légales : éditeur, hébergeur, propriété intellectuelle, données personnelles et cookies. */
export function LegalPage() {
  const { t } = useTranslation()
  const sections = t('static.legal.sections', { returnObjects: true }) as Section[]
  const todo = t('static.common.toComplete')

  const publisher: [label: string, value: string][] = [
    [t('static.legal.addressLabel'), t('static.legal.address')],
    [t('static.legal.phoneLabel'), PHONE],
    [t('static.legal.capitalLabel'), t('static.legal.capital')],
    [t('static.legal.rccmLabel'), t('static.legal.rccm')],
    [t('static.legal.directorLabel'), todo],
  ]

  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="eyebrow">{t('static.legal.eyebrow')}</p>
          <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-5xl dark:text-white">{t('static.legal.title')}</h1>
          <p className="mt-5 text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.legal.lead')}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        {/* Éditeur */}
        <section aria-labelledby="legal-publisher" className="rounded-3xl border border-brand-green/10 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-night-card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-emerald-400">
              <Building2 className="size-5" />
            </span>
            <h2 id="legal-publisher" className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
              {t('static.legal.publisherTitle')}
            </h2>
          </div>
          <p className="mt-5 text-brand-ink dark:text-slate-300">{t('static.legal.publisherText')}</p>
          <p className="mt-1 text-lg font-semibold text-brand-graphite dark:text-white">{t('static.legal.company')}</p>
          <p className="text-sm text-brand-green italic dark:text-emerald-400">{t('static.legal.slogan')}</p>
          <dl className="mt-6 divide-y divide-brand-green/10 border-t border-brand-green/10 dark:divide-white/10 dark:border-white/10">
            {publisher.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className={`text-sm break-words ${value === todo ? 'text-amber-700 dark:text-amber-300' : 'text-brand-graphite dark:text-white'}`}>
                  {value === PHONE ? (
                    <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="link">
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Hébergeur */}
        <section aria-labelledby="legal-host" className="mt-6 rounded-3xl bg-brand-mist p-6 sm:p-8 dark:bg-night-card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-white text-brand-green dark:bg-night-field dark:text-emerald-400">
              <Server className="size-5" />
            </span>
            <h2 id="legal-host" className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">
              {t('static.legal.hostTitle')}
            </h2>
          </div>
          <dl className="mt-5 grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-sm text-gray-500">{t('static.legal.hostLabel')}</dt>
            <dd className="text-sm text-amber-700 dark:text-amber-300">{todo}</dd>
          </dl>
        </section>

        {/* Propriété intellectuelle, données, cookies */}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-28 border-b border-brand-green/10 py-10 last:border-0 dark:border-white/10">
            <h2 className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-4 leading-relaxed text-brand-ink dark:text-slate-300">
                {p}
              </p>
            ))}
            {s.id === 'donnees' && (
              <Link to="/contact" className="btn-secondary mt-6 rounded-full px-5 py-2.5">
                {t('static.legal.contactCta')}
              </Link>
            )}
          </section>
        ))}

        <p className="mt-4 text-sm text-gray-500">
          <Link to="/conditions-generales" className="link">
            {t('static.terms.eyebrow')}
          </Link>
        </p>
      </div>
    </>
  )
}
