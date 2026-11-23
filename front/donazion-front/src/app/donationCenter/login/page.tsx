'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import axios from "axios"
import instance from "../../aws"

/**
 * Login Donation Center page
 *
 * Signs in with Cognito (username or email + password), checks that the user is
 * in the DonationCenter group, and saves the ID token to localStorage as 'idToken'
 * so other pages can send it in the Authorization header.
 *
 * Needs these in front/donazion-front/.env.local (values from the CDK stack outputs):
 *   NEXT_PUBLIC_AWS_REGION=us-east-2
 *   NEXT_PUBLIC_USER_POOL_CLIENT_ID=...
 */

const REGION = process.env.NEXT_PUBLIC_AWS_REGION
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID

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
function groupsOf(idToken: string): string[] {
  const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(payload))['cognito:groups'] ?? []
}

export default function LoginDonationCenter() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [message, setMessage] = React.useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      const result = await cognito('InitiateAuth', {
        ClientId: CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
      const token = result.AuthenticationResult.IdToken

      if (!groupsOf(token).includes('DonationCenter')) {
        setMessage('Error: this account is not a Donation Center')
        return
      }

      localStorage.setItem('idToken', token)   // so other pages can make authorized API calls
      setMessage('Successful login')
    } catch (e) {
      setMessage('Error: ' + errorMessage(e))
    }
  }

  return (
    <div>
      <h1>Donation Center Login</h1>
      <form onSubmit={login}>
        <p>Username or Email: <input value={username} onChange={e => setUsername(e.target.value)} required /></p>
        <p>Password: <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></p>
        <button type="submit">Log In</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  )
}