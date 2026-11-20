#!/usr/bin/env bash
# Creates an Organization login in the Donazion Cognito user pool.
# Organizations cannot self-register (only Donation Centers can), so an admin runs this.
#
# Usage: scripts/create-org-user.sh <username> <email> <password>
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "Usage: $0 <username> <email> <password>" >&2
  exit 1
fi
USERNAME=$1; EMAIL=$2; PASSWORD=$3

# Check the pool's password policy up front (see passwordPolicy in lib/donazion-stack.ts)
# so a bad password doesn't leave a half-created user behind.
problems=()
[ ${#PASSWORD} -ge 8 ]          || problems+=("at least 8 characters")
[[ $PASSWORD =~ [A-Z] ]]        || problems+=("an uppercase letter")
[[ $PASSWORD =~ [a-z] ]]        || problems+=("a lowercase letter")
[[ $PASSWORD =~ [0-9] ]]        || problems+=("a number")
if [ ${#problems[@]} -gt 0 ]; then
  echo "Password must contain: $(IFS=,; echo "${problems[*]}" | sed 's/,/, /g')" >&2
  exit 1
fi

POOL_ID=$(aws cloudformation describe-stacks --stack-name DonazionStack \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$USERNAME" >/dev/null 2>&1; then
  echo "User '$USERNAME' already exists; updating its password and group."
  aws cognito-idp admin-update-user-attributes --user-pool-id "$POOL_ID" --username "$USERNAME" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true
else
  aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$USERNAME" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS >/dev/null
fi

# Set a permanent password so there is no "change password on first login" step
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --password "$PASSWORD" --permanent

aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --group-name Organization

echo "Organization user '$USERNAME' is ready in $POOL_ID"
