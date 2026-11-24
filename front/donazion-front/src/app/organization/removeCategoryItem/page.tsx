'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import axios from "axios"
import instance from "../../aws"

/**
 * Remove Donation Center page
 *
 * 1. Sign in with Cognito (username or email + password) to get fresh ID and access
 *    tokens, and check that the user is in the DonationCenter group. Asking for the
 *    password again confirms this destructive action.
 * 2. POST /donationCenter/remove with the ID token in the Authorization header.
 *    The Lambda only deletes the donation center's database row.
 * 3. Delete the Cognito login with DeleteUser, using the user's own access token,
 *    and clear the saved 'idToken' from localStorage.
 *
 * Needs these in front/donazion-front/.env.local (values from the CDK stack outputs):
 *   NEXT_PUBLIC_AWS_REGION=us-east-2
 *   NEXT_PUBLIC_USER_POOL_CLIENT_ID=...
 */

const REGION = process.env.NEXT_PUBLIC_AWS_REGION
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID

// Returned by the Lambda when this account has no donation center row (e.g. a previous
// attempt removed the row but failed to delete the login). The login is still deleted then.
const NOT_REGISTERED = 'No donation center is registered'

interface DonationCenter {
    name: string
    location: { lat: number, lon: number, address: string, zipCode: string }
}

// Calls the Cognito User Pools API directly (the app client has no secret)
async function cognito(action: string, body: object) {
    const response = await axios.post(`https://cognito-idp.${REGION}.amazonaws.com/`, body, {
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
        },
    })
    return response.data
}

function errorMessage(e: any): string {
    return e?.response?.data?.message ?? e?.message ?? String(e)
}

// Reads the cognito:groups claim from an ID token
// this function was AI generated to extract group from token
function groupsOf(idToken: string): string[] {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))['cognito:groups'] ?? []
}

export default function RemoveCategoryItem() {
    const [categoryItemName, setCategoryItemName] = React.useState('')
    const [message, setMessage] = React.useState('')

    async function remove(e: React.FormEvent) {
        e.preventDefault()
        setMessage('')
        try {
            const token = localStorage.getItem('idToken')
            if (!token) {
                setMessage("Error: Please log in as organization first")
                return
            }

            if (!groupsOf(token).includes('Organization')) {
                setMessage('Error: this account is not an Organization ')
                return
            }

            const response = await instance.post(
                '/organization/removeCategoryItem',
                {
                    name: categoryItemName,
                },
                {
                    headers: {
                        Authorization: token,
                    },
                }
            )


            // The Lambda returns HTTP 200 with { statusCode, body } where body is a JSON string
            const body = JSON.parse(response.data.body)
            if (response.data.statusCode === 200) {
                setMessage(body);
            } else if (!String(body.error).includes(NOT_REGISTERED)) {
                setMessage('Error: ' + body.error)
                return
            }
        } catch (e) {
            setMessage('Error: ' + errorMessage(e))
        }
    }

    return (
        <div>
            <h1>Remove CategoryItems</h1>
            <p>This permanently deletes a Category Item </p>
            <form onSubmit={remove}>
                <p>Category Item name<input value={categoryItemName} onChange={e => setCategoryItemName(e.target.value)}
                                            required/></p>
                <button type="submit">Remove Category Item</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    )
}
