#!/bin/bash
set -e
STAMP=$(date +%Y%m%d_%H%M%S)
docker exec supabase-db pg_dump -U postgres -d postgres --schema=public --no-owner --no-privileges --format=custom -f /tmp/backup_$STAMP.dump
docker cp supabase-db:/tmp/backup_$STAMP.dump /opt/prei/backups/backup_$STAMP.dump
docker exec supabase-db rm /tmp/backup_$STAMP.dump
find /opt/prei/backups -name 'backup_*.dump' -mtime +7 -delete
