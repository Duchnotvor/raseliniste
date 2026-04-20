#!/bin/sh
# =======================================================
# Měsíční Health Report — DSM Task Scheduler
# =======================================================
#
# Vlož tento příkaz do Synology Task Scheduleru:
#   Control Panel → Task Scheduler → Create → Scheduled Task
#     → User-defined script
#
# Schedule:
#   Run on:  Monthly
#   Day:     Last day of month
#   Time:    23:00
#
# Task name: Raseliniste monthly health report
# User:      root
#
# Nahraď <CRON_SECRET> skutečnou hodnotou z /docker/raseliniste/.env
# (je to hodnota proměnné CRON_SECRET).
#
# Endpoint pro každého uživatele s health daty:
#   - spočítá předchozí celý měsíc
#   - spustí analyzeHealth (Gemini Pro)
#   - uloží HealthAnalysis(trigger=MONTHLY_AUTO)
#   - pokud je RESEND_API_KEY + NOTIFICATION_EMAIL, odešle mail

curl -fsS -X POST https://www.raseliniste.cz/api/cron/monthly-health-report \
     -H "x-cron-key: <CRON_SECRET>" \
     --max-time 120

# Návratové kódy:
#   0   = OK
#   22  = HTTP 4xx/5xx (chybný klíč, DB error...)
#   28  = timeout (120 s překročeno — Gemini nestíhá)
#   6/7 = DNS / connect fail (síť nebo SSL)
#
# V DSM Task Scheduleru nastav „Notify if abnormal" → e-mail,
# abys věděl, kdyby to jednou selhalo.
