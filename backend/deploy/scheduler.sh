#!/bin/sh
# Tâches planifiées pour docker-compose (équivalent de la crontab de docs/DEPLOIEMENT.md).
# Une boucle par minute ; les heures suivent TZ (Africa/Abidjan = UTC).
set -u
run() { python manage.py "$@" || echo "Échec de la tâche : $*" >&2; }
while true; do
  now=$(date +%H:%M); day=$(date +%d); month=$(date +%m)
  run refresh_clip_queue
  run send_pending_notifications
  [ "$now" = "02:00" ] && run expire_subscriptions
  if [ "$now" = "06:00" ] && [ "$day" = "01" ]; then
    case "$month" in 01|04|07|10) run send_quarterly_statements ;; esac
  fi
  sleep $((60 - $(date +%S | sed 's/^0//')))
done
