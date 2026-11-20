#!/usr/bin/env bash
# End-to-end test of Cognito auth against the deployed DonazionStack.
#
# Creates a temporary Organization user and a temporary Donation Center user
# (through real self sign-up, so the post-confirmation trigger runs), checks
# login, groups, and API authorization, then deletes both users.
#
# Usage: scripts/test-auth.sh [email]
#   email: where Cognito sends the Donation Center sign-up code. Defaults to the
#          AWS mailbox simulator, which accepts mail and goes nowhere.
#
# Requires: aws CLI (logged in, region set to the stack's region), curl, python3
set -uo pipefail

EMAIL=${1:-success@simulator.amazonses.com}
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
STAMP=$(date +%s)
ORG_USER="test-org-$STAMP"
DC_USER="test-dc-$STAMP"
PASSWORD="Test-Passw0rd-$STAMP"

PASS=0; FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; [ -n "${2:-}" ] && echo "      $2"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------- setup
out() {
  aws cloudformation describe-stacks --stack-name DonazionStack \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
echo "Reading stack outputs..."
POOL=$(out UserPoolId) && CLIENT=$(out UserPoolClientId) && API=$(out ApiUrl) || {
  echo "Could not read DonazionStack outputs. Is it deployed, and is AWS_REGION set?" >&2; exit 1; }
API=${API%/}
echo "  pool=$POOL client=$CLIENT"
echo "  api=$API"

cleanup() {
  echo "Cleaning up test users..."
  for u in "$ORG_USER" "$DC_USER"; do
    aws cognito-idp admin-delete-user --user-pool-id "$POOL" --username "$u" 2>/dev/null
  done
}
trap cleanup EXIT

# Prints the ID token for a username/email + password, or nothing on failure
token() {
  aws cognito-idp initiate-auth --client-id "$CLIENT" --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=$1,PASSWORD=$2" \
    --query AuthenticationResult.IdToken --output text 2>/dev/null
}

# Prints the cognito:groups claim of a JWT, comma separated
groups_of() {
  python3 -c '
import sys, base64, json
p = sys.argv[1].split(".")[1]
claims = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
print(",".join(claims.get("cognito:groups", [])))' "$1"
}

# call <path> <token|""> <content-type> <body>   -> sets CODE and BODY
call() {
  local resp
  local auth=()
  [ -n "$2" ] && auth=(-H "Authorization: $2")
  resp=$(curl -s -w $'\n%{http_code}' -X POST "$API/$1" -H "Content-Type: $3" "${auth[@]}" -d "$4")
  CODE=${resp##*$'\n'}
  BODY=${resp%$'\n'*}
}

# expect <description> <path> <token> <expected code> [expected body substring] [content-type] [body]
expect() {
  local body='{}'
  [ -n "${7:-}" ] && body=$7
  call "$2" "$3" "${6:-application/json}" "$body"
  if [ "$CODE" = "$4" ] && { [ -z "${5:-}" ] || [[ "$BODY" == *"$5"* ]]; }; then
    pass "$1"
  else
    fail "$1" "expected HTTP $4${5:+ containing \"$5\"}, got HTTP $CODE: $BODY"
  fi
}

# ---------------------------------------------------------------- users
echo
echo "Users"

if "$SCRIPT_DIR/create-org-user.sh" "$ORG_USER" "org-$STAMP@example.com" "$PASSWORD" >/dev/null; then
  pass "create Organization user with create-org-user.sh"
else
  fail "create Organization user with create-org-user.sh"
fi

if aws cognito-idp sign-up --client-id "$CLIENT" --username "$DC_USER" --password "$PASSWORD" \
     --user-attributes "Name=email,Value=$EMAIL" >/dev/null; then
  pass "Donation Center self sign-up"
else
  fail "Donation Center self sign-up"
fi

# Confirming as admin fires the same PostConfirmation_ConfirmSignUp trigger as the email code
aws cognito-idp admin-confirm-sign-up --user-pool-id "$POOL" --username "$DC_USER" >/dev/null \
  && pass "confirm Donation Center sign-up" || fail "confirm Donation Center sign-up"

DC_GROUPS=$(aws cognito-idp admin-list-groups-for-user --user-pool-id "$POOL" --username "$DC_USER" \
  --query 'Groups[].GroupName' --output text)
[ "$DC_GROUPS" = "DonationCenter" ] \
  && pass "post-confirmation trigger added user to DonationCenter group" \
  || fail "post-confirmation trigger added user to DonationCenter group" "groups: '$DC_GROUPS'"

# ---------------------------------------------------------------- login
echo
echo "Login"

ORG=$(token "$ORG_USER" "$PASSWORD")
[ -n "$ORG" ] && [ "$ORG" != "None" ] && pass "Organization login by username" || fail "Organization login by username"

DC=$(token "$DC_USER" "$PASSWORD")
[ -n "$DC" ] && [ "$DC" != "None" ] && pass "Donation Center login by username" || fail "Donation Center login by username"

ORG_BY_EMAIL=$(token "org-$STAMP@example.com" "$PASSWORD")
[ -n "$ORG_BY_EMAIL" ] && [ "$ORG_BY_EMAIL" != "None" ] && pass "login by email" || fail "login by email"

[ -z "$(token "$ORG_USER" 'Wrong-Passw0rd')" ] && pass "wrong password rejected" || fail "wrong password rejected"

[ -n "$ORG" ] && [ "$(groups_of "$ORG")" = "Organization" ] \
  && pass "Organization token has cognito:groups = Organization" \
  || fail "Organization token has cognito:groups = Organization"
[ -n "$DC" ] && [ "$(groups_of "$DC")" = "DonationCenter" ] \
  && pass "Donation Center token has cognito:groups = DonationCenter" \
  || fail "Donation Center token has cognito:groups = DonationCenter"

# ---------------------------------------------------------------- API
echo
echo "API authorization"
# Stub Lambdas throw "<name> is not implemented yet" AFTER the role check passes, so that
# message means the request was authorized. Once a Lambda is implemented, update the
# expected result for its line below.

expect "no token -> 401"                    organization/addCategory ""            401
expect "garbage token -> 401"               organization/addCategory "not.a.token" 401
expect "DC token on org route -> forbidden" organization/addCategory "$DC"         400 "Forbidden"
expect "Org token on DC route -> forbidden" donationCenter/listInventory "$ORG"    400 "Forbidden"
expect "Org token on org route -> allowed"  organization/addCategory "$ORG"        400 "not implemented" \
  application/json '{"name":"electronics"}'
expect "DC token on DC route -> allowed"    donationCenter/listInventory "$DC"     400 "not implemented"
expect "forged auth via text/plain -> 415"  organization/addCategory "$DC"         415 "" \
  text/plain '{"auth":{"sub":"x","groups":"Organization"}}'
expect "forged auth in JSON body ignored"   organization/addCategory "$DC"         400 "Forbidden" \
  application/json '{"name":"x","auth":{"sub":"x","groups":"Organization"}}'

call donor/listDonationCenters "" application/json '{}'
[ "$CODE" != "401" ] && [ "$CODE" != "403" ] \
  && pass "donor route is public (HTTP $CODE)" \
  || fail "donor route is public" "got HTTP $CODE: $BODY"

# ---------------------------------------------------------------- result
echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
