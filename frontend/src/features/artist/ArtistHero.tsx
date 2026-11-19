import { ArrowLeft, BadgeCheck, ExternalLink, Eye, MapPin, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Img } from '@/components/ui/Img'
import { formatNumber } from '@/lib/format'
import type { CatalogArtistDetail } from '@/api/catalog'
import { villaPhoto } from './villaPhotos'

type Social = { label: string; url: string; network?: string }

/** Réseau d'un lien (clé de traduction auth.social.<réseau>), déduit de la clé, du libellé ou de l'adresse */
function socialNetwork(s: Social): string {
  const known = ['facebook', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'website']
  const key = (s.network ?? s.label ?? '').toLowerCase()
  if (known.includes(key)) return key
  if (key === 'site web') return 'website'
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, '')
    if (host.endsWith('instagram.com')) return 'instagram'
    if (host.endsWith('facebook.com')) return 'facebook'
    if (host === 'x.com' || host.endsWith('twitter.com')) return 'x'
    if (host.endsWith('tiktok.com')) return 'tiktok'
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube'
    if (host.endsWith('linkedin.com')) return 'linkedin'
  } catch {
    // adresse invalide : libellé générique
  }
  return 'website'
}

export function ArtistHero({ artist }: { artist: CatalogArtistDetail }) {
  const profile = { visits: artist.visits, memberSince: artist.member_since, socials: artist.socials }
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: artist.name, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // partage annulé par l'utilisateur
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      {/* Retour à la liste des artistes */}
      <Link
        to="/artistes"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-green/15 bg-white px-4 py-2 text-sm font-medium text-brand-green transition hover:-translate-x-0.5 hover:bg-brand-mist dark:border-white/10 dark:bg-night-card dark:text-emerald-400"
      >
        <ArrowLeft className="size-4" /> {t('artist.backToArtists')}
      </Link>

      {/* Photo de la villa */}
      <div className="relative h-[260px] overflow-hidden rounded-3xl bg-brand-mist sm:h-[420px]">
        <Img photo={villaPhoto(artist.address)} alt={t('artist.villaOf', { name: artist.name })} priority className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <span className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-brand-graphite shadow-sm backdrop-blur">
          <MapPin className="size-3.5 text-brand-orange" /> {t('artist.address', { n: artist.address })}
        </span>
      </div>

      {/* Carte d'identité, à cheval sur la photo */}
      <div className="relative z-10 mx-auto -mt-20 max-w-6xl rounded-3xl border border-brand-green/10 bg-white/95 p-6 shadow-[0_30px_80px_-40px_rgb(30_46_41/0.45)] backdrop-blur sm:-mt-24 sm:p-8 dark:border-white/10 dark:bg-night-card/95">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <span className="-mt-16 block size-28 shrink-0 overflow-hidden rounded-full bg-brand-mist ring-4 ring-white sm:-mt-20 sm:size-36 dark:ring-night-card">
            <Img src={artist.photo ?? artist.cover} alt={artist.name} priority className="h-full w-full object-cover" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {artist.discipline && <span className="eyebrow">{t(`discipline.${artist.discipline}`)}</span>}
              <span className={artist.free ? 'status-success' : 'status-pending'}>{artist.free ? t('artist.freeGallery') : t('artist.paidGallery')}</span>
            </div>
            <h1 className="mt-2 flex items-center gap-2 text-4xl font-light tracking-tight sm:text-5xl">
              {artist.name}
              <BadgeCheck className="size-7 shrink-0 text-brand-green" aria-label={t('artist.verified')} />
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="size-4" /> {artist.city}, {artist.country}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="size-4" /> {t('artist.visits', { n: formatNumber(profile.visits, i18n.resolvedLanguage) })}
              </span>
              <span>{t('artist.memberSince', { year: profile.memberSince })}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(profile.socials as Social[])
              // Liens saisis par l'artiste : uniquement http(s), jamais javascript: ou autre schéma
              .filter((s) => typeof s.url === 'string' && /^https?:\/\//i.test(s.url))
              .map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-secondary rounded-full px-3 py-1.5 text-xs">
                  {t(`auth.social.${socialNetwork(s)}`)} <ExternalLink className="size-3" />
                </a>
              ))}
            <button type="button" onClick={share} className="grid size-9 place-items-center rounded-full border border-brand-green/20 text-brand-green hover:bg-brand-mist" aria-label={t('artist.share')}>
              <Share2 className="size-4" />
            </button>
            {copied && <span className="text-xs text-brand-green">{t('artist.linkCopied')}</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
