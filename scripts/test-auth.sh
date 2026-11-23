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

PASS=0; FAIL=0; SKIP=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; [ -n "${2:-}" ] && echo "      $2"; FAIL=$((FAIL + 1)); }
skip() { echo "  - $1 (skipped${2:+: $2})"; SKIP=$((SKIP + 1)); }

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

# Implemented Lambdas return { statusCode, ... }, which API Gateway passes through as HTTP 200.
# Reads the last call's BODY -> sets LCODE (inner statusCode, empty if the Lambda threw instead)
# and LBODY (the "body" field if there is one, e.g. remove; otherwise the whole response,
# e.g. register's { statusCode, message | error })
unwrap() {
  local parsed
  parsed=$(python3 -c '
import sys, json
try:
    r = json.loads(sys.argv[1])
    print(r.get("statusCode", "")); print(r["body"] if "body" in r else sys.argv[1])
except Exception:
    print(""); print(sys.argv[1])' "$BODY")
  LCODE=${parsed%%$'\n'*}
  LBODY=${parsed#*$'\n'}
}

# expect_lambda <description> <path> <token> <expected inner statusCode> [expected body substring] [json body]
expect_lambda() {
  local body='{}'
  [ -n "${6:-}" ] && body=$6
  call "$2" "$3" application/json "$body"
  unwrap
  if [ "$CODE" = "200" ] && [ "$LCODE" = "$4" ] && { [ -z "${5:-}" ] || [[ "$LBODY" == *"$5"* ]]; }; then
    pass "$1"
  else
    fail "$1" "expected statusCode $4${5:+ containing \"$5\"}, got HTTP $CODE: $BODY"
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

# When Cognito's built-in email sender hits its daily limit, SignUp creates the user but returns
# LimitExceededException; the CLI then retries and gets UsernameExistsException. The user is
# still usable (confirming as admin needs no email), so check that it exists instead.
if SIGNUP_ERR=$(aws cognito-idp sign-up --client-id "$CLIENT" --username "$DC_USER" --password "$PASSWORD" \
     --user-attributes "Name=email,Value=$EMAIL" 2>&1 >/dev/null); then
  pass "Donation Center self sign-up"
elif aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$DC_USER" >/dev/null 2>&1; then
  pass "Donation Center self sign-up (user created; Cognito email limit likely hit)"
else
  fail "Donation Center self sign-up" "$SIGNUP_ERR"
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
# "Allowed" = got past the authorizer and role check; works whether addCategory is a stub or implemented
call organization/addCategory "$ORG" application/json '{"name":"electronics"}'
[ "$CODE" != "401" ] && [ "$CODE" != "403" ] && [[ "$BODY" != *"Forbidden"* ]] && [[ "$BODY" != *"Unauthorized"* ]] \
  && pass "Org token on org route -> allowed" \
  || fail "Org token on org route -> allowed" "got HTTP $CODE: $BODY"
expect "DC token on DC route -> allowed"    donationCenter/listInventory "$DC"     400 "not implemented"
expect "forged auth via text/plain -> 415"  organization/addCategory "$DC"         415 "" \
  text/plain '{"auth":{"sub":"x","groups":"Organization"}}'
expect "forged auth in JSON body ignored"   organization/addCategory "$DC"         400 "Forbidden" \
  application/json '{"name":"x","auth":{"sub":"x","groups":"Organization"}}'

call donor/listDonationCenters "" application/json '{}'
[ "$CODE" != "401" ] && [ "$CODE" != "403" ] \
  && pass "donor route is public (HTTP $CODE)" \
  || fail "donor route is public" "got HTTP $CODE: $BODY"

# ---------------------------------------------------------------- donation center register/remove
# Runs last: a successful remove deletes the DC user's Cognito login.
echo
echo "Donation Center register / remove"

DC_NAME="Test DC $STAMP"
DC_REGISTER='{"name":"'"$DC_NAME"'","location":{"zipCode":"01609","lat":42.2746,"lon":-71.8063,"address":"100 Institute Rd, Worcester, MA"},"inventory":[],"wishlist":[]}'

expect_lambda "remove before register -> no donation center" donationCenter/remove "$DC"  400 "No donation center is registered"
expect_lambda "Org token on remove -> forbidden"             donationCenter/remove "$ORG" 400 "Forbidden"

call donationCenter/register "$DC" application/json "$DC_REGISTER"
if [[ "$BODY" == *"not implemented"* ]]; then
  skip "register / remove lifecycle" "register is not implemented yet"
else
  unwrap
  [ "$CODE" = "200" ] && [ "$LCODE" = "200" ] \
    && pass "register Donation Center" \
    || fail "register Donation Center" "expected statusCode 200, got HTTP $CODE: $BODY"

  expect_lambda "register twice -> already exists" donationCenter/register "$DC" 400 "already exists" "$DC_REGISTER"
  expect_lambda "Org token on register -> forbidden" donationCenter/register "$ORG" 400 "Forbidden" "$DC_REGISTER"

  expect_lambda "remove Donation Center" donationCenter/remove "$DC" 200 '"donationCenters"'
  [[ "$LBODY" != *"$DC_NAME"* ]] \
    && pass "removed center is not in the returned list" \
    || fail "removed center is not in the returned list" "$LBODY"

  # remove only deletes the DB row; the frontend then deletes the login with Amplify's deleteUser(),
  # which calls Cognito's DeleteUser with the user's own access token. Do the same here.
  aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$DC_USER" >/dev/null 2>&1 \
    && pass "login still exists after remove (frontend deletes it)" \
    || fail "login still exists after remove (frontend deletes it)" "user $DC_USER is already gone"
  DC_ACCESS=$(aws cognito-idp initiate-auth --client-id "$CLIENT" --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=$DC_USER,PASSWORD=$PASSWORD" \
    --query AuthenticationResult.AccessToken --output text 2>/dev/null)
  aws cognito-idp delete-user --access-token "$DC_ACCESS" >/dev/null 2>&1 \
    && pass "Donation Center deletes its own login (like Amplify deleteUser)" \
    || fail "Donation Center deletes its own login (like Amplify deleteUser)"
  [ -z "$(token "$DC_USER" "$PASSWORD")" ] \
    && pass "removed Donation Center can no longer log in" \
    || fail "removed Donation Center can no longer log in"

  # The old ID token stays valid until it expires (1 hour), but the row is gone
  expect_lambda "remove again with old token -> no donation center" donationCenter/remove "$DC" 400 "No donation center is registered"
fi

# ---------------------------------------------------------------- result
echo
echo "$PASS passed, $FAIL failed, $SKIP skipped"
[ "$FAIL" -eq 0 ]
