import { ArrowRight, Building, GraduationCap, HandHeart, Info, Landmark, Newspaper, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePartners } from '@/api/site'
import { Img } from '@/components/ui/Img'

interface Category {
  key: string
  title: string
  text: string
}

const ICONS: Record<string, LucideIcon> = {
  copyright: ShieldCheck,
  culture: Landmark,
  payment: Smartphone,
  schools: GraduationCap,
  foundations: HandHeart,
  media: Newspaper,
}

/** Partenaires pressentis : catégories et emplacements réservés (aucun partenariat n’est affirmé). */
export function PartnersPage() {
  const { t } = useTranslation()
  const categories = t('static.partners.categories', { returnObjects: true }) as Category[]
  // Partenaires réels ; sans partenaire publié, on garde les catégories pressenties
  const { data: partners } = usePartners()
  const hasPartners = !!partners?.length

  return (
    <>
      <header className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="eyebrow">{t('static.partners.eyebrow')}</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-6xl dark:text-white">
            {t('static.partners.titleStart')} <span className="font-semibold text-brand-green dark:text-emerald-400">{t('static.partners.titleEnd')}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.partners.lead')}</p>
          {!hasPartners && (
          <p role="note" className="mt-8 inline-flex max-w-2xl items-start gap-3 rounded-2xl bg-white px-5 py-3 text-sm text-gray-600 shadow-sm dark:bg-night-field dark:text-slate-300">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-orange" />
            {t('static.partners.disclaimer')}
          </p>
          )}
        </div>
      </header>

      {hasPartners ? (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {(partners ?? []).map((p) => {
              const content = (
                <>
                  <span className="grid h-24 w-full place-items-center">
                    {p.logo ? (
                      <img src={p.logo} alt={p.name} loading="lazy" className="max-h-20 max-w-full object-contain" />
                    ) : (
                      <Building className="size-10 text-brand-orange" aria-hidden />
                    )}
                  </span>
                  <span className="mt-4 block text-sm font-semibold text-brand-graphite dark:text-white">{p.name}</span>
                </>
              )
              const cls =
                'flex h-full flex-col items-center rounded-3xl border border-brand-green/10 bg-white p-6 text-center transition dark:border-white/10 dark:bg-night-card'
              return (
                <li key={p.id}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:-translate-y-1 hover:shadow-[0_30px_70px_-40px_rgb(30_46_41/0.5)]`}>
                      {content}
                    </a>
                  ) : (
                    <div className={cls}>{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = ICONS[c.key] ?? Building
            return (
              <li key={c.key}>
                <article className="flex h-full flex-col rounded-3xl border border-brand-green/10 bg-white p-7 transition hover:-translate-y-1 hover:shadow-[0_30px_70px_-40px_rgb(30_46_41/0.5)] dark:border-white/10 dark:bg-night-card">
                  <span className="grid size-12 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
                    <Icon className="size-6" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold text-brand-graphite dark:text-white">{c.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-slate-400">{c.text}</p>
                  {/* Emplacements de logos réservés */}
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                    {[0, 1].map((i) => (
                      <span
                        key={i}
                        className="grid h-20 place-items-center rounded-2xl border border-dashed border-brand-graphite/15 bg-brand-mist/60 px-2 text-center text-xs text-gray-400 dark:border-white/15 dark:bg-night-field"
                      >
                        {t('static.partners.logoPlaceholder')}
                      </span>
                    ))}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </section>
      )}

      {/* Appel à l’action */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid overflow-hidden rounded-[2rem] bg-[#f4f1ec] md:grid-cols-[1.2fr_1fr] dark:bg-night-card">
          <div className="p-8 sm:p-12">
            <p className="eyebrow">{t('static.partners.ctaEyebrow')}</p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.partners.ctaTitle')}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-gray-500 dark:text-slate-400">{t('static.partners.ctaText')}</p>
            <Link to="/contact" className="btn-primary mt-8 rounded-full px-6 py-3">
              {t('static.partners.ctaButton')} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="relative hidden min-h-64 md:block">
            <Img photo="hall_g3" alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </section>
    </>
  )
}
