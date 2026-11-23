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

export default function RemoveDonationCenter() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmed, setConfirmed] = React.useState(false)

  const [message, setMessage] = React.useState('')
  const [remaining, setRemaining] = React.useState<DonationCenter[] | null>(null)   // list returned after removal

  async function remove(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setRemaining(null)
    try {
      const auth = await cognito('InitiateAuth', {
        ClientId: CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
      const idToken = auth.AuthenticationResult.IdToken
      const accessToken = auth.AuthenticationResult.AccessToken

      if (!groupsOf(idToken).includes('DonationCenter')) {
        setMessage('Error: this account is not a Donation Center')
        return
      }

      const response = await instance.post('/donationCenter/remove', {}, {
        headers: { Authorization: idToken },
      })

      // The Lambda returns HTTP 200 with { statusCode, body } where body is a JSON string
      const body = JSON.parse(response.data.body)
      if (response.data.statusCode === 200) {
        setRemaining(body.donationCenters)
      } else if (!String(body.error).includes(NOT_REGISTERED)) {
        setMessage('Error: ' + body.error)
        return
      }

      // Delete the login itself so the account can no longer sign in
      await cognito('DeleteUser', { AccessToken: accessToken })
      localStorage.removeItem('idToken')

      setUsername('')
      setPassword('')
      setConfirmed(false)
      setMessage('Donation Center removed')
    } catch (e) {
      setMessage('Error: ' + errorMessage(e))
    }
  }

  return (
    <div>
      <h1>Remove Donation Center</h1>
      <p>This permanently deletes your donation center and your login. Enter your credentials to confirm.</p>
      <form onSubmit={remove}>
        <p>Username or Email: <input value={username} onChange={e => setUsername(e.target.value)} required /></p>
        <p>Password: <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></p>
        <p>
          <label>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />
            {' '}I understand this cannot be undone
          </label>
        </p>
        <button type="submit" disabled={!confirmed}>Remove Donation Center</button>
      </form>
      {message && <p>{message}</p>}

      {remaining && (
        <div>
          <h2>Remaining Donation Centers</h2>
          {remaining.length === 0 ? <p>None</p> : (
            <ul>
              {remaining.map(dc => (
                <li key={dc.name}>
                  {dc.name}: {dc.location.address} {dc.location.zipCode} ({dc.location.lat}, {dc.location.lon})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
