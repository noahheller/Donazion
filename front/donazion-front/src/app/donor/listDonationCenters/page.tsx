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

const PAGE_SIZE = 6;

export default function ListDonationCenters() {
  const [centers, setDonationCenters] = React.useState<DonationCenter[] | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState('')
  const [page, setPage] = React.useState(1)

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
    }
    void loadDonationCenters()
      return () => controller.abort()

  }, [])

  const totalPage = centers ? Math.ceil(centers.length / PAGE_SIZE) : 1
  const start = (page - 1) * PAGE_SIZE
  const onSiteCenters = centers?.slice(start, start + PAGE_SIZE) ?? []

  return (
    <main>
      <h1>List Donation Centers</h1>

      {error && <p role="alert">{error}</p>}
      {loading && !error && <p role="status">Loading donation centers...</p>}
      {centers?.length === 0 && <p>No donation centers have been registered.</p>}

      {onSiteCenters.length > 0 && (
        <ul>
          {onSiteCenters.map((center) => (
            <li key={center.name}>
              <h2>{center.name}</h2>
                <p>lat: {center.location.lat}, lon: {center.location.lon}</p>
                <p>address: {center.location.address}</p>
                <p>zipCode: {center.location.zipCode}</p>
            </li>
          ))}
        </ul>
      )}

      {totalPage > 1 && (
        <nav area-label="Donation Centers">
          <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
            Previous
          </button>
          <span>
            {page} of {totalPage}
          </span>
          <button onClick={() => setPage((p) => Math.min(p + 1, totalPage))} disabled={page === totalPage}>
            Next
          </button>
        </nav>
      )}
    </main>
  )
}

