import type { CountryCode } from 'libphonenumber-js'

/** Pays proposés pour l'indicatif téléphonique : l'Afrique d'abord (cible prioritaire), puis le reste du monde. */
export const AFRICA: CountryCode[] = ['CI', 'SN', 'CM', 'ML', 'BF', 'BJ', 'TG', 'GH', 'NG', 'GN', 'NE', 'GA', 'CG', 'CD', 'MA', 'TN', 'DZ', 'KE', 'RW', 'ZA']
export const OTHERS: CountryCode[] = ['FR', 'BE', 'CH', 'CA', 'US', 'GB', 'DE', 'ES', 'IT']

/** Nom du pays dans la langue de l'interface */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
