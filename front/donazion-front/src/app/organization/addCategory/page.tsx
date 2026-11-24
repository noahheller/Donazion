'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import axios from "axios"
import instance from "../../aws"

/** 
 * Add Category page for the organization.
 * The required fields for adding a category are:
 * - Category Name (must be unique)
 * 
*/
type Category = {
  name: string
  items: {
    name: string
    lowPrice: number
    highPrice: number
  }[]
}
function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.message
    )
  }
  if (error instanceof Error){
    return error.message
  }
  return String(error)
}
export default function AddCategory() {
  const [name, setName] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [categories, setCategories] = React.useState<Category[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  async function addCategory(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    const categoryName = name.trim()
    if (!categoryName) {
      setMessage("Error: Category name can't be empty")
      return
    }
    const token = localStorage.getItem('idToken')
    if (!token) {
      setMessage("Error: Please log in as organization first")
      return
    }
    setSubmitting(true)
    try {
      const response = await instance.post(
        '/organization/addCategory',
        {name: categoryName},
        {
          headers: {
            Authorization: token,
          }
        }
      )
      if (response.data.error){
        setMessage(`Error: ${response.data.error}`)
        return
      }
      setCategories(response.data.categories ?? [])
      setName('')
      setMessage(`Category "${categoryName}" added successfully`)
    } catch (error) {
      setMessage(`Error: ${errorMessage(error)}`)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main>
      <h1>Add Category</h1>
      <form onSubmit={addCategory}>
        <p>
          Category Name:{' '}
          <input
            type="text"
            value = {name}
            onChange={event => setName(event.target.value)}
            required
          />
        </p>
        <button type="submit" disabled={submitting}>
          <form>
            {submitting ? 'Adding...': 'Add Category'}
          </form>
        </button>
        </form>
      {message && <p>{message}</p>}

      {categories.length > 0 && (
        <section>
          <h2>Categories</h2>

          <ul>
            {categories.map(category => (
              <li key={category.name}>
                {category.name} ({category.items.length} items)
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
