import { Brush, Car, Home, Palette, TrainFront, UserRound, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import type { PhotoKey } from '@/mocks/photos'

interface Item {
  title: string
  text: string
}

/** Icône et photo de chaque étape de la visite */
const CONCEPT_ICONS = [TrainFront, Car, Home, UserRound] as const
const CONCEPT_PHOTOS: PhotoKey[] = ['hero_hall', 'villa_v3', 'villa_v2', 'hall_g2']
const TARGET_ICONS = [Palette, Users] as const

/** « Qui sommes-nous ? » : vision, objectifs, concept de la ville et porteur du projet (cahier des charges). */
export function AboutPage() {
  const { t } = useTranslation()
  const vision = t('static.about.vision', { returnObjects: true }) as string[]
  const objectives = t('static.about.objectives', { returnObjects: true }) as string[]
  const concept = t('static.about.concept', { returnObjects: true }) as Item[]
  const targets = t('static.about.targets', { returnObjects: true }) as Item[]

  return (
    <>
      {/* En-tête */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow">{t('static.about.eyebrow')}</p>
            <h1 className="mt-3 text-4xl leading-tight font-light tracking-tight text-brand-graphite sm:text-6xl dark:text-white">
              {t('static.about.titleStart')} <span className="font-semibold text-brand-green dark:text-emerald-400">{t('static.about.titleEnd')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-500 dark:text-slate-400">{t('static.about.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/ville" className="btn-primary rounded-full px-6 py-3">
                <TrainFront className="size-4" /> {t('static.about.ctaVisit')}
              </Link>
              <Link to="/inscription" className="btn-account rounded-full px-6 py-3">
                {t('static.about.ctaArtist')}
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-50px_rgb(30_46_41/0.6)]">
              <Img photo="hero_gallery" alt={t('static.about.imageAlt')} priority className="aspect-[4/3] h-full w-full object-cover" />
            </div>
            <span className="absolute -bottom-6 left-6 hidden border-[6px] border-[#2b2b2b] bg-white p-2 shadow-xl sm:block" aria-hidden>
              <span className="block h-28 w-20 overflow-hidden">
                <Img photo="art_a5" alt="" className="h-full w-full object-cover" />
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow">{t('static.about.visionEyebrow')}</p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.about.visionTitle')}</h2>
          {vision.map((p) => (
            <p key={p} className="mt-6 text-lg leading-relaxed text-brand-ink dark:text-slate-300">
              {p}
            </p>
          ))}
        </Reveal>
      </section>

      {/* Objectifs */}
      <section className="bg-brand-mist py-20 dark:bg-night-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="eyebrow">{t('static.about.objectivesEyebrow')}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.about.objectivesTitle')}</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-brand-green/10 bg-brand-green/10 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10 dark:bg-white/10">
            {objectives.map((o, i) => (
              <li key={o} className="bg-white p-7 dark:bg-night-bg">
                <span className="text-3xl font-light text-brand-orange">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-4 leading-relaxed text-brand-ink dark:text-slate-300">{o}</p>
              </li>
            ))}
            {/* Case finale décorative pour compléter la grille de 8 */}
            <li className="hidden items-center justify-center bg-white p-7 sm:flex dark:bg-night-bg" aria-hidden>
              <Brush className="size-10 text-brand-green/30" />
            </li>
          </ol>
        </div>
      </section>

      {/* Concept */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">{t('static.about.conceptEyebrow')}</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.about.conceptTitle')}</h2>
          <p className="mt-4 text-gray-500 dark:text-slate-400">{t('static.about.conceptLead')}</p>
        </div>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {concept.map((step, i) => {
            const Icon = CONCEPT_ICONS[i] ?? Home
            return (
              <li key={step.title}>
                <Reveal>
                  <span className="block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
                    <Img photo={CONCEPT_PHOTOS[i] ?? 'hall_g1'} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-5 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-xs font-semibold tracking-[0.2em] text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-brand-graphite dark:text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-slate-400">{step.text}</p>
                </Reveal>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Publics */}
      <section className="bg-[#f4f1ec] py-20 dark:bg-night-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="eyebrow">{t('static.about.targetsEyebrow')}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.about.targetsTitle')}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {targets.map((target, i) => {
              const Icon = TARGET_ICONS[i] ?? Users
              return (
                <article key={target.title} className="rounded-3xl bg-white p-8 dark:bg-night-bg">
                  <span className="grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-emerald-400">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-brand-graphite dark:text-white">{target.title}</h3>
                  <p className="mt-2 leading-relaxed text-gray-500 dark:text-slate-400">{target.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Porteur du projet */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="eyebrow">{t('static.about.ownerEyebrow')}</p>
        <h2 className="mt-3 text-3xl font-light tracking-tight text-brand-graphite sm:text-4xl dark:text-white">{t('static.about.ownerTitle')}</h2>
        <p className="mt-5 text-lg leading-relaxed text-brand-ink dark:text-slate-300">{t('static.about.ownerText')}</p>
        <p className="mt-6 text-xl font-light text-brand-green italic dark:text-emerald-400">{t('static.about.slogan')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/inscription" className="btn-action rounded-full px-6 py-3">
            {t('static.about.ctaArtist')}
          </Link>
          <Link to="/contact" className="btn-secondary rounded-full px-6 py-3">
            {t('static.common.contactUs')}
          </Link>
        </div>
      </section>
    </>
  )
}
