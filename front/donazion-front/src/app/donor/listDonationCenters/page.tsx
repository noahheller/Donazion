'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import {isAxiosError} from "axios"
import instance from "../../aws"

interface DonationCenter {
  name: string;
  location: {
    lat: number
    lon: number
    address: string
    zipCode?: string
  }
}

interface DonationCenterResponse {
  donationCenters?: DonationCenter[];
  statusCode?: number
  error?: string
  message?: string
}

export default function ListDonationCenters() {
  const [centers, setDonationCenters] = React.useState<DonationCenter[] | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()

    async function loadDonationCenters() {
      try {
        setLoading(true)
        const { data } = await instance.get("donor/listDonationCenters", { signal: controller.signal })

        if(data?.error || (data?.statusCode ?? 200) >= 400) {
          setError(data?.error || 'Unable to load donation centers')
        }

        if(!Array.isArray(data?.donationCenters)) {
          setError(data?.error || 'API failed to return list of donation centers')
        }

        if(!controller.signal.aborted) {
          setDonationCenters(data.donationCenters)
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) {
          return
        }

        const apiError = isAxiosError<DonationCenterResponse>(e) ? e.response?.data : undefined
        setError(
          apiError?.error ??
          apiError?.message ??
          (e instanceof Error ? e.message : 'Unable to load donation centers'),
        )
       }
       finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
      void loadDonationCenters()
      return () => controller.abort()
    }
  }, [])

  return (
    <main>
      <h1>List Donation Centers</h1>
      {error && <p role="alert">{error}</p>}
      {loading && !error && <p role="status">Loading donation centers...</p>}
      {centers?.length === 0 && <p>No donation centers have been registered.</p>}

      {centers && centers.length > 0 && (
        <ul>
          {centers.map((center) => (
            <li key={center.name}>
              <h2>{center.name}</h2>
                <p>{center.location.address} {center.location.zipCode}</p>
                <p>Latitude {center.location.lat}, longitude {center.location.lon}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

