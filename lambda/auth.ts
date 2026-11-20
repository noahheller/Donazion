/**
 * Shared auth helpers for Lambdas behind the Cognito authorizer.
 *
 * API Gateway checks the Cognito ID token (Authorization header) before the
 * Lambda runs, then the request mapping template adds the caller's claims to
 * the event as `event.auth`, alongside the normal JSON body fields.
 */

export type Role = 'Organization' | 'DonationCenter'

export interface AuthInfo {
    sub: string        // stable Cognito user id
    username: string
    email: string
    groups: Role[]
}

// API Gateway renders the groups claim as a string such as "Organization" or
// "[Organization DonationCenter]" or "Organization,DonationCenter".
function parseGroups(raw: unknown): Role[] {
    if (Array.isArray(raw)) return raw as Role[]
    if (typeof raw !== 'string') return []
    return raw.replace(/[\[\]]/g, '').split(/[\s,]+/).filter(Boolean) as Role[]
}

export function getAuth(event: any): AuthInfo {
    const a = event?.auth
    if (!a || !a.sub) {
        throw new Error('Unauthorized: missing authentication')
    }
    return { sub: a.sub, username: a.username, email: a.email, groups: parseGroups(a.groups) }
}

/** Throws (giving a 400 error response) unless the caller is in one of the given groups. */
export function requireRole(event: any, ...roles: Role[]): AuthInfo {
    const auth = getAuth(event)
    if (!roles.some(r => auth.groups.includes(r))) {
        throw new Error(`Forbidden: requires role ${roles.join(' or ')}`)
    }
    return auth
}
