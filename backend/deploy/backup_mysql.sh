#!/bin/sh
# Sauvegarde quotidienne de la base MySQL et des fichiers téléversés, conservée BACKUP_KEEP_DAYS jours.
# Identifiants MySQL lus dans ~/.my.cnf (section [mysqldump]), jamais en ligne de commande.
set -eu
DEST=${BACKUP_DIR:-/var/backups/agapy}
KEEP=${BACKUP_KEEP_DAYS:-14}
DB=${MYSQL_DATABASE:-agapy_gallery}
MEDIA=${MEDIA_DIR:-/srv/agapy-gallery/backend/media}
STAMP=$(date +%Y%m%d-%H%M)
umask 077
mkdir -p "$DEST"
mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 "$DB" \
  | gzip -9 > "$DEST/agapy-db-$STAMP.sql.gz"
tar -czf "$DEST/agapy-media-$STAMP.tar.gz" -C "$(dirname "$MEDIA")" "$(basename "$MEDIA")"
find "$DEST" -name 'agapy-*' -mtime +"$KEEP" -delete
echo "Sauvegarde $STAMP terminée"
