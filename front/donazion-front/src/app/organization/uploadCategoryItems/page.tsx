'use client'                     // NEED THIS to be able to embed HTML in TSX file
import React from 'react'

import axios from "axios"
import instance from "../../aws"

/**
 * Upload Category items page for Organization 
 */

type CategoryItem = {
  name: string
  lowPrice: number
  highPrice: number
}
type Category = {
  name: string
  items: CategoryItem[]
}
type ItemForm = {
  name: string
  lowPrice: string
  highPrice: string
}
function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.message
    )
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
export default function UploadCategoryItems() {
  const [category, setCategory] = React.useState('')
  const [items, setItems] = React.useState<ItemForm[]>([
    { name: '', lowPrice: '', highPrice: ''}
  ])
  const [categories, setCategories] = React.useState<Category[]>([])
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  function updateItem(
    index: number,
    field: keyof ItemForm,
    value: string
  ) {
    setItems(currentItems =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    )
  }
  function addItemRow() {
    setItems(currentItems => [
      ...currentItems,
      { name: '', lowPrice: '', highPrice: ''}
    ])
  }
  function removeItemRow(index: number) {
    setItems(currentItems => 
      currentItems.filter((_, itemIndex) => itemIndex !== index)
    )
  }
  async function uploadItems(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    const categoryName = category.trim()
    if (!categoryName) {
      setMessage('Error: Category name cannot be empty')
      return
    }
    const parsedItems: CategoryItem[] = []
    for (const item of items) {
      const itemName = item.name.trim()
      const lowPrice = Number(item.lowPrice)
      const highPrice = Number(item.highPrice)
      if (!itemName) {
        setMessage('Error: every item must have a name')
        return
      }
      if (item.lowPrice === '' ||item.highPrice === '' ||!Number.isFinite(lowPrice)||!Number.isFinite(highPrice)) {
        setMessage('Error: Every item must have valid prices')
        return
      }
      if (lowPrice < 0) {
        setMessage('Error: low price cannot be negative')
      }
      if (highPrice < lowPrice) {
        setMessage(`Error: high price for "${itemName}" cannot be lower than low price`)
        return
      }
      parsedItems.push({
        name: itemName,
        lowPrice,
        highPrice
      })
    }
    const names = parsedItems.map(item => item.name.toLowerCase())
    if (new Set(names).size !== names.length) {
      setMessage('Error: Item names must be unique')
    }
    const token = localStorage.getItem('idToken')
    if (!token){
      setMessage('Error: Please log in as organization!!')
      return
    }
    setSubmitting(false)
    try {
      const response = await instance.post(
        '/organization/uploadCategoryItems',
        {
          category: categoryName,
          items: parsedItems,
        },
        {
          headers: {
            Authorization: token,
          },
        }
      )
      if (response.data.error) {
        setMessage(`Error: ${response.data.error}`)
        return
      }
      setCategories(response.data.categories ?? [])
      setItems([
        {name: '', lowPrice: '', highPrice: ''},
      ])
      setMessage('Category items uploaded successfully!')
    } catch (error) {
      setMessage(`Error: ${errorMessage(error)}`)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main>
      <h1>Upload Category Items</h1>
      <form onSubmit={uploadItems}>
        <p>
          Category Name:{' '}
          <input
            type="text"
            value={category}
            onChange={event => setCategory(event.target.value)}
            required
          />
        </p>
        <h2>Items</h2>
        {items.map((item, index) => (
          <div key={index}>
            <p>
              Item Name:{' '}
              <input
                type="text"
                value={item.name}
                onChange={event =>
                  updateItem(index, 'name', event.target.value)
                }
                required
              />
            </p>
            <p>
              Low Price:{' '}
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.lowPrice}
                onChange={event =>
                  updateItem(index, 'lowPrice', event.target.value)
                }
                required
              />
            </p>
            <p>
              High Price:{' '}
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.highPrice}
                onChange={event =>
                  updateItem(index, 'highPrice', event.target.value)
                }
                required
              />
            </p>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItemRow(index)}
              >
                Remove Item
              </button>
            )}
          </div>
        ))}
        <p>
          <button type="button" onClick={addItemRow}>
            Add Another Item
          </button>
        </p>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Uploading...' : 'Upload Items'}
        </button>
      </form>
      {message && <p>{message}</p>}
      {categories.length > 0 && (
        <section>
          <h2>Updated Categories</h2>
          {categories.map(currentCategory => (
            <section key={currentCategory.name}>
              <h3>{currentCategory.name}</h3>
              {currentCategory.items.length === 0 ? (
                <p>No items.</p>
              ) : (
                <ul>
                  {currentCategory.items.map(item => (
                    <li key={item.name}>
                      {item.name}: ${item.lowPrice} - ${item.highPrice}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </section>
      )}
    </main>
  )
}
