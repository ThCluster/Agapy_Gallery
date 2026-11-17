/** Classe commune des champs de saisie */
export const inputClass = (hasError?: boolean) =>
  `w-full rounded-2xl border bg-white px-4 py-3.5 text-[15px] text-brand-graphite transition placeholder:text-gray-400 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 focus:outline-none dark:bg-night-field dark:text-white ${
    hasError ? 'border-rose-400' : 'border-brand-graphite/15 dark:border-white/15'
  }`
