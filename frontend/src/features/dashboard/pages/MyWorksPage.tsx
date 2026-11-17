import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatSize } from '@/lib/format'
import { useArtistSpace, type WorkStatus } from '@/stores/artistSpace'
import { WorkThumb } from '../WorkThumb'

const STATUS_CLASS: Record<WorkStatus, string> = {
  published: 'status-success',
  pending: 'status-pending',
  rejected: 'status-error',
}

/** Œuvres de l'artiste : statut de modération, accès gratuit ou payant, suppression. */
export function MyWorksPage() {
  const { t, i18n } = useTranslation()
  const { works, updateWork, removeWork } = useArtistSpace()
  const [confirm, setConfirm] = useState<string | null>(null)
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('dashboard.nav.works')}</p>
          <h1 className="mt-1 text-3xl font-light tracking-tight">{t('dashboard.works.title', { count: works.length })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('dashboard.works.subtitle')}</p>
        </div>
        <Link to="/tableau-de-bord/publier" className="btn-action rounded-full px-5 py-2.5">
          <Plus className="size-4" /> {t('dashboard.nav.publish')}
        </Link>
      </div>

      {works.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-brand-mist p-10 text-center dark:bg-night-card">
          <p className="font-semibold text-brand-graphite dark:text-white">{t('dashboard.works.empty')}</p>
          <Link to="/tableau-de-bord/publier" className="btn-primary mt-5 rounded-full px-5">
            {t('dashboard.nav.publish')}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {works.map((w) => (
            <li key={w.id} className="flex flex-col gap-4 rounded-2xl border border-brand-green/10 bg-white p-4 sm:flex-row sm:items-center dark:border-white/10 dark:bg-night-card">
              <WorkThumb work={w} className="h-24 w-20" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-graphite dark:text-white">{w.title}</p>
                  <span className={STATUS_CLASS[w.status]}>{t(`dashboard.works.status.${w.status}`)}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {w.technique} · {formatSize(w.size)} · {t('dashboard.works.since', { date: dateFmt.format(new Date(w.createdAt)) })}
                </p>
                {w.status === 'pending' && <p className="mt-1 text-xs text-amber-700">{t('dashboard.works.pendingHint')}</p>}
              </div>

              {/* Œuvre gratuite ou payante : modifiable à tout moment (p. 10) */}
              <label className="flex cursor-pointer items-center gap-3 text-sm text-brand-ink dark:text-slate-300">
                <span>{w.free ? t('artwork.free') : t('dashboard.works.paid')}</span>
                <span className="relative inline-flex">
                  <input type="checkbox" checked={w.free} onChange={(e) => updateWork(w.id, { free: e.target.checked })} className="peer sr-only" />
                  <span className="h-6 w-11 rounded-full bg-brand-graphite/20 transition peer-checked:bg-brand-green peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange" />
                  <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>

              {confirm === w.id ? (
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => removeWork(w.id)} className="btn rounded-full bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-700">
                    {t('dashboard.works.confirmDelete')}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="text-xs text-gray-500 hover:underline">
                    {t('dashboard.cancel')}
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(w.id)} className="grid size-9 place-items-center rounded-full text-gray-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t('dashboard.works.delete', { title: w.title })}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
