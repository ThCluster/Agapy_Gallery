import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'
import { z } from 'zod'

/** Mot de passe du cahier des charges : 8 à 12 caractères, lettres et chiffres mélangés. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,12}$/

export const loginSchema = z
  .object({
    country: z.string().length(2),
    phone: z.string().trim().min(1, 'login.errors.phoneRequired'),
    password: z.string().min(1, 'login.errors.passwordRequired').regex(PASSWORD_RULE, 'login.errors.passwordFormat'),
    remember: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // L'identifiant est le numéro de téléphone avec l'indicatif du pays
    if (data.phone && !isValidPhoneNumber(data.phone, data.country as CountryCode)) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'login.errors.phoneInvalid' })
    }
  })

export type LoginForm = z.infer<typeof loginSchema>
