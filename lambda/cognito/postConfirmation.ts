import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { PostConfirmationTriggerEvent } from 'aws-lambda'

const client = new CognitoIdentityProviderClient({})

/**
 * Cognito Post Confirmation trigger.
 *
 * Self sign-up is only for Donation Centers, so every user who confirms their
 * email through sign-up goes into the DonationCenter group. Organization
 * accounts are created by an admin (see scripts/create-org-user.sh), which
 * does not fire this trigger.
 */
export const handler = async (event: PostConfirmationTriggerEvent) => {
    if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
        await client.send(new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: process.env.DONATION_CENTER_GROUP!,
        }))
    }
    return event   // Cognito triggers must return the event
}
