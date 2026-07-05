#!/usr/bin/env bash
#
# Create the RouteForge membership subscription Plans in PayPal and print their
# Plan IDs. Run this ONCE. Paste the printed IDs into your Railway variables:
#   PAYPAL_PLAN_PRO, PAYPAL_PLAN_TEAM, PAYPAL_PLAN_CLUB
#
# Usage:
#   PAYPAL_CLIENT_ID=xxx PAYPAL_SECRET=yyy ./scripts/create_paypal_plans.sh
#
# Options (env vars):
#   PAYPAL_ENV   sandbox | live   (default: live)
#   CURRENCY     USD | NZD | ...   (default: USD — match your pricing page)
#
# Requires: curl, python3 (for JSON parsing).
set -euo pipefail

: "${PAYPAL_CLIENT_ID:?Set PAYPAL_CLIENT_ID}"
: "${PAYPAL_SECRET:?Set PAYPAL_SECRET}"
PAYPAL_ENV="${PAYPAL_ENV:-live}"
CURRENCY="${CURRENCY:-USD}"

if [ "$PAYPAL_ENV" = "live" ]; then
  BASE="https://api-m.paypal.com"
else
  BASE="https://api-m.sandbox.paypal.com"
fi
echo "Using $PAYPAL_ENV ($BASE), currency $CURRENCY"

json() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

echo "→ Getting access token…"
TOKEN=$(curl -s "$BASE/v1/oauth2/token" \
  -u "$PAYPAL_CLIENT_ID:$PAYPAL_SECRET" \
  -d grant_type=client_credentials | json "['access_token']")

echo "→ Creating product…"
PRODUCT_ID=$(curl -s "$BASE/v1/catalogs/products" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"RouteForge Membership","type":"SERVICE","category":"SOFTWARE"}' \
  | json "['id']")
echo "  product: $PRODUCT_ID"

make_plan() {
  local NAME="$1" PRICE="$2"
  curl -s "$BASE/v1/billing/plans" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{
      \"product_id\":\"$PRODUCT_ID\",
      \"name\":\"RouteForge $NAME\",
      \"billing_cycles\":[{
        \"frequency\":{\"interval_unit\":\"MONTH\",\"interval_count\":1},
        \"tenure_type\":\"REGULAR\",\"sequence\":1,\"total_cycles\":0,
        \"pricing_scheme\":{\"fixed_price\":{\"value\":\"$PRICE\",\"currency_code\":\"$CURRENCY\"}}
      }],
      \"payment_preferences\":{\"auto_bill_outstanding\":true,\"setup_fee_failure_action\":\"CONTINUE\",\"payment_failure_threshold\":2}
    }" | json "['id']"
}

echo "→ Creating plans…"
PRO=$(make_plan "Pro" "9")
TEAM=$(make_plan "Team" "29")
CLUB=$(make_plan "Club" "79")

echo ""
echo "=========================================================="
echo " Done! Set these on Railway (API service → Variables):"
echo "=========================================================="
echo "PAYPAL_ENV=$PAYPAL_ENV"
echo "PAYPAL_PLAN_PRO=$PRO"
echo "PAYPAL_PLAN_TEAM=$TEAM"
echo "PAYPAL_PLAN_CLUB=$CLUB"
echo "=========================================================="
echo "(Also keep PAYPAL_CLIENT_ID and PAYPAL_SECRET set.) Then redeploy."
