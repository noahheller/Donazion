'use client'
import React from 'react'

import { isAxiosError } from "axios"
import instance from "../../aws"


interface CategoryItem {
  name: string
  lowPrice: number
  highPrice: number
}

interface CategoryList {
  name: string
  categories: CategoryItem[]
};

interface OrganizationDashboard {
  username: string;
  totalCenters: number | string;
  dashboardCategories: CategoryList[];
}

const dollarCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

interface ApiError {
  statusCode?: number
  error?: string
  message?: string
}

export default function ShowDashboard() {
  const [dashboardData, setDashboardData] = React.useState<OrganizationDashboard | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        const token = localStorage.getItem('idToken');
        if (!token) {
          throw new Error('No authentication found, need to log in Organization');
        }

        const response = await instance.post<OrganizationDashboard & ApiError> (
          '/organization/dashboard',
          {},
          {headers: {Authorization: token},
           signal: controller.signal,
          },
        )

        if (response.data.error || (response.data.statusCode ?? 200) >= 400) {
          throw new Error(response.data.error ?? response.data.message ?? 'Unable to load the dashboard.')
        }

        if(controller.signal.aborted) {
          setDashboardData(response.data);
        }

      } catch (e) {
        if (controller.signal.aborted) {
          return
        }
        const apiError = isAxiosError(e) ? e.response?.data?.message : String(e);
        setError(apiError);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      controller.abort()
    }
  }, [])

  return (
    <main>
      <h1>Organization Dashboard</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!dashboardData && !error && <p role = "status">Loading dashboard...</p>}

      {dashboardData && (
        <div>
          <p>Currently signed in as {dashboardData.username}</p>
          <p>Total donation centers: {dashboardData.totalCenters}</p>
          <h2>Dashboard Categories</h2>
          {dashboardData.dashboardCategories.length === 0 && <p>No categories yet added.</p>}

          {dashboardData.dashboardCategories.map((categoryList) => (
            <div key={categoryList.name}>
              <h3>{categoryList.name}</h3>
              {categoryList.categories.length === 0 ? (<p>No items in this category.</p>) : (
              <ul>
                {categoryList.categories.map((category) => (
                  <li key={category.name}>
                    {category.name} : {dollarCurrency.format(category.lowPrice)} - {dollarCurrency.format(category.highPrice)}
                  </li>
                ))}
              </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

