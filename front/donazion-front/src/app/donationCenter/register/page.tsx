'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import axios from "axios"
import instance from "../../aws"

/**
 * Register Donation Center page
 *
 * 1. Sign up a Cognito user (username, email, password). The Pre Sign-up trigger
 *    auto-confirms it (no email code) and the Post Confirmation trigger adds it
 *    to the DonationCenter group.
 * 2. Sign in to get an ID token.
 * 3. POST /donationCenter/register with the token in the Authorization header.
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

export default function RegisterDonationCenter() {
  const [username, setUsername] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [zipCode, setZipCode] = React.useState('')
  const [lat, setLat] = React.useState('')
  const [lon, setLon] = React.useState('')

  const [idToken, setIdToken] = React.useState('')   // set once the account exists and is signed in
  const [message, setMessage] = React.useState('')

  async function register(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      // Create the account and sign in (skipped if a previous attempt already did this)
      let token = idToken
      if (!token) {
        await cognito('SignUp', {
          ClientId: CLIENT_ID,
          Username: username,
          Password: password,
          UserAttributes: [{ Name: 'email', Value: email }],
        })
        const result = await cognito('InitiateAuth', {
          ClientId: CLIENT_ID,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: username, PASSWORD: password },
        })
        token = result.AuthenticationResult.IdToken
        setIdToken(token)
        localStorage.setItem('idToken', token)   // so other pages can make authorized API calls
      }

      const response = await instance.post('/donationCenter/register', {
        name: name,
        location: { address: address, zipCode: zipCode, lat: Number(lat), lon: Number(lon) },
      }, {
        headers: { Authorization: token },
      })

      // The Lambda returns HTTP 200 with statusCode 400 for errors it catches itself
      if (response.data.statusCode === 200) {
        setMessage(response.data.message)
      } else {
        setMessage('Error: ' + response.data.error)
      }
    } catch (e) {
      setMessage('Error: ' + errorMessage(e))
    }
  }

  return (
    <div>
      <h1>Register Donation Center</h1>
      <form onSubmit={register}>
        <p>Username: <input value={username} onChange={e => setUsername(e.target.value)} disabled={!!idToken} required /></p>
        <p>Email: <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!idToken} required /></p>
        <p>Password: <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={!!idToken} required /></p>
        <p>(at least 8 characters, with uppercase, lowercase, and a digit)</p>

        <p>Donation Center Name: <input value={name} onChange={e => setName(e.target.value)} required /></p>
        <p>Address: <input value={address} onChange={e => setAddress(e.target.value)} required /></p>
        <p>Zip Code: <input value={zipCode} onChange={e => setZipCode(e.target.value)} maxLength={5} required /></p>
        <p>Latitude: <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} required /></p>
        <p>Longitude: <input type="number" step="any" value={lon} onChange={e => setLon(e.target.value)} required /></p>

        <button type="submit">Register</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  )
}
