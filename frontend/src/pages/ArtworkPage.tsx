import { ArrowLeft, MapPin, Ruler, ShieldCheck, TrainFront } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useArtist, useArtwork, workRatio } from '@/api/catalog'
import { Img } from '@/components/ui/Img'
import { Presented } from '@/components/ui/Presented'
import { SupportCard } from '@/features/artist/SupportCard'
import { errorMessage } from '@/lib/api'
import { disciplineOf } from '@/lib/discipline'
import { formatSize } from '@/lib/format'

/** Page d'une œuvre : présentation, informations, droits d'auteur et soutien à l'artiste. */
export function ArtworkPage() {
  const { artworkId = '' } = useParams()
  const { t } = useTranslation()
  const workQuery = useArtwork(artworkId)
  const work = workQuery.data
  const { data: artist, isPending: artistPending } = useArtist(work?.artist_id ?? '')

  if (workQuery.isPending || (work && artistPending)) {
    return (
      <div className="mx-auto grid max-w-7xl animate-pulse gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr]" aria-busy>
        <div className="min-h-[420px] rounded-3xl bg-brand-mist dark:bg-night-card" />
        <div className="space-y-4">
          <div className="h-10 w-2/3 rounded bg-brand-mist dark:bg-night-card" />
          <div className="h-4 w-1/2 rounded bg-brand-mist dark:bg-night-card" />
          <div className="h-32 rounded bg-brand-mist dark:bg-night-card" />
        </div>
      </div>
    )
  }

  if (!work || !artist) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-28 text-center">
        <h1 className="text-3xl font-light">{t('search.page.artworkNotFound')}</h1>
        {workQuery.error && (workQuery.error as { status?: number }).status !== 404 && <p className="mt-3 text-gray-500">{errorMessage(workQuery.error)}</p>}
        <Link to="/recherche?mode=artwork" className="btn-primary mt-8 rounded-full px-6 py-3">
          {t('artist.notFound.cta')}
        </Link>
      </section>
    )
  }

  const works = artist.artworks
  const discipline = disciplineOf(work)
  const others = works.filter((w) => w.id !== work.id).slice(0, 4)

  return (
    <>
      <section className="bg-gradient-to-b from-[#f4f1ec] to-white dark:from-night-card dark:to-night-bg">
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-14 sm:px-6">
          <Link to={`/artistes/${artist.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/15 bg-white px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-mist dark:border-white/10 dark:bg-night-card dark:text-emerald-400">
            <ArrowLeft className="size-4" /> {t('payment.back', { name: artist.name })}
          </Link>

          <div className="mt-8 grid items-start gap-12 lg:grid-cols-[1.2fr_1fr]">
            {/* L'œuvre accrochée au mur, sous un halo de lumière */}
            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-3xl bg-[#f4f1ec] px-6 py-14 dark:bg-night-card">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/0.95),transparent_65%)]" />
              <div className="relative">
                <Presented discipline={discipline} src={work.image} size={workRatio(work)} alt={`${work.title}, ${artist.name}`} large />
              </div>
            </div>

            <div>
              <p className="eyebrow">{t(`discipline.${discipline}`)}</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">{work.title}</h1>
              <Link to={`/artistes/${artist.id}`} className="mt-4 flex items-center gap-3 text-brand-ink hover:text-brand-green dark:text-slate-300">
                <span className="block size-10 overflow-hidden rounded-full bg-brand-mist">
                  <Img src={artist.photo ?? artist.cover} alt="" className="h-full w-full object-cover" />
                </span>
                <span>
                  <span className="block font-semibold">{artist.name}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="size-3" /> {artist.city}, {artist.country}
                  </span>
                </span>
              </Link>

              <p className="mt-6 text-[17px] leading-relaxed text-brand-ink dark:text-slate-300">{work.summary ||
                  t('catalog.artwork.summary', { title: work.title, name: artist.name, city: artist.city, technique: work.technique, h: work.size[0], w: work.size[1] })}</p>

              <dl className="mt-6 divide-y divide-brand-graphite/10 border-y border-brand-graphite/10 text-sm dark:divide-white/10 dark:border-white/10">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-gray-500">{t('artist.technique')}</dt>
                  <dd className="text-right text-brand-graphite dark:text-white">{work.technique}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    <Ruler className="size-4" /> {t('artist.dimensions')}
                  </dt>
                  <dd className="text-brand-graphite dark:text-white">{formatSize(work.size)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-gray-500">{t('artwork.villa')}</dt>
                  <dd className="text-brand-graphite dark:text-white">{t('artist.address', { n: artist.address })}</dd>
                </div>
              </dl>
              {(work.copyright_office || artist.copyright_office) && (
                <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <ShieldCheck className="size-4 text-brand-green" /> {t('artist.protectedBy', { office: work.copyright_office || artist.copyright_office })}
                </p>
              )}
              <Link to={`/ville/${artist.id}`} className="btn-action mt-6 rounded-full px-6 py-3">
                <TrainFront className="size-4" /> {t('artwork.seeInVilla')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="text-2xl font-light tracking-tight">{t('artwork.moreBy', { name: artist.name })}</h2>
          {others.length ? (
            <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              {others.map((w) => (
                <li key={w.id}>
                  <Link to={`/oeuvres/${w.id}`} className="group block">
                    <span className="block transition duration-500 group-hover:-translate-y-1">
                      <Presented discipline={disciplineOf(w)} src={w.image} size={workRatio(w)} alt={w.title} />
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-brand-graphite group-hover:text-brand-green dark:text-white">{w.title}</span>
                    <span className="block text-xs text-gray-500">{w.technique}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">{t('artwork.onlyOne')}</p>
          )}
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <SupportCard artist={artist} />
        </aside>
      </section>
    </>
  )
}
