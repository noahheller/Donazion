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

POOL_ID=$(aws cloudformation describe-stacks --stack-name DonazionStack \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --message-action SUPPRESS >/dev/null

# Set a permanent password so there is no "change password on first login" step
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --password "$PASSWORD" --permanent

aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" --username "$USERNAME" \
  --group-name Organization

echo "Created Organization user '$USERNAME' in $POOL_ID"
