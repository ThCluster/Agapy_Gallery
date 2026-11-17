import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import { ChevronDown } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AFRICA, countryName, OTHERS } from '@/features/auth/countries'

interface Props {
  id: string
  country: string
  countryField: UseFormRegisterReturn
  numberField: UseFormRegisterReturn
  hasError?: boolean
  placeholder?: string
}

/** Numéro de téléphone avec sélecteur de pays et d'indicatif (Afrique en premier). */
export function PhoneInput({ id, country, countryField, numberField, hasError, placeholder = '07 00 00 00 00' }: Props) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'fr'
  const option = (code: CountryCode) => (
    <option key={code} value={code}>
      {countryName(code, lng)} (+{getCountryCallingCode(code)})
    </option>
  )

  return (
    <div
      className={`flex items-center rounded-2xl border bg-white transition focus-within:border-brand-orange focus-within:ring-4 focus-within:ring-brand-orange/10 dark:bg-night-field ${
        hasError ? 'border-rose-400' : 'border-brand-graphite/15 dark:border-white/15'
      }`}
    >
      <label className="relative shrink-0 border-r border-brand-graphite/10 dark:border-white/10">
        <span className="sr-only">{t('login.country')}</span>
        <span className="pointer-events-none flex items-center gap-1.5 py-3.5 pr-3 pl-4 text-[15px]" aria-hidden>
          <span className="rounded-md bg-brand-mist px-1.5 py-0.5 text-[11px] font-semibold text-brand-green dark:bg-night-card dark:text-emerald-400">{country}</span>
          <span className="text-brand-graphite dark:text-white">+{getCountryCallingCode(country as CountryCode)}</span>
          <ChevronDown className="size-3.5 text-gray-400" />
        </span>
        <select {...countryField} className="absolute inset-0 cursor-pointer opacity-0">
          <optgroup label={t('login.africa')}>{AFRICA.map(option)}</optgroup>
          <optgroup label={t('login.otherCountries')}>{OTHERS.map(option)}</optgroup>
        </select>
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder}
        aria-invalid={hasError}
        {...numberField}
        className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[15px] text-brand-graphite placeholder:text-gray-400 focus:outline-none dark:text-white"
      />
    </div>
  )
}
