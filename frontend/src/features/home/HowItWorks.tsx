import { Baby, GraduationCap, HeartHandshake, TrainFront, User, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { PhotoKey } from '@/mocks/photos'

/** Le parcours du visiteur décrit dans le cahier des charges */
const STEPS: { key: string; photo: PhotoKey }[] = [
  { key: 'station', photo: 'hall_g2' },
  { key: 'cart', photo: 'villa_v4' },
  { key: 'wall', photo: 'villa_v2' },
  { key: 'guide', photo: 'portrait_r1' },
]

/** Les façons de venir : seul, en couple, en famille, entre amis, en classe */
const MODES = [
  { key: 'solo', icon: User },
  { key: 'couple', icon: HeartHandshake },
  { key: 'family', icon: Baby },
  { key: 'friends', icon: Users },
  { key: 'class', icon: GraduationCap },
] as const

export function HowItWorks() {
  const { t } = useTranslation()
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={t('home.how.eyebrow')} title={t('home.how.title')} subtitle={t('home.how.subtitle')} />
        </Reveal>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.key} className="reveal group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
                  <Img photo={step.photo} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute bottom-4 left-4 font-logo text-5xl font-black text-white/90">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-brand-graphite dark:text-white">{t(`home.how.steps.${step.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{t(`home.how.steps.${step.key}.text`)}</p>
              </li>
          ))}
        </ol>

        <Reveal>
          <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand-mist p-6 sm:p-8 lg:flex-row lg:items-center dark:bg-night-card">
            <div>
              <p className="font-semibold text-brand-graphite dark:text-white">{t('home.how.modesTitle')}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {MODES.map(({ key, icon: Icon }) => (
                  <li key={key} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-brand-ink shadow-sm dark:bg-night-field dark:text-slate-200">
                    <Icon className="size-4 text-brand-green dark:text-emerald-400" /> {t(`home.how.modes.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/ville" className="btn-action shrink-0 px-6 py-3 text-[15px]">
              <TrainFront className="size-5" /> {t('home.hero.cta')}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
