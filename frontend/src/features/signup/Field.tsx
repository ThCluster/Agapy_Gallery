import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
  children: ReactNode
  className?: string
}

/** Champ de formulaire : libellé, contenu, aide ou message d'erreur. */
export function Field({ id, label, error, hint, optional, children, className = '' }: Props) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium text-brand-graphite dark:text-white">
        {label}
        {optional && <span className="text-xs font-normal text-gray-400">{t('signup.optional')}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-rose-600">
          {t(error)}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
