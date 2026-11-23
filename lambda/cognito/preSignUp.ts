import type { PreSignUpTriggerEvent } from 'aws-lambda'

/**
 * Cognito Pre Sign-up trigger.
 *
 * Auto-confirms Donation Centers when they sign up, so they do not need to
 * enter an email verification code. The Post Confirmation trigger still runs
 * afterwards and adds them to the DonationCenter group.
 */
export const handler = async (event: PreSignUpTriggerEvent) => {
    event.response.autoConfirmUser = true
    if (event.request.userAttributes.email) {
        event.response.autoVerifyEmail = true
    }
    return event   // Cognito triggers must return the event
}
