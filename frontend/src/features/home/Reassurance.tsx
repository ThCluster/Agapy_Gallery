import { ShieldCheck, Smartphone, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Reassurance() {
  const { t } = useTranslation()
  const items = [
    { icon: Smartphone, key: 'payment' },
    { icon: ShieldCheck, key: 'verified' },
    { icon: Wallet, key: 'artists' },
  ] as const

  return (
    <section className="border-t border-brand-graphite/10 dark:border-white/10">
      <ul className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        {items.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-mist text-brand-green dark:bg-night-card dark:text-emerald-400">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold text-brand-graphite dark:text-white">{t(`home.reassurance.${key}.title`)}</span>
              <span className="block text-sm text-gray-500">{t(`home.reassurance.${key}.text`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
