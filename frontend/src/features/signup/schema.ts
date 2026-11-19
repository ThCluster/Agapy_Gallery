import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'
import { z } from 'zod'
import { AFRICA } from '@/features/auth/countries'
import type { Region } from '@/lib/pricing'

/** Pays et territoires européens facturés en euros (même liste que backend/apps/core/regions.py) */
const EUROPE = [
  // Union européenne (27)
  ...'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' '),
  // Espace économique européen et AELE
  ...'IS LI NO CH'.split(' '),
  // Royaume-Uni et micro-États
  ...'GB MC AD SM VA'.split(' '),
  // Balkans
  ...'AL BA ME MK RS XK'.split(' '),
  // Europe de l'Est
  ...'UA MD BY RU'.split(' '),
  // Territoires européens rattachés
  ...'GI FO GG JE IM AX SJ'.split(' '),
]

/** Zone tarifaire déduite du pays de l'artiste (10 000 F CFA, 30 € ou 35 $) */
export function regionOf(country: string): Region {
  if ((AFRICA as string[]).includes(country)) return 'africa'
  if (EUROPE.includes(country)) return 'europe'
  return 'world'
}

/** Vérifie un IBAN avec sa clé de contrôle (modulo 97) */
export function isValidIban(value: string): boolean {
  const s = value.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let mod = 0
  for (const d of digits) mod = (mod * 10 + Number(d)) % 97
  return mod === 1
}

export const MOMO_OPERATORS = ['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave', 'Airtel Money', 'Free Money'] as const

const MAX_PHOTO_MB = 5
const optionalUrl = z
  .string()
  .trim()
  .refine((v) => !v || /^https?:\/\/[^\s.]+\.\S+$/.test(v), 'signup.errors.url')

export const signupSchema = z
  .object({
    civility: z.string(),
    // Personne physique
    lastName: z.string().trim(),
    firstNames: z.string().trim(),
    birthDate: z.string(),
    birthPlace: z.string().trim(),
    artistName: z.string().trim(),
    // Fondation ou groupement
    orgName: z.string().trim(),
    foundedDate: z.string(),
    foundedPlace: z.string().trim(),
    // Coordonnées
    phoneCountry: z.string().length(2),
    phone: z.string().trim(),
    email: z.string().trim(),
    country: z.string().length(2),
    city: z.string().trim(),
    village: z.string().trim(),
    gps: z.string().trim(),
    photo: z.custom<FileList | undefined>(),
    website: optionalUrl,
    facebook: optionalUrl,
    instagram: optionalUrl,
    // Compte de récupération des fonds
    payoutMomo: z.boolean(),
    momoOperator: z.string(),
    momoNumber: z.string().trim(),
    payoutIban: z.boolean(),
    iban: z.string().trim(),
    accountHolder: z.string().trim(),
    bankName: z.string().trim(),
    // Paiement des frais d'ouverture
    paymentMethod: z.enum(['momo', 'card']),
    acceptTerms: z.boolean(),
  })
  .superRefine((d, ctx) => {
    const need = (path: string, ok: boolean, message = 'signup.errors.required') => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message })
    }
    const today = new Date().toISOString().slice(0, 10)

    need('civility', ['mr', 'mrs', 'org'].includes(d.civility), 'signup.errors.civility')

    if (d.civility === 'org') {
      need('orgName', !!d.orgName)
      need('foundedDate', !!d.foundedDate)
      if (d.foundedDate) need('foundedDate', d.foundedDate <= today, 'signup.errors.futureDate')
      need('foundedPlace', !!d.foundedPlace)
    } else {
      need('lastName', !!d.lastName)
      need('firstNames', !!d.firstNames)
      need('birthDate', !!d.birthDate)
      if (d.birthDate) need('birthDate', d.birthDate <= today, 'signup.errors.futureDate')
      need('birthPlace', !!d.birthPlace)
      need('artistName', !!d.artistName)
    }

    // Le téléphone avec indicatif sert de login : il doit être valide
    need('phone', !!d.phone)
    if (d.phone) need('phone', isValidPhoneNumber(d.phone, d.phoneCountry as CountryCode), 'signup.errors.phone')
    need('email', !!d.email)
    if (d.email) need('email', z.email().safeParse(d.email).success, 'signup.errors.email')
    need('city', !!d.city)
    if (d.gps) need('gps', /^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(d.gps), 'signup.errors.gps')

    const file = d.photo?.[0]
    need('photo', !!file, 'signup.errors.photo')
    if (file) {
      need('photo', file.type.startsWith('image/'), 'signup.errors.photoType')
      need('photo', file.size <= MAX_PHOTO_MB * 1024 * 1024, 'signup.errors.photoSize')
    }

    // Au moins un moyen de recevoir ses gains : mobile money et/ou IBAN
    need('payoutMomo', d.payoutMomo || d.payoutIban, 'signup.errors.payout')
    if (d.payoutMomo) {
      need('momoOperator', !!d.momoOperator)
      need('momoNumber', !!d.momoNumber)
      if (d.momoNumber) need('momoNumber', isValidPhoneNumber(d.momoNumber, d.phoneCountry as CountryCode), 'signup.errors.phone')
    }
    if (d.payoutIban) {
      need('accountHolder', !!d.accountHolder)
      need('iban', !!d.iban)
      if (d.iban) need('iban', isValidIban(d.iban), 'signup.errors.iban')
    }

    need('acceptTerms', d.acceptTerms, 'signup.errors.terms')
  })

export type SignupForm = z.infer<typeof signupSchema>

/** Champs vérifiés à chaque étape avant de passer à la suivante */
export function stepFields(step: number, civility: string): (keyof SignupForm)[] {
  switch (step) {
    case 0:
      return ['civility']
    case 1:
      return civility === 'org' ? ['orgName', 'foundedDate', 'foundedPlace'] : ['lastName', 'firstNames', 'birthDate', 'birthPlace', 'artistName']
    case 2:
      return ['phone', 'email', 'country', 'city', 'village', 'gps', 'photo', 'website', 'facebook', 'instagram']
    case 3:
      return ['payoutMomo', 'momoOperator', 'momoNumber', 'payoutIban', 'iban', 'accountHolder', 'bankName']
    default:
      return ['paymentMethod', 'acceptTerms']
  }
}

export const DEFAULT_VALUES: SignupForm = {
  civility: '',
  lastName: '',
  firstNames: '',
  birthDate: '',
  birthPlace: '',
  artistName: '',
  orgName: '',
  foundedDate: '',
  foundedPlace: '',
  phoneCountry: 'CI',
  phone: '',
  email: '',
  country: 'CI',
  city: '',
  village: '',
  gps: '',
  photo: undefined,
  website: '',
  facebook: '',
  instagram: '',
  payoutMomo: true,
  momoOperator: '',
  momoNumber: '',
  payoutIban: false,
  iban: '',
  accountHolder: '',
  bankName: '',
  paymentMethod: 'momo',
  acceptTerms: false,
}
