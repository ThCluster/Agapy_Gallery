# AGAPY-GALLERY — Backend (Django)

API et administration de la galerie AGAPY-GALLERY. Le frontend React est dans `../frontend`.

## Démarrer

Prérequis : Python 3.12+ (testé avec 3.14) et MySQL 8 (Laragon en local).

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS : source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env            # puis remplir les valeurs
python manage.py migrate
python manage.py createsuperuser   # identifiant = numéro de téléphone, ex. +2250102030405
python manage.py runserver 8010
```

- Site (frontend, `npm run dev` dans `../frontend`) : http://localhost:5173 — c'est l'adresse à ouvrir dans le navigateur
- API : http://127.0.0.1:8010/api/v1/ (la racine http://127.0.0.1:8010/ redirige vers le site)
- Documentation interactive (Swagger) : http://127.0.0.1:8010/api/docs/
- Administration AGAPY : http://127.0.0.1:8010/admin/

> Le port **8010** est utilisé parce que le 8000 est souvent pris par un autre projet (Laravel/Laragon).

### Base MySQL

```sql
CREATE DATABASE agapy_gallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agapy_gallery'@'localhost' IDENTIFIED BY '...';
GRANT ALL PRIVILEGES ON agapy_gallery.* TO 'agapy_gallery'@'localhost';
-- Pour les tests (Django crée et supprime cette base) :
GRANT ALL PRIVILEGES ON test_agapy_gallery.* TO 'agapy_gallery'@'localhost';
```

### Tests

```bash
python manage.py test apps
```

## Organisation

```
backend/
├── config/            ← réglages (settings.py lit le fichier .env), URL racines
└── apps/
    ├── core/          ← commun : format des erreurs, zones et tarifs (pricing.py), numéros de téléphone
    ├── notifications/ ← envoi des SMS (backend interchangeable) et des e-mails
    ├── accounts/      ← module 1 : comptes artistes, connexion, mot de passe, profil, sanctions
    ├── catalog/       ← module 2 : galeries, œuvres, cadres, publication, recherche, modération
    ├── payments/      ← module 3 : paiements, visites, dons, répartition (grand livre), soldes et retraits
    ├── subscriptions/ ← module 4 : abonnement annuel, mise en veille, Compte d'Avoir
    ├── promotions/    ← module 5 : clips 24 h, espaces publicitaires, TV en ligne
    ├── site_content/  ← module 6 : contact, newsletter, partenaires, pages, compteur, messages aux artistes
    ├── dashboards/    ← module 7 : tableaux de bord artiste et équipe, bilan trimestriel
    └── forum/         ← module 8 : forum de discussion (+ commande seed_demo)
```

Paiements : il n'y a pas encore de prestataire réel, le **simulateur** est le moyen de paiement officiel
(`PAYMENT_SIMULATION_ENABLED=True`, valeur par défaut). Voir « Moyens de paiement » plus bas.

### Données de démonstration

```bash
python manage.py seed_demo          # 8 artistes, 23 œuvres, partenaires, pages, forum (DEBUG uniquement)
python manage.py seed_demo --reset  # supprime d'abord les données de démo
```

Comptes de démo : `+2250700009001` à `+2250700009008`, mot de passe `ARTS2026`.

## Modules 2 à 6 : points d'entrée

Le détail des champs est dans `/api/docs/`. Les tarifs et clés de répartition sont tous dans
`apps/core/pricing.py` (miroir de `frontend/src/lib/pricing.ts`).

| Préfixe | Principaux points d'entrée |
|---|---|
| `/api/v1/catalog/` | public : `artists/`, `artists/<slug>/`, `artworks/`, `artworks/<slug>/`, `search/`, `free-galleries/`, `frames/` — artiste : `me/artworks/` (CRUD), `me/artworks/<slug>/submit/`, `me/gallery/` |
| `/api/v1/payments/` | `quote/`, `<ref>/`, `<ref>/simulate/`, `webhook/<prestataire>/`, `signup/`, `visits/`, `visits/access/` (en-tête `X-Visit-Token`), `donations/` — artiste : `me/balance/`, `me/transactions/`, `me/payouts/` |
| `/api/v1/subscriptions/` | `me/`, `me/renew/`, `me/wallet/` (GET/PATCH), `me/wallet/topup/` |
| `/api/v1/promotions/` | `clips/` (achat), `clips/live/`, `ads/?format=`, `live-tv/` |
| `/api/v1/site/` | `contact/`, `newsletter/`, `newsletter/unsubscribe/`, `partners/`, `pages/<slug>/`, `stats/` |
| `/api/v1/dashboards/` | artiste : `me/summary/`, `me/revenue/?period=day\|week\|month\|quarter\|year` — équipe : `staff/overview/` et la page `/admin/tableau-de-bord/` |
| `/api/v1/forum/` | `categories/`, `topics/` (GET/POST), `topics/<id>/`, `topics/<id>/posts/` (GET/POST), `posts/<id>/report/` |

### Comment les paiements relient les modules

Chaque module crée sa facture avec `apps.payments.services.create_payment()` puis `start_payment()`,
et déclare dans son `payment_handlers.py` ce qu'il faut faire à la confirmation (`@on_paid("publication")`…).
La confirmation (webhook du prestataire, ou `simulate/` en développement) est idempotente.

| Paiement | À la confirmation |
|---|---|
| `signup` | compte activé + identifiants envoyés, abonnement d'un an, Compte d'Avoir (inactif) créé |
| `renewal` | abonnement prolongé d'un an, compte en veille réactivé |
| `publication` | œuvre en attente de modération (la 1re publication est gratuite) |
| `visit` | droit de visite de 24 h (jeton), visite comptée ; 75 % artiste, 2 % bureau de protection, 2 % provision, 20 % AGAPY, 1 % provision AGAPY |
| `donation` | 85 % artiste, 15 % AGAPY (sans TVA) |
| `clip` | clip dans la file (50 en lecture pendant 24 h, les suivants attendent) |
| `wallet_topup` | Compte d'Avoir crédité |

Moyens de paiement : `card` et `momo`, traités par le simulateur (`FakeProvider`) : chaque paiement passe par la page
`/paiement/simulation` du site, qui le confirme ou le refuse. **Aucun argent réel n'est encaissé, et tant que le
simulateur est actif, n'importe qui peut confirmer un paiement** : à garder en tête avant d'ouvrir le site au public.
et `wallet` (Compte d'Avoir) pour les artistes actifs. Un vrai prestataire = une classe qui hérite de
`apps.payments.providers.BaseProvider`, déclarée dans `PAYMENT_PROVIDERS`.

### Tâches planifiées (cron)

```bash
python manage.py expire_subscriptions   # chaque jour : mise en veille à la date anniversaire, rappels J-30 et J-7
python manage.py refresh_clip_queue     # chaque minute : fait avancer la file des clips
python manage.py send_quarterly_statements  # tous les 3 mois (ex. 0 9 1 1,4,7,10 *) : bilan financier par SMS et e-mail
```

## Module 1 — Comptes et authentification

### Règles appliquées

- Seuls les artistes et fondations ont un compte. L'identifiant est le **numéro de téléphone**,
  stocké au format international E.164 (`+2250700000000`) : un numéro = un compte.
- Mot de passe : **8 à 12 caractères, lettres et chiffres**. Il est stocké avec **Argon2**.
- L'inscription crée un compte **en attente du paiement**, inactif et sans mot de passe. Quand les frais
  d'ouverture sont payés, `services.activate_account()` génère le mot de passe et envoie les identifiants
  par SMS et e-mail. En attendant le module paiements, l'administration propose l'action
  « Activer le compte (frais d'ouverture reçus) ».
- Le mot de passe généré est en **majuscules et chiffres** (p. 15), sans caractères ambigus (0/O, 1/I).
- Une inscription commencée mais jamais payée peut être recommencée avec le même numéro.
- L'artiste peut modifier **toutes** ses informations (p. 10, 17), sauf le numéro de connexion et la civilité.
- Administration : actions **liste rouge 3 mois** et **exclusion définitive** (désactive le compte et ferme les sessions).

### Sécurité de la session

| Élément | Choix |
|---|---|
| Jeton d'accès | JWT de 15 min, dans la réponse JSON. Le frontend le garde **en mémoire** (pas dans `localStorage`) et l'envoie en `Authorization: Bearer …` |
| Jeton de rafraîchissement | Cookie `agapy_refresh` **HttpOnly**, `SameSite=Lax`, `Secure` en production, limité à `/api/v1/auth/`. 30 jours avec « Se souvenir de moi », sinon cookie de session (12 h max) |
| Rotation | À chaque rafraîchissement, un nouveau cookie est émis et l'ancien est mis en **liste noire** (rejouer un vieux jeton échoue) |
| Changement de mot de passe | Toutes les autres sessions sont coupées immédiatement, y compris les jetons d'accès encore valides (champ `auth_version`) |
| Force brute | 5 échecs sur un numéro → blocage 15 min ; limites de débit par adresse IP sur la connexion, les SMS et l'inscription |
| Mot de passe oublié | Code SMS à 6 chiffres, valable 10 min, 5 essais, 60 s entre deux envois. Seule son empreinte est stockée. La réponse est identique que le numéro existe ou non |

### Points d'entrée

| Méthode | Adresse | Rôle | Page du frontend |
|---|---|---|---|
| POST | `/api/v1/auth/login/` | `{phone_country, phone, password, remember}` → `{access, user}` + cookie | `stores/auth.ts`, `LoginPage` |
| POST | `/api/v1/auth/refresh/` | Cookie → `{access}` + nouveau cookie | au chargement et après un 401 |
| POST | `/api/v1/auth/logout/` | Révoque le cookie | bouton Déconnexion |
| POST | `/api/v1/auth/password/change/` | `{current_password, new_password}` → `{access}` | `ProfilePage` |
| POST | `/api/v1/auth/password/forgot/` | `{phone_country, phone}` → 202, SMS envoyé | `ForgotPasswordPage` étape 1 |
| POST | `/api/v1/auth/password/verify/` | `{phone_country, phone, code}` → `{reset_token}` | étape 2 |
| POST | `/api/v1/auth/password/reset/` | `{reset_token, password}` | étape 3 |
| POST | `/api/v1/accounts/signup/` | multipart (champs de `signupSchema` en snake_case + `photo`) → `{id, login, status, region}` | `SignupPage` |
| GET / PATCH | `/api/v1/accounts/me/` | Compte connecté ; modification des infos publiques (JSON ou multipart pour la photo) | `ProfilePage`, `DashboardLayout` |
| PATCH | `/api/v1/accounts/me/payout/` | Mobile money et/ou IBAN | `ProfilePage` |

Le détail des champs se trouve dans `/api/docs/`.

### Format des erreurs

```json
{ "phone": ["Numéro de téléphone invalide."], "codes": { "phone": ["phone_invalid"] } }
{ "detail": "Numéro ou mot de passe incorrect.", "codes": { "detail": "invalid_credentials" } }
```

Le frontend choisit la traduction à partir de `codes`, sans dépendre du texte français.
Principaux codes : `invalid_credentials`, `login_locked`, `session_expired`, `token_revoked`, `phone_invalid`,
`phone_taken`, `password_format`, `password_incorrect`, `code_invalid`, `reset_token_invalid`, `required`,
`future_date`, `payout_required`, `iban_invalid`, `terms_required`, `photo_size`, `not_an_artist`.

### Conseils pour le branchement côté frontend

1. **Proxy Vite** (recommandé) : dans `frontend/vite.config.ts`, ajouter
   `server.proxy = { '/api': 'http://127.0.0.1:8010', '/media': 'http://127.0.0.1:8010' }`.
   Le frontend et l'API sont alors sur la même origine et le cookie fonctionne sans CORS.
   Sans proxy, appeler l'API avec `credentials: 'include'` (CORS est déjà autorisé pour `http://localhost:5173`).
2. Au démarrage de l'application, appeler `POST /auth/refresh/` pour retrouver la session.
3. Sur une réponse 401, appeler `refresh` **une seule fois à la fois** (une promesse partagée), puis rejouer la requête.
   Deux rafraîchissements simultanés avec le même cookie déconnecteraient l'utilisateur, puisque le cookie est à usage unique.
4. Les noms de champs de l'API sont en **snake_case** (`phone_country`, `artist_name`…).
5. `user.artist.id` (ex. `awa-kone`) remplace `artistId` dans `stores/auth.ts`.

### Envoi des SMS et e-mails

En développement, les SMS et e-mails s'affichent dans la console du serveur. Pour brancher un vrai fournisseur
de SMS, il suffit d'écrire une classe qui hérite de `apps.notifications.sms.BaseSmsBackend` et de la déclarer
dans `SMS_BACKEND`. Pour les e-mails, il faut renseigner `EMAIL_URL` dans `.env`.

### Avant la mise en production

- `DEBUG=False`, de vraies clés `SECRET_KEY` et `JWT_SIGNING_KEY`, et `ALLOWED_HOSTS`.
- Un cache **Redis** (`CACHE_URL`) : sans lui, les compteurs d'échecs et les limites de débit ne sont pas partagés entre processus.
- Un vrai fournisseur de SMS, et des envois en tâche de fond (Celery) quand le volume augmentera.
- Le chiffrement des IBAN au repos est à étudier avec le module paiements.
- Quand un prestataire réel sera choisi : l'écrire (classe `BaseProvider`), le déclarer et mettre `PAYMENT_SIMULATION_ENABLED=False`.
- Le serveur web doit accepter des envois de 50 Mo (vidéos des clips).
