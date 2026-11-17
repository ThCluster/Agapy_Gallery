# AGAPY-GALLERY — frontend

Application React + TypeScript + Tailwind CSS + Vite du site AGAPY-GALLERY.

**La documentation complète est dans le [README à la racine du dépôt](../README.md)** : pages, règles métier,
architecture, charte graphique, traductions, branchement avec Django, décisions et pièges connus.

## Démarrage rapide

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # vérification TypeScript + build de production dans dist/
npm run preview   # sert le build en local (http://localhost:4173)
npm run lint      # oxlint
```

Démo de l’espace artiste : `/connexion` avec un numéro ivoirien valide (ex. `07 00 00 00 00`)
et un mot de passe de 8 à 12 caractères, lettres et chiffres (ex. `ARTS2026`).

## Avant de modifier le code

- Imports avec l’alias `@/…` (= `src/…`).
- Tarifs uniquement dans `src/lib/pricing.ts`, images uniquement via `<Img photo="…" />`.
- Fonds clairs uniquement : le client refuse les sections sombres.
- Tout texte visible passe par les traductions (`src/i18n/locales/`), en français **et** en anglais.
- Avant de livrer : `npx tsc -b`, `npm run lint` et `npm run build` doivent passer.
- Ne pas retirer le correctif Windows de `vite.config.ts` (casse de la lettre de lecteur).
