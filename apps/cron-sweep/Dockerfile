# Minimal image whose only job is running sweepStaleBattles.sql via psql on
# a schedule (Render Cron Job) — no Bun/Node, this is pure SQL, not app code.
FROM postgres:16-alpine
COPY apps/cron-sweep/sweepStaleBattles.sql /sweepStaleBattles.sql
CMD ["sh", "-c", "psql \"$DATABASE_URL\" -f /sweepStaleBattles.sql"]
