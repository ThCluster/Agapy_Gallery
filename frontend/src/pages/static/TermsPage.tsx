import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSitePage } from '@/api/site'
import { RichText } from './RichText'

interface Section {
  id: string
  title: string
  body: string[]
  items?: string[]
  after?: string[]
}

/** Date de la dernière révision du texte */
const UPDATED = '2026-11-17'

/** Conditions générales d’utilisation et de vente, reprises du cahier des charges. */
export function TermsPage() {
  const { t, i18n } = useTranslation()
  const sections = t('static.terms.sections', { returnObjects: true }) as Section[]
  // Texte publié depuis l'administration ; repli sur le texte local si absent
  const { data: remote } = useSitePage('terms', i18n.resolvedLanguage)
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(remote?.updated_at ?? UPDATED))

  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="eyebrow">{t('static.terms.eyebrow')}</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-5xl dark:text-white">
            {remote?.title || t('static.terms.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.terms.lead')}</p>
          <p className="mt-4 text-sm text-gray-400">{t('static.common.updated', { date })}</p>
          {/* Avertissement : texte non encore validé juridiquement */}
          <p role="note" className="mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            {t('static.common.draftNote')}
          </p>
        </div>
      </header>

      {remote ? (
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6">
          <article className="max-w-3xl">
            <RichText text={remote.body} />
            <p className="mt-10 text-sm text-gray-500">
              <Link to="/infos-legales" className="link">
                {t('static.legal.title')}
              </Link>
              {' · '}
              <Link to="/contact" className="link">
                {t('static.common.contactUs')}
              </Link>
            </p>
          </article>
        </div>
      ) : (
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[16rem_1fr]">
        {/* Sommaire */}
        <nav aria-labelledby="terms-toc" className="lg:sticky lg:top-28 lg:self-start">
          <p id="terms-toc" className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">
            {t('static.common.toc')}
          </p>
          <ol className="mt-4 space-y-1 border-l border-brand-green/15 dark:border-white/10">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-gray-500 transition hover:border-brand-orange hover:text-brand-graphite dark:text-slate-400 dark:hover:text-white">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-b border-brand-green/10 py-10 first:pt-0 last:border-0 dark:border-white/10">
              <h2 className="text-2xl font-light tracking-tight text-brand-graphite dark:text-white">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-4 leading-relaxed text-brand-ink dark:text-slate-300">
                  {p}
                </p>
              ))}
              {s.items && (
                <ul className="mt-4 space-y-2.5">
                  {s.items.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-brand-ink dark:text-slate-300">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {s.after?.map((p) => (
                <p key={p} className="mt-4 leading-relaxed text-brand-ink dark:text-slate-300">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <p className="mt-6 text-sm text-gray-500">
            <Link to="/infos-legales" className="link">
              {t('static.legal.title')}
            </Link>
            {' · '}
            <Link to="/contact" className="link">
              {t('static.common.contactUs')}
            </Link>
          </p>
        </article>
      </div>
      )}
    </>
  )
}
