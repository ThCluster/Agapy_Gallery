import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { artistById, interviews } from '@/mocks/homeData'

export function InterviewsBand() {
  const { t } = useTranslation()
  return (
    <section className="bg-brand-mist py-24 dark:bg-night-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow={t('home.interviews.eyebrow')}
            title={t('home.interviews.title')}
            actions={
              <Link to="/forum" className="btn-secondary">
                {t('home.interviews.cta')}
              </Link>
            }
          />
        </Reveal>
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
          {interviews.map((it) => {
            const artist = artistById(it.artistId)
            return (
              <Reveal key={it.id}>
                <Link to={`/artistes/${it.artistId}`} className="group block">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                    <Img photo={it.portrait} alt={artist?.name ?? ''} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <p className="mt-4 text-[11px] tracking-[0.16em] text-gray-500 uppercase">{t('home.interviews.meet')}</p>
                  <p className="mt-1 text-lg font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{artist?.name}</p>
                  <p className="text-sm text-gray-500">{it.role}</p>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
