# Changements de l'API pour le frontend (branche `backend-suite`)

Ce document liste ce qui change côté API et ce que le frontend doit adapter. Le format des erreurs ne change pas :

```json
{ "champ": ["message"], "codes": { "champ": ["code"] } }
{ "detail": "message", "codes": { "detail": "code" } }
```

Chaque nouveau code d'erreur doit être traduit dans `src/i18n/locales/errors.fr.json` et `errors.en.json` (`errors.<code>`).

Toutes les URL de fichiers et de pagination renvoyées par l'API sont maintenant **relatives** (`/media/…`, `/api/v1/…`) : elles passent par le proxy Vite et on peut les utiliser telles quelles.

---

## 1. Images et extraits des galeries payantes (protégés)

Les images en pleine résolution ne sont plus publiques : une galerie payante ne montre que des **miniatures** tant que le visiteur n'a pas de droit de visite.

### Champs d'une œuvre publique

Concerne `/catalog/artworks/`, `/catalog/artworks/<slug>/`, `/catalog/artists/<slug>/` (champ `artworks[]`) et `/catalog/search/`.

| Champ | Contenu |
|---|---|
| `thumbnail` | Toujours fourni (ou `null` si la miniature n'a pas pu être créée). URL publique `/media/artworks/<artiste>/thumbs/<uuid>.webp`, ~480 px, légèrement floutée. **À utiliser pour les cartes, les listes et les vignettes verrouillées.** |
| `image` | URL de l'image pleine résolution, **ou `null`** si la galerie est verrouillée. |
| `excerpt` | Même règle que `image` pour l'extrait audio/vidéo (`null` s'il n'y en a pas ou si c'est verrouillé). `excerpt_duration` reste toujours renseigné. |
| `locked` | `true` quand il manque le droit de visite. |

`image` (et `excerpt`) est rempli dans trois cas :

1. La galerie est gratuite aujourd'hui : `"/api/v1/catalog/artworks/<slug>/image/"`.
2. La requête porte un droit de visite valide pour cet artiste, dans l'en-tête `X-Visit-Token: <jeton>` : `"/api/v1/catalog/artworks/<slug>/image/?visit_token=<jeton>"`.
3. L'artiste propriétaire ou un membre de l'équipe est connecté (Bearer) : URL signée `…/image/?sig=…`, valable 6 h.

**À faire côté frontend :** envoyer `X-Visit-Token` (jeton gardé par `saveVisitToken`) sur les appels du catalogue d'un artiste dont la galerie est payante, puis utiliser `image` **telle quelle** dans `<img>`, `<video>` ou les textures 3D, sans y ajouter le jeton. Sans accès, afficher `thumbnail` avec le verrou.

Exemple d'une galerie payante sans jeton :

```json
{ "id": "lagune-au-matin", "title": "Lagune au matin", "image": null, "excerpt": null,
  "thumbnail": "/media/artworks/awa-kone/thumbs/3f2a….webp", "locked": true, "excerpt_duration": 20 }
```

La même requête avec `X-Visit-Token: abc` renvoie `"image": "/api/v1/catalog/artworks/lagune-au-matin/image/?visit_token=abc"` et `"locked": false`.

### Endpoints des fichiers

- `GET /api/v1/catalog/artworks/<slug>/image/`
- `GET /api/v1/catalog/artworks/<slug>/excerpt/`

Réponses :

- 200 : le fichier.
- 403 avec `codes.detail` = `visit_required` (aucun droit) ou `visit_token_invalid` (jeton expiré ou d'un autre artiste).
- 404 : œuvre inconnue, non publiée ou sans fichier.

### Autres changements du catalogue

- `cover` d'un artiste est désormais une miniature.
- `photo` est une URL relative.
- Les réseaux sociaux de l'artiste (`socials`) incluent maintenant `X` et `TikTok`.
- Espace artiste (`/catalog/me/artworks/…`) : `image` et `excerpt` sont des URL signées, et `thumbnail` est fourni.
- La durée d'un extrait est **mesurée sur le fichier** : `excerpt_too_long` si le fichier dure plus de 30 s, même si la durée déclarée est plus courte.

---

## 2. Comptes visiteurs (nouveau) et Compte d'Avoir visiteur

### Distinguer artiste et visiteur

Les réponses de `POST /auth/login/`, `POST /visitors/signup/` et `GET /accounts/me/` contiennent `user.artist` **et** `user.visitor`. Un seul des deux est renseigné ; les deux sont `null` pour un membre de l'équipe. Après un `refresh`, qui ne renvoie que `{access}`, appeler `GET /accounts/me/`.

Il faut donc ajouter `visitor` au type `SessionUser` dans `stores/auth.ts`. `DashboardLayout` (l'espace artiste) doit refuser un visiteur.

### Inscription d'un visiteur (gratuite, en 2 étapes)

1. `POST /api/v1/visitors/signup/code/` avec `{"phone_country":"CI","phone":"07 11 22 33 44"}`
   - Réponse 202 : `{"detail":"…","expires_in_minutes":10}`.
   - Au plus un envoi par minute : la même réponse 202 revient sans nouvel envoi. Prévoir un bouton « Renvoyer le code » après 60 s.
   - Erreurs : `phone_invalid`, `phone_taken`.
2. `POST /api/v1/visitors/signup/` avec :

   ```json
   {"phone_country":"CI","phone":"07 11 22 33 44","code":"123456","display_name":"Jean Client",
    "email":"jean@exemple.com","country":"FR","password":"VISIT2026","remember":false}
   ```

   - `email` et `remember` sont facultatifs.
   - `country` fixe la zone tarifaire et la devise, et **ne pourra plus être modifié**.
   - Réponse 201 : `{access, user}`. Le visiteur est **connecté directement** : le même cookie de session que pour la connexion est posé.
   - Erreurs : `code_invalid`, `phone_taken`, `phone_invalid`, `password_format`, `password_too_common`, `password_too_similar`, `required`, `invalid`.

La connexion, le rafraîchissement, la déconnexion et le mot de passe oublié restent identiques (`/auth/…`).

### Espace visiteur (Bearer)

| Méthode | Adresse | Rôle |
|---|---|---|
| GET / PATCH | `/api/v1/visitors/me/` | Profil. Seuls `display_name` et `email` sont modifiables. Un artiste reçoit 403 `not_a_visitor`. |
| GET / PATCH | `/api/v1/visitors/me/wallet/` | `{is_active, balance, currency, history{count,next,previous,results}}`. PATCH `{"is_active":true}` active ou désactive le compte. |
| POST | `/api/v1/visitors/me/wallet/topup/` | `{"amount":"5000","method":"momo"}` → `{payment, action}`, puis le même parcours de paiement que l'artiste. Erreurs : `wallet_inactive`, `invalid_amount`, `amount_too_low`, `amount_too_high`. |
| GET | `/api/v1/visitors/me/visits/` | Droits de visite encore valables : `[{"artist","artist_name","token","expires_at"}]`. Ouvert à tout compte connecté. |
| GET | `/api/v1/visitors/me/payments/` | Paiements du compte, paginés. |

Les adresses `/accounts/me/` (PATCH) et `/subscriptions/…` restent réservées aux artistes (403 `not_an_artist` pour un visiteur).

### Payer une visite ou un don avec le Compte d'Avoir

`POST /api/v1/payments/visits/` et `POST /api/v1/payments/donations/` acceptent maintenant `method: "wallet"`, **à condition d'envoyer `Authorization: Bearer`** (visiteur ou artiste).

- Le paiement est immédiat. Réponse 201 : `{"payment":{…,"status":"succeeded","visit":{"token","expires_at"}},"action":{"status":"succeeded"}}`. Pour une visite, le jeton est donc directement dans la réponse.
- La zone et la devise sont celles du compte : la `region` envoyée est ignorée.
- Erreurs :
  - `method_unavailable` : appel anonyme en `wallet`, ou compte sans Compte d'Avoir ;
  - `wallet_inactive`, `wallet_insufficient`, `wallet_currency` ;
  - `self_donation` (403) : un artiste ne peut pas se faire un don.
- Les paiements anonymes par carte ou mobile money ne changent pas. Un utilisateur connecté qui paie par carte ou mobile money retrouve ensuite le paiement dans `me/payments/`.

---

## 3. Inscription et profil des artistes

- **Nouveaux champs facultatifs** à l'inscription (`POST /accounts/signup/`, multipart) et dans le profil (`PATCH /accounts/me/`) :
  - `twitter`, `tiktok` : URL complète, sinon code `invalid` ;
  - `assisted_by_name` (150 caractères max), `assisted_by_phone` (numéro lu dans le pays `phone_country` s'il n'a pas d'indicatif ; code `phone_invalid`) — uniquement à l'inscription, pour un artiste aidé par une personne de confiance.
- **Nouvelle erreur `account_banned`**, à afficher comme message global du formulaire :

  ```json
  {"non_field_errors": ["L'inscription n'a pas pu aboutir. Contactez l'équipe AGAPY-GALLERY."],
   "codes": {"non_field_errors": ["account_banned"]}}
  ```

  Elle concerne une réinscription avec l'e-mail, l'IBAN, le numéro mobile money ou le téléphone d'un compte exclu.
- `GET /accounts/me/` → `artist` contient en plus `twitter`, `tiktok`, `assisted_by_name`, `assisted_by_phone`.
- **Inchangé** : IBAN et numéro mobile money restent renvoyés en clair par l'API au propriétaire du compte (ils ne sont chiffrés qu'en base).

---

## 4. Clips

- La **durée réelle** de la vidéo est mesurée côté serveur : `video_too_long` au-delà de 30 s, même si la durée déclarée est correcte.
- Rappel de la PR précédente : après paiement, le clip passe en `pending_review` jusqu'à sa validation par l'équipe.

---

## 5. Nouveaux codes d'erreur à traduire

| Code | Message proposé |
|---|---|
| `visit_required` | « Payez la visite pour voir cette œuvre en grand. » |
| `not_a_visitor` | « Réservé aux visiteurs. » |
| `self_donation` | « Vous ne pouvez pas vous faire un don. » |
| `account_banned` | « L'inscription n'a pas pu aboutir. Contactez l'équipe AGAPY-GALLERY. » |
| `excerpt_too_long` | « L'extrait ne doit pas dépasser 30 secondes. » |
| `password_too_common` | « Mot de passe trop courant. » |
| `password_too_similar` | « Mot de passe trop proche de votre numéro ou de votre e-mail. » |
