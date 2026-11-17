# AGAPY-GALLERY

Galerie d’art virtuelle en 3D pour les artistes, surtout africains : peintres, photographes, sculpteurs.
Les visiteurs se promènent dans une ville virtuelle et entrent dans la villa de chaque artiste.
Il y a de l’argent à chaque étape : les artistes paient l’hébergement et la publication, les visiteurs paient la visite ou font un don.

> Projet de **Global’Actions Holding (G’A HOLDING)**, Abidjan. Le cahier des charges de référence est
> « CAHIER DE CHARGES AGAPY-GALLERY » (17 pages) : les numéros de page cités dans ce document et dans le code y renvoient.

---

## Sommaire

1. [État du projet](#1-état-du-projet)
2. [Démarrer en 5 minutes](#2-démarrer-en-5-minutes)
3. [Organisation du dépôt](#3-organisation-du-dépôt)
4. [Technologies](#4-technologies)
5. [Pages et adresses du site](#5-pages-et-adresses-du-site)
6. [Règles métier (tarifs, répartition, comptes)](#6-règles-métier)
7. [Architecture du frontend](#7-architecture-du-frontend)
8. [Charte graphique et conventions de design](#8-charte-graphique-et-conventions-de-design)
9. [Traductions](#9-traductions)
10. [Branchement avec le backend Django](#10-branchement-avec-le-backend-django)
11. [Décisions prises](#11-décisions-prises)
12. [Pièges connus](#12-pièges-connus)
13. [Reste à faire](#13-reste-à-faire)
14. [Questions ouvertes](#14-questions-ouvertes)
15. [Crédits](#15-crédits)

---

## 1. État du projet

| Partie | État |
|---|---|
| **Site web classique** (accueil, artistes, recherche, paiement, inscription, espace artiste, pages fixes) | ✅ Terminé côté frontend, avec des **données simulées** |
| **Monde 3D** (gare, train, voiturette, ville, villas, avatars) | 🔴 Seule une scène d’essai existe (`/ville`) |
| **Backend** (API, administration, paiements réels, SMS, e-mails) | 🔴 À faire en **Django** |
| **Branchement frontend ↔ API** | 🟠 Points d’entrée prêts et marqués `TODO` (voir [§ 10](#10-branchement-avec-le-backend-django)) |

Tout le frontend fonctionne **sans serveur** : les artistes, œuvres, revenus, paiements et la connexion sont simulés
pour pouvoir montrer et tester le parcours complet.

---

## 2. Démarrer en 5 minutes

Prérequis : **Node.js 24** (ou 22 LTS minimum) et npm.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Vérification TypeScript puis build de production dans `frontend/dist/` |
| `npm run preview` | Sert le build de production en local (http://localhost:4173) |
| `npm run lint` | Analyse du code (oxlint, règles React) |

**Se connecter à l’espace artiste (démo)** : ouvrir `/connexion`, saisir n’importe quel numéro ivoirien valide
(ex. `07 00 00 00 00`) et un mot de passe de 8 à 12 caractères avec lettres et chiffres (ex. `ARTS2026`).
On arrive dans l’espace d’« Awa Koné », artiste d’exemple.

---

## 3. Organisation du dépôt

```
agapy_galerie/
├── README.md                 ← ce document
├── brand/logo/               ← travail sur le logo (sources SVG, rendus PNG)
│   └── v4/                   ← logo retenu : A en arche, p en carte de l’Afrique, G au soleil
└── frontend/                 ← application React (tout le site)
    ├── public/
    │   ├── brand/            ← logo du site (logo.svg couleur, logo-white.svg pour fonds verts/photos)
    │   ├── images/           ← photos d’exemple en WebP (+ CREDITS.md)
    │   ├── favicon.svg, apple-touch-icon.png
    └── src/                  ← voir § 7
```

Le backend Django n’est pas encore dans ce dépôt.

---

## 4. Technologies

| Besoin | Outil | Version |
|---|---|---|
| Interface | React + TypeScript | 19 / 7 |
| Outil de build | Vite | 8 |
| Styles | Tailwind CSS (configuration dans `src/index.css`, pas de fichier `tailwind.config`) | 4 |
| Navigation | react-router (routes déclarées dans `src/app/router.tsx`) | 8 |
| Formulaires et validation | react-hook-form + zod | 7 / 4 |
| Numéros de téléphone | libphonenumber-js | — |
| État partagé | zustand (avec sauvegarde en `sessionStorage`) | 5 |
| Requêtes API (prévu) | @tanstack/react-query | 5 |
| Graphiques | recharts | 3 |
| Traductions | i18next + react-i18next | — |
| Icônes | lucide-react | — |
| 3D | three.js + @react-three/fiber + drei + rapier (physique) | — |
| Simulation d’API (prévu) | msw | — |

---

## 5. Pages et adresses du site

### Site public (avec en-tête et pied de page)

| Adresse | Page | Fichier |
|---|---|---|
| `/` | Accueil | `pages/HomePage.tsx` + `features/home/*` |
| `/artistes` | Liste des artistes (filtres, recherche) | `pages/ArtistsPage.tsx` |
| `/artistes/:id` | Page d’un artiste (villa, œuvres, soutien) | `pages/ArtistPage.tsx` + `features/artist/*` |
| `/oeuvres/:id` | Page d’une œuvre | `pages/ArtworkPage.tsx` |
| `/peinture`, `/photographie`, `/sculpture` | Pages par discipline | `pages/DisciplinePage.tsx` |
| `/galeries-gratuites` | Galeries en visite gratuite | `pages/FreeGalleriesPage.tsx` |
| `/recherche?mode=artist\|artwork&q=…&artiste=…` | Recherche (p. 10) | `pages/SearchPage.tsx` |
| `/paiement?artiste=…&visite=1&don=…&zone=…` | Paiement d’une visite et/ou d’un don | `pages/PaymentPage.tsx` |
| `/inscription` | Inscription artiste en 5 étapes | `pages/SignupPage.tsx` + `features/signup/*` |
| `/ville` | Monde 3D (scène d’essai) | `world3d/WorldPage.tsx` |
| `/qui-sommes-nous`, `/conditions-generales`, `/infos-legales`, `/partenaires`, `/contact`, `/forum`, `/publicite` | Pages fixes | `pages/static/*` |

### Pages plein écran (sans navigation publique)

| Adresse | Page |
|---|---|
| `/connexion?retour=/…` | Connexion des artistes (`pages/LoginPage.tsx`) |
| `/mot-de-passe-oublie` | Mot de passe oublié en 3 étapes (`pages/ForgotPasswordPage.tsx`) |
| `/tableau-de-bord` | Espace artiste, **réservé aux artistes connectés** (`features/dashboard/*`) |
| `/tableau-de-bord/oeuvres` | Mes œuvres (statut de modération, gratuit/payant) |
| `/tableau-de-bord/publier` | Publier une œuvre (p. 8-9) |
| `/tableau-de-bord/compte-avoir` | Compte d’Avoir (p. 12-13) |
| `/tableau-de-bord/abonnement` | Renouvellement annuel (p. 8) |
| `/tableau-de-bord/profil` | Profil, statut de la galerie, versements, mot de passe |

L’espace artiste, l’inscription, le paiement et les pages fixes sont **chargés à la demande** pour alléger le premier chargement.

---

## 6. Règles métier

Toutes les valeurs sont centralisées dans **`frontend/src/lib/pricing.ts`**. Ne pas les écrire en dur ailleurs.

### Tarifs

| Élément | Afrique | Europe | Reste du monde | Page |
|---|---|---|---|---|
| Ouverture du compte (avec **1 publication offerte**) | 10 000 F CFA HT (12 000 TTC) | 30 € HT | 35 $ HT | p. 7, 14 |
| Renouvellement annuel | 10 000 F CFA HT | 30 € | 35 $ | p. 8 |
| Publication d’une œuvre | 2 500 F CFA HT (3 000 TTC) ⚠️ | 20 € HT | 25 $ HT | p. 9 |
| Visite d’une galerie | 250 F CFA HT (300 TTC) | 1 € | 1,5 $ | p. 11 |
| Clip vidéo 30 s sur l’accueil, 24 h | 3 000 F CFA HT (3 300 sur facture) | idem | idem | p. 16 |
| Téléchargement de l’application mobile | 100 F CFA | — | — | p. 14 |

TVA : 20 %. ⚠️ Voir les [questions ouvertes](#14-questions-ouvertes).

La **zone tarifaire** du visiteur est devinée à partir de son fuseau horaire et modifiable dans le pied de page (`useRegion`).
Pour un artiste, elle découle de son pays (`regionOf` dans `features/signup/schema.ts`).

### Répartition de l’argent

- **Visite (250 F HT)** : artiste ou fondation 75 % · bureau des droits d’auteur 2 % · compte de provision AGAPY 2 % · AGAPY 20 % · provision AGAPY 1 % (+ 50 F de TVA).
- **Don** : 85 % pour l’artiste, 15 % pour AGAPY.
- **Compte de provision** : une part conservée, traçable par artiste, pour les réclamations futures des autres contributeurs d’une œuvre (p. 12).

### Comptes et règles

- **Seuls les artistes et fondations ont un compte.** Les visiteurs paient sans inscription.
- Identifiant = **numéro de téléphone avec indicatif pays** ; **un numéro = un compte** (un artiste peut avoir plusieurs comptes, avec des numéros différents).
- Mot de passe : **8 à 12 caractères, lettres et chiffres**, modifiable (`PASSWORD_RULE` dans `features/auth/loginSchema.ts`).
- Civilité : Monsieur, Madame ou Raison sociale (fondation ou groupement), avec des champs différents.
- Versements de l’artiste : mobile money **et/ou** IBAN (l’IBAN est vérifié par sa clé, `isValidIban`).
- À chaque date anniversaire, le compte est **mis en veille** : plus de publication possible jusqu’au renouvellement.
- Chaque publication passe par la **modération**. Une œuvre inappropriée est retirée sans remboursement, et l’artiste est mis sur liste rouge pendant au moins 3 mois. Une œuvre volée entraîne l’exclusion définitive.
- Une galerie ou une œuvre peut être **gratuite ou payante**, au choix de l’artiste et à tout moment. La gratuité peut être limitée dans le temps.
- **Compte d’Avoir** : porte-monnaie facultatif de l’artiste, créé à l’inscription mais désactivé par défaut. Il sert à payer les publications et les renouvellements.
- **Compteur d’artistes** : il affiche au minimum 1 500 et ne monte qu’à partir de la 1 501ᵉ inscription (`lib/artistCounter.ts`).
- **Recherche** : si l’artiste n’existe pas, le site affiche « L’artiste recherché ne figure pas sur AGAPY-GALLERY ». Si plusieurs œuvres ont le même titre, il propose de préciser avec le nom de l’artiste.
- **Publicités** : 468×60, Skyscraper 160×600, 1 à 3 boutons 88×31, Billboard 336×280, habillage de page, panneaux dans la ville 3D, clips de 30 s (50 en boucle sur 24 h, file d’attente), AGAPY TV en direct.

---

## 7. Architecture du frontend

```
frontend/src/
├── app/router.tsx          ← toutes les routes (chargement à la demande via `load`)
├── main.tsx                ← point d’entrée
├── index.css               ← Tailwind : couleurs de la charte, composants (.btn-primary, .card…), animations
├── components/
│   ├── layout/             ← RootLayout, SiteHeader (barre transparente → verre), SiteFooter
│   └── ui/                 ← briques réutilisables : Img, Logo, AdSlot, ArtworkCard, CarouselSection,
│                             Presented (cadre / tirage photo / socle), Reveal, SectionHeading
├── features/
│   ├── home/               ← sections de l’accueil
│   ├── artist/             ← page artiste : en-tête, muret d’entrée, mosaïque, visionneuse, carte de soutien
│   ├── auth/               ← connexion : règles du formulaire, pays, vitrine d’œuvres
│   ├── signup/             ← inscription : étapes, règles de validation, champ téléphone
│   └── dashboard/          ← espace artiste : mise en page, pages, graphique des revenus, cadres virtuels
├── pages/                  ← une page par adresse ; pages/static/ = pages fixes
├── world3d/                ← monde 3D (scène d’essai)
├── stores/
│   ├── auth.ts             ← session de l’artiste (simulée)
│   └── artistSpace.ts      ← abonnement, Compte d’Avoir, œuvres, statut de la galerie (simulés)
├── lib/                    ← pricing.ts (tarifs), format.ts (F CFA, dimensions), search.ts (recherche sans accents,
│                             suggestions), discipline.ts, artistCounter.ts
├── mocks/                  ← DONNÉES D’EXEMPLE à remplacer par l’API
│   ├── homeData.ts         ← artistes, œuvres, clips, interviews (fictifs)
│   ├── artistProfiles.ts   ← biographies, villas, bureaux de droits d’auteur
│   └── photos.ts           ← catalogue des images de public/images (dimensions, photographe)
├── types/catalog.ts        ← types Artist, Artwork, Interview, Clip
└── i18n/                   ← traductions (voir § 9)
```

**Alias d’import** : `@/…` pointe vers `src/…` (ex. `import { Img } from '@/components/ui/Img'`).

**Images** : toujours passer par `<Img photo="cle" />`. Ce composant fixe les dimensions (pas de saut de mise en page),
charge les images hors écran plus tard et décode sans bloquer la page. Les photos sont en WebP, environ 2 Mo pour 41 images.

---

## 8. Charte graphique et conventions de design

### Couleurs (définies dans `src/index.css`)

| Nom Tailwind | Code | Usage |
|---|---|---|
| `brand-green` | `#00674F` | Couleur principale : boutons, liens, prix |
| `brand-green-hover` | `#00513D` | Survol, mot « gapy » |
| `brand-orange` | `#FF7518` | Actions (visiter, publier, payer), petits titres |
| `brand-yellow` | `#F7CA44` | Touches sur fond vert (logo blanc) |
| `brand-graphite` | `#1E2E29` | Grands titres |
| `brand-ink` | `#2D423B` | Texte courant |
| `brand-mist` | `#F4F7F5` | Fonds des encadrés |

Pour les **graphiques**, on utilise des nuances voisines, validées pour les personnes daltoniennes : vert `#079669` et orange `#D2570B`
(`features/dashboard/RevenueChart.tsx`).

**Polices** : Plus Jakarta Sans (site) et Mulish (logo), chargées depuis Google Fonts dans `index.html`.

### Classes prêtes à l’emploi

`.btn-primary` (vert), `.btn-action` (orange), `.btn-secondary`, `.btn-account` (animé), `.card`, `.field`, `.link`,
`.eyebrow` (petit titre orange), `.price`, `.status-success | -pending | -waiting | -error`, `.banner-green`, `.no-scrollbar`.

### Règles du client à respecter

- **Pas de fonds sombres** : le client les refuse. Il faut des sections claires (blanc, `brand-mist`, mur de galerie `#f4f1ec`) et du verre dépoli sur les photos (`bg-white/10 backdrop-blur`). Le seul fond foncé restant est le pied de page vert de la charte.
- Style **« pur art », lumineux et luxueux** : beaucoup d’espace, grands titres en `font-light`, œuvres présentées dans des cadres, sur des socles ou en tirages.
- Le site doit fonctionner sur **mobile, tablette et ordinateur**, et être vérifié à 390 px de large.
- Les animations sont désactivées si l’utilisateur a réduit les animations dans son système (`prefers-reduced-motion`).

### Logo

**A** en arche (porte d’entrée), **p** en carte de l’Afrique, **G** avec un soleil. Fichiers : `public/brand/logo.svg` (couleur),
`logo-white.svg` (blanc et jaune, pour les fonds verts et les photos), `favicon.svg` (l’arche seule).
Les sources sont dans `brand/logo/v4/`. Une version avec une colombe a été essayée (`brand/logo/v5/`) puis **refusée**.

---

## 9. Traductions

Le site est en **français** (langue par défaut) et en **anglais**. La langue est détectée automatiquement et modifiable dans l’en-tête.

| Fichier | Contenu |
|---|---|
| `i18n/locales/fr.json`, `en.json` | Site public : en-tête, accueil, artistes, recherche, paiement, inscription… |
| `i18n/locales/pages.fr.json`, `pages.en.json` | Pages fixes (clé `static`) |
| `i18n/locales/dashboard.fr.json`, `dashboard.en.json` | Espace artiste (clé `dashboard`) et mot de passe oublié (clé `forgot`) |

⚠️ Les fichiers sont fusionnés **à plat** dans `i18n/index.ts`. Une même clé de premier niveau ne doit donc exister
que dans **un seul** fichier, sinon l’un écrase l’autre.

**Ajouter une langue** : créer les trois fichiers `xx.json`, les importer dans `i18n/index.ts` et ajouter `'xx'` à `SUPPORTED_LANGUAGES`.

---

## 10. Branchement avec le backend Django

Le frontend est prêt à être relié à une API. Chaque endroit où il faudra appeler le serveur est marqué d’un commentaire `TODO` :

| Fichier | Ce qu’il faut brancher |
|---|---|
| `stores/auth.ts` | Connexion (numéro + mot de passe) → session / jeton |
| `pages/SignupPage.tsx` | Inscription + paiement des frais d’ouverture ; envoi des identifiants par e-mail et SMS |
| `pages/ForgotPasswordPage.tsx` | Envoi du code SMS, vérification, nouveau mot de passe |
| `pages/PaymentPage.tsx` | Transaction chez le prestataire de paiement (visite et/ou don), puis confirmation |
| `features/dashboard/pages/PublishPage.tsx` | Envoi de l’œuvre et de l’image + paiement → file de modération |
| `features/dashboard/pages/SubscriptionPage.tsx` | Paiement du renouvellement annuel |
| `features/dashboard/pages/WalletPage.tsx` | Recharge du Compte d’Avoir |
| `features/dashboard/pages/ProfilePage.tsx` | Enregistrement du profil, des versements, du mot de passe |
| `features/home/HeroSection.tsx` | Nombre réel d’artistes (compteur) |
| `components/layout/SiteFooter.tsx` | Inscription à la newsletter |
| `pages/static/ContactPage.tsx` | Formulaire « Nous écrire » |
| `pages/static/AdvertisingPage.tsx` | Téléversement du clip, paiement, mise en file d’attente |

À remplacer aussi : **toutes les données de `src/mocks/`** et les deux stores simulés (`stores/auth.ts`, `stores/artistSpace.ts`).
Le plus simple est d’utiliser `@tanstack/react-query`, déjà installé. Les **revenus** du graphique sont générés dans
`features/dashboard/revenue.ts` : l’API devra fournir les montants **nets pour l’artiste**, par jour.

### Paiements

- **Mobile money** : le visiteur choisit son opérateur (Orange Money, MTN MoMo, Moov Money, Wave) et son numéro, puis confirme sur son téléphone.
- **Carte bancaire** : **redirection vers la page sécurisée du prestataire** (3-D Secure). Le site ne voit **jamais** le numéro de carte, ce qui évite les obligations PCI-DSS. Il ne faut pas ajouter de champ de numéro de carte dans le frontend.
- Prestataire à choisir : CinetPay, PayDunya, Jeko…

### Ce qui relève uniquement de Django

- **L’administration AGAPY** : modération des œuvres, liste rouge, classement des artistes les plus visités et les plus rentables (p. 13). Elle n’est **pas** dans le frontend.
- La mise en veille automatique des comptes à la date anniversaire.
- La répartition de chaque paiement et le compte de provision.
- Les SMS et e-mails, dont le message trimestriel « vous avez une disponibilité financière de … » (p. 17).

---

## 11. Décisions prises

| Décision | Raison |
|---|---|
| **Pas de compte visiteur** (ni inscription, ni connexion, ni favoris) | Le cahier des charges n’exige un compte que pour les artistes |
| Administration faite dans **Django**, pas dans le frontend | Choix de l’équipe |
| Charte **AGAPY** (vert #00674F, orange #FF7518) au lieu de « gris, orange, vert » | Charte commune de la famille AGAPY, imposée par le client |
| Fonds clairs uniquement | Préférence du client |
| Couples de même sexe : **pas d’interdiction** dans l’interface (« en couple ») | L’interdiction de la p. 3 est discriminatoire et illégale dans plusieurs pays visés, notamment en Europe ; point à rediscuter avec le client |
| Paiement par carte via la page du prestataire | Sécurité (PCI-DSS) |
| Prix TTC affichés pour l’Afrique, HT ailleurs | La TVA n’est précisée que pour l’Afrique dans le cahier des charges |

---

## 12. Pièges connus

- **Windows, casse de la lettre de lecteur** (`c:\` contre `C:\`) : Vite chargeait React en double et la page restait blanche. La solution est dans `vite.config.ts` : la racine et l’alias `@` utilisent tous les deux `fs.realpathSync.native`. **Ne pas la retirer.**
- **`window.scrollTo()` renvoie une promesse** dans les Chrome récents : dans un `useEffect`, il faut toujours l’entourer d’accolades, sinon React plante avec « destroy is not a function ».
- **Drapeaux en emoji** : sous Windows, ils s’affichent comme deux lettres. On utilise donc une pastille avec le code pays.
- **Séparateur des milliers** : `formatNumber` remplace l’espace fine (presque invisible dans Plus Jakarta Sans) par une espace insécable.
- **Animations d’apparition** : elles sont en CSS pur (`animation-timeline: view()`), sans JavaScript, pour qu’aucun contenu ne puisse rester caché.
- **Lint** : oxlint applique les règles du compilateur React. Pas de `setState` synchrone dans un effet, pas d’appel impur (`Date.now()`, `new Date()`) pendant le rendu, pas d’accès à une ref pendant le rendu.

---

## 13. Reste à faire

1. **Monde 3D** (le plus gros chantier, p. 2-4) :
   - choix de l’avatar et de la tenue ;
   - mode de visite : seul, en couple, en famille, entre amis, en classe ;
   - train et gare futuriste ;
   - voiturette sans chauffeur qui demande « Où allez-vous ? » ;
   - ville en grande avenue, avec villas duplex vitrées, palmiers et panneaux publicitaires ;
   - villas avec muret d’entrée, halls, cadres virtuels et avatar-guide de l’artiste.

   Ordre conseillé : une villa visitable, puis l’avenue et la voiturette, puis la gare, puis les avatars.
2. **Backend Django** et branchement des `TODO` (§ 10).
3. **Prestataire de paiement**.
4. Remplacer les **photos et artistes d’exemple** par de vrais contenus.
5. **Kit du logo** : déclinaisons, guide d’utilisation.
6. Applications **Apple et Android**, **AGAPY TV** en direct.
7. Hébergement, nom de domaine, référencement.

---

## 14. Questions ouvertes

1. **Prix de publication** : la p. 9 annonce « 5 000 F CFA HT », mais la facture détaillée donne 2 500 F HT + 500 F de TVA = 3 000 F TTC. Le site utilise **2 500 F HT** pour l’instant.
2. **TVA hors d’Afrique** : faut-il l’appliquer aux tarifs en € et en $ ?
3. **Pied de page** : faut-il garder le vert de la charte, ou passer en clair comme le reste du site ?
4. **Infos légales** : directeur de publication, hébergeur, et date exacte de la loi n° 2013-450 sur les données personnelles.
5. **Conditions générales** : le texte actuel est un **projet** à faire valider par un juriste.
6. **Couples** : la règle de la p. 3 est à rediscuter avec le client (voir § 11).

---

## 15. Crédits

- **Photos d’exemple** : Unsplash (licence Unsplash, usage commercial gratuit). La liste des photographes est dans `frontend/public/images/CREDITS.md`. Certaines photos montrent de vraies personnes associées à des **noms d’artistes fictifs** : **elles doivent être remplacées avant la mise en ligne**.
- **Polices** : Plus Jakarta Sans, Montserrat et Mulish, sous licence SIL Open Font License.
- **Icônes** : Lucide (licence ISC).
