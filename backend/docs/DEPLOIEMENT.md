# Mise en production d'AGAPY-GALLERY

Ce guide décrit l'installation sur un serveur Linux (Ubuntu 24.04 ou Debian 12) :
**nginx** (HTTPS, frontend construit, fichiers) → **Gunicorn** (Django) → **MySQL 8** et **Redis**.
Un exemple équivalent avec Docker se trouve dans `backend/deploy/` (voir la dernière section).

```
Navigateur ──HTTPS──> nginx ──┬── /            frontend/dist (React construit)
                              ├── /api/, /<ADMIN_URL>/, /healthz ──> Gunicorn 127.0.0.1:8010 ──> MySQL, Redis
                              ├── /static/     backend/staticfiles (collectstatic)
                              └── /media/      backend/media (sauf /media/artworks/ : interne)
```

> Gunicorn ne fonctionne pas sous Windows : en local, on continue d'utiliser `manage.py runserver 8010`.

---

## 1. Paquets du serveur

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-dev build-essential pkg-config \
     default-libmysqlclient-dev mysql-server redis-server nginx ffmpeg certbot python3-certbot-nginx
```

`ffmpeg` fournit `ffprobe`, utilisé pour mesurer la durée réelle des vidéos WebM (les MP4, MP3, M4A,
OGG et WAV sont mesurés par `mutagen`, sans programme externe).

Créer un utilisateur système dédié et les dossiers :

```bash
sudo adduser --system --group --home /srv/agapy-gallery agapy
sudo mkdir -p /var/log/agapy /var/backups/agapy
sudo chown agapy:agapy /var/log/agapy /var/backups/agapy
sudo -u agapy git clone <dépôt> /srv/agapy-gallery
```

## 2. Base MySQL

```sql
CREATE DATABASE agapy_gallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agapy_gallery'@'localhost' IDENTIFIED BY '<mot de passe long et aléatoire>';
GRANT ALL PRIVILEGES ON agapy_gallery.* TO 'agapy_gallery'@'localhost';
```

Redis : laisser l'écoute sur `127.0.0.1` uniquement (valeur par défaut d'Ubuntu). Il sert de cache
partagé : compteurs d'échecs de connexion, limites de débit. **Indispensable avec plusieurs processus
Gunicorn** : avec le cache en mémoire par défaut, chaque processus aurait ses propres compteurs et les
limites seraient contournables.

## 3. Application Django

```bash
cd /srv/agapy-gallery/backend
sudo -u agapy python3 -m venv .venv
sudo -u agapy .venv/bin/pip install -r requirements.txt
sudo -u agapy cp .env.example .env
sudo chmod 600 .env          # le fichier contient tous les secrets
```

### Variables d'environnement (`backend/.env`)

| Variable | Valeur en production | Rôle |
|---|---|---|
| `DEBUG` | `False` | Jamais `True` en production |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(50))"` | Signature Django |
| `JWT_SIGNING_KEY` | autre valeur générée de la même façon | Signature des jetons JWT |
| `FIELD_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Chiffrement des coordonnées de versement et des notifications en attente. **À sauvegarder à part** : sans elle, ces données sont perdues. Rotation : `nouvelle,ancienne` |
| `ALLOWED_HOSTS` | `agapy-gallery.com,www.agapy-gallery.com` | Noms acceptés |
| `CSRF_TRUSTED_ORIGINS` | `https://agapy-gallery.com,https://www.agapy-gallery.com` | Formulaires de l'administration |
| `CORS_ALLOWED_ORIGINS` | vide si le frontend est servi sur le même domaine | Appels de l'API depuis un autre domaine |
| `FRONTEND_URL` | `https://agapy-gallery.com` | Liens dans les SMS et e-mails |
| `DATABASE_URL` | `mysql://agapy_gallery:<mdp>@127.0.0.1:3306/agapy_gallery` | Base MySQL |
| `CONN_MAX_AGE` | `60` | Connexions MySQL persistantes (secondes) |
| `CACHE_URL` | `rediscache://127.0.0.1:6379/1` | Cache partagé (Redis) |
| `NUM_PROXIES` | `1` | nginx devant Django : lecture correcte de l'adresse IP réelle |
| `ADMIN_URL` | ex. `gestion-7f3k2/` | Chemin secret de l'administration (à reporter dans nginx) |
| `REFRESH_COOKIE_SECURE` | `True` (valeur par défaut hors DEBUG) | Cookie du jeton de rafraîchissement |
| `SMS_BACKEND` + réglages SMS | voir ci-dessous | Envoi réel des SMS |
| `EMAIL_URL`, `DEFAULT_FROM_EMAIL` | `smtp+tls://utilisateur:mdp@smtp.exemple.com:587` | Envoi des e-mails |
| `NOTIFICATIONS_ASYNC` | `True` recommandé | SMS/e-mails envoyés par la tâche planifiée et non pendant la requête |
| `PAYMENT_SIMULATION_ENABLED` | `True` tant qu'aucun prestataire réel n'est branché | **Attention** : n'importe qui peut alors marquer un paiement comme payé. Mettre `False` dès qu'un prestataire est configuré |
| `SECURE_HSTS_SECONDS` | `31536000` (défaut) | HSTS ; commencer par `3600` le premier jour si l'on veut pouvoir revenir en arrière |
| `SECURE_HSTS_PRELOAD` | `False` (défaut) | `True` seulement après inscription volontaire sur hstspreload.org |
| `LOG_LEVEL`, `LOG_FILE` | `INFO`, `/var/log/agapy/django.log` | Journaux JSON (console + fichier tournant) |

#### Fournisseur SMS

Trois classes prêtes à l'emploi sont dans `apps/notifications/sms_providers.py` (délai de 10 s,
`SMS_TIMEOUT`). Les journaux ne contiennent jamais le texte des SMS ni le numéro complet.

```ini
# Orange SMS API (Côte d'Ivoire et Afrique de l'Ouest)
SMS_BACKEND=apps.notifications.sms_providers.OrangeSmsBackend
SMS_ORANGE_CLIENT_ID=...
SMS_ORANGE_CLIENT_SECRET=...
SMS_ORANGE_SENDER=2250000000000
SMS_ORANGE_SENDER_NAME=AGAPY

# ou Twilio
SMS_BACKEND=apps.notifications.sms_providers.TwilioSmsBackend
SMS_TWILIO_SID=AC...
SMS_TWILIO_TOKEN=...
SMS_TWILIO_FROM=+1...

# ou agrégateur local (API HTTP JSON)
SMS_BACKEND=apps.notifications.sms_providers.HttpSmsBackend
SMS_HTTP_URL=https://sms.exemple.ci/api/send
SMS_HTTP_HEADERS={"Authorization": "Bearer xxx"}
SMS_HTTP_TEMPLATE={"to": "{to}", "text": "{message}", "from": "{sender}"}
```

Test d'envoi réel (vers son propre numéro) :

```bash
.venv/bin/python manage.py shell -c "from apps.notifications.sms import get_backend; get_backend().send('+225XXXXXXXXXX', 'Test AGAPY')"
```

#### Envoi différé des notifications

Avec `NOTIFICATIONS_ASYNC=True`, `send_sms` / `send_email` enregistrent le message **chiffré**
(`FIELD_ENCRYPTION_KEY`) dans la table des notifications sortantes ; la commande
`send_pending_notifications` (chaque minute, voir §6) l'envoie avec 3 essais (délais de 1 puis 5 minutes).
Le contenu est effacé dès l'envoi ou l'abandon ; les traces (statut, destinataire masqué) sont purgées
après 30 jours. L'administration (« Notifications sortantes ») est en lecture seule et n'affiche pas
le contenu. Si la mise en file échoue (clé absente…), le message part immédiatement.

### Initialisation

```bash
cd /srv/agapy-gallery/backend
sudo -u agapy .venv/bin/python manage.py migrate
sudo -u agapy .venv/bin/python manage.py collectstatic --noinput
sudo -u agapy .venv/bin/python manage.py createsuperuser   # identifiant = numéro, ex. +2250102030405
sudo -u agapy .venv/bin/python manage.py check --deploy
```

Frontend (sur le serveur ou en intégration continue) :

```bash
cd /srv/agapy-gallery/frontend && npm ci && npm run build     # produit frontend/dist
```

## 4. Gunicorn (service systemd)

Configuration fournie : `backend/deploy/gunicorn.conf.py` (écoute `127.0.0.1:8010`, `2 × CPU + 1`
processus, 2 fils chacun, délai 60 s, recyclage toutes les 1000 requêtes).

`/etc/systemd/system/agapy-gallery.service` :

```ini
[Unit]
Description=AGAPY-GALLERY (Gunicorn)
After=network.target mysql.service redis-server.service

[Service]
User=agapy
Group=agapy
WorkingDirectory=/srv/agapy-gallery/backend
ExecStart=/srv/agapy-gallery/backend/.venv/bin/gunicorn config.wsgi:application -c deploy/gunicorn.conf.py
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
# Durcissement
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/srv/agapy-gallery/backend/media /var/log/agapy

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agapy-gallery
curl -s -H "Host: agapy-gallery.com" http://127.0.0.1:8010/healthz   # {"status": "ok", ...}
```

## 5. nginx

Configuration complète : `backend/deploy/nginx.conf` et `backend/deploy/agapy_proxy_params`.

```bash
sudo cp /srv/agapy-gallery/backend/deploy/agapy_proxy_params /etc/nginx/agapy_proxy_params
sudo cp /srv/agapy-gallery/backend/deploy/nginx.conf /etc/nginx/sites-available/agapy-gallery
# Éditer : nom de domaine, chemin de l'administration (= ADMIN_URL)
sudo ln -s /etc/nginx/sites-available/agapy-gallery /etc/nginx/sites-enabled/
sudo certbot certonly --webroot -w /var/www/certbot -d agapy-gallery.com -d www.agapy-gallery.com
sudo nginx -t && sudo systemctl reload nginx
```

Points importants de cette configuration :

- `client_max_body_size 60m` (vidéos des clips jusqu'à 50 Mo) ;
- `/api/`, `/<ADMIN_URL>/` et `/healthz` transmis à Gunicorn avec `X-Forwarded-For` et
  `X-Forwarded-Proto` (d'où `NUM_PROXIES=1`) ;
- `/static/` servi directement depuis `backend/staticfiles` ;
- `/media/` servi avec `X-Content-Type-Options: nosniff`, types MIME fixés et une CSP `sandbox` :
  un fichier téléversé ne peut pas s'exécuter comme une page ;
- `/media/artworks/` est **`internal`** : les pleines résolutions des œuvres ne sont jamais servies
  directement, Django les délivre après contrôle d'accès avec l'en-tête `X-Accel-Redirect` ;
- en-têtes de sécurité (HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, COOP,
  Permissions-Policy) et CSP stricte pour le frontend (polices Google, lecteurs YouTube / Vimeo /
  Facebook / Dailymotion de la TV en ligne). Si le frontend charge une nouvelle ressource externe,
  l'ajouter à la CSP.

## 6. Tâches planifiées (cron)

Fichier prêt à l'emploi : `backend/deploy/crontab.example` (à installer avec `sudo -u agapy crontab -e`).
Le fuseau du site est `Africa/Abidjan` (UTC).

```cron
APP=/srv/agapy-gallery/backend
PY=/srv/agapy-gallery/backend/.venv/bin/python
LOG=/var/log/agapy/cron.log
# Chaque minute : file des clips promotionnels (fin des 24 h, entrée des clips en attente)
* * * * *        cd $APP && flock -n /tmp/agapy-clips.lock $PY manage.py refresh_clip_queue >> $LOG 2>&1
# Chaque minute : SMS et e-mails en attente (NOTIFICATIONS_ASYNC=True)
* * * * *        cd $APP && flock -n /tmp/agapy-notif.lock $PY manage.py send_pending_notifications >> $LOG 2>&1
# Chaque jour à 02:00 : abonnements échus mis en veille, rappels J-30 et J-7
0 2 * * *        cd $APP && flock -n /tmp/agapy-subs.lock $PY manage.py expire_subscriptions >> $LOG 2>&1
# Trimestriel (1er janvier, avril, juillet, octobre à 06:00) : bilan des artistes
0 6 1 1,4,7,10 * cd $APP && flock -n /tmp/agapy-bilan.lock $PY manage.py send_quarterly_statements >> $LOG 2>&1
# Chaque nuit à 03:00 : sauvegarde
0 3 * * *        /srv/agapy-gallery/backend/deploy/backup_mysql.sh >> $LOG 2>&1
```

`flock -n` empêche qu'une tâche démarre si la précédente n'est pas terminée.

## 7. Sauvegardes

Script : `backend/deploy/backup_mysql.sh` — base (`mysqldump --single-transaction`, compressée) et
dossier `media/`, conservés 14 jours dans `/var/backups/agapy`. Les identifiants MySQL sont lus dans
`~agapy/.my.cnf` (droits 600) :

```ini
[mysqldump]
user=agapy_gallery
password=<mot de passe>
```

- Copier régulièrement `/var/backups/agapy` **hors du serveur** (autre machine, stockage objet).
- Sauvegarder séparément le fichier `.env`, en particulier `FIELD_ENCRYPTION_KEY` (gestionnaire de
  mots de passe de l'équipe) : sans cette clé, les coordonnées de versement sauvegardées sont illisibles.
- Tester la restauration au moins une fois par trimestre :
  `gunzip < agapy-db-AAAAMMJJ-HHMM.sql.gz | mysql agapy_gallery_restauration`.

## 8. Mise à jour de l'application

```bash
cd /srv/agapy-gallery && sudo -u agapy git pull
cd backend
sudo -u agapy .venv/bin/pip install -r requirements.txt
sudo -u agapy .venv/bin/python manage.py migrate
sudo -u agapy .venv/bin/python manage.py collectstatic --noinput
sudo -u agapy .venv/bin/python manage.py check --deploy
sudo systemctl reload agapy-gallery        # rechargement sans coupure
cd ../frontend && npm ci && npm run build
```

## 9. Checklist de mise en production

- [ ] `DEBUG=False`, `SECRET_KEY` et `JWT_SIGNING_KEY` longues, aléatoires et différentes
- [ ] `FIELD_ENCRYPTION_KEY` générée **et sauvegardée hors du serveur**
- [ ] `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` sur le vrai domaine (HTTPS)
- [ ] `ADMIN_URL` changé, et reporté dans nginx
- [ ] `NUM_PROXIES=1` (nginx devant Gunicorn)
- [ ] `CACHE_URL` vers Redis ; `curl …/healthz` renvoie `"cache": "ok"`
- [ ] Fournisseur SMS réel configuré et testé ; `EMAIL_URL` configuré et testé
- [ ] `NOTIFICATIONS_ASYNC=True` et la tâche `send_pending_notifications` active
- [ ] `PAYMENT_SIMULATION_ENABLED` : décision prise et assumée (voir le tableau du §3)
- [ ] `python manage.py check --deploy` : aucun avertissement autre que ceux listés ci-dessous
- [ ] `migrate`, `collectstatic`, superutilisateur créé (mot de passe fort)
- [ ] nginx : `nginx -t` OK, certificat valide, `/media/artworks/…` renvoie 404 en accès direct
- [ ] Crontab installée ; `/var/log/agapy/cron.log` alimenté
- [ ] Sauvegarde exécutée une fois à la main, restauration testée
- [ ] `ffprobe -version` répond (durée réelle des vidéos WebM)
- [ ] Sonde externe (supervision) sur `https://agapy-gallery.com/healthz` (200 = OK, 503 = base ou cache indisponible)

Avertissements de `check --deploy` acceptables :

- `security.W021` (HSTS preload non activé) : choix volontaire, voir `SECURE_HSTS_PRELOAD` ;
- `agapy.W001` / `agapy.W002` tant qu'aucun fournisseur SMS / serveur SMTP n'est branché
  (à ne **pas** laisser en production réelle) ;
- `drf_spectacular.W001` (noms des énumérations dans la documentation de l'API) : sans effet sur le site.

## 10. Variante Docker (`backend/deploy/`)

- `Dockerfile` : image Python 3.14 + `mysqlclient` + `ffmpeg`, utilisateur non root, Gunicorn sur
  le port 8010, sonde `deploy/healthcheck.py` (appelle `/healthz`).
- `docker-compose.yml` : `app` (migrations + `collectstatic` au démarrage, puis Gunicorn),
  `scheduler` (tâches planifiées : `deploy/scheduler.sh`, équivalent de la crontab), `db` (MySQL 8.4,
  utf8mb4), `redis` (cache sans persistance), `nginx` (frontend `../../frontend/dist`, statiques,
  médias, certificats dans `deploy/certs`).

```bash
cd frontend && npm ci && npm run build && cd ../backend/deploy
# dans nginx.conf : « server app:8010; » à la place de « server 127.0.0.1:8010; »
# dans ../.env : MYSQL_PASSWORD et MYSQL_ROOT_PASSWORD en plus des variables du §3
docker compose --env-file ../.env up -d --build
docker compose exec app python manage.py createsuperuser
docker compose exec app python manage.py check --deploy
```

Sauvegarde en Docker :
`docker compose exec db sh -c 'mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" agapy_gallery' | gzip > agapy-db.sql.gz`.
