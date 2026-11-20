import { requireRole } from '../auth'
import mysql, { RowDataPacket } from 'mysql2/promise'

type AddCategoryRequest = {
  name: string
}

type CategoryRow = RowDataPacket & {
  name: string
}

type CategoryItemRow = RowDataPacket & {
  category: string
  name: string
  lowPrice: number
  highPrice: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getPayload(event: unknown): unknown {
  if (!isRecord(event) || !('body' in event)) {
    return event
  }
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body) as unknown
    } catch {
      throw new Error('Invalid request')
    }
  }
  return event.body
}

function parseAddCategoryRequest(event: unknown): AddCategoryRequest {
  const payload = getPayload(event)
  if (!isRecord(payload) || typeof payload.name !== 'string' || !payload.name.trim()) {
    throw new Error('Invalid request')
  }
  return { name: payload.name.trim() }
}

const pool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
  waitForConnections: true,
  connectionLimit: 2,
})

async function fetchCategories() {
  const [categoryRows] = await pool.execute<CategoryRow[]>(
    'SELECT name FROM Category ORDER BY name',
  )
  const [itemRows] = await pool.execute<CategoryItemRow[]>(
    `SELECT category, name, lowPrice, highPrice
     FROM CategoryItems
     ORDER BY category, name`,
  )
  return categoryRows.map(category => ({
    name: category.name,
    items: itemRows
      .filter(item => item.category === category.name)
      .map(item => ({
        name: item.name,
        lowPrice: item.lowPrice,
        highPrice: item.highPrice,
      })),
  }))
}

export const handler = async (event: unknown) => {
  requireRole(event, 'Organization')
  const request = parseAddCategoryRequest(event)
  const [existingCategories] = await pool.execute<CategoryRow[]>(
    'SELECT name FROM Category WHERE name = ?',
    [request.name],
  )
  if (existingCategories.length > 0) {
    throw new Error('category already exists')
  }
  try {
    await pool.execute(
      'INSERT INTO Category (name) VALUES (?)',
      [request.name],
    )
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ER_DUP_ENTRY'
    ) {
      throw new Error('category already exists')
    }
    throw error
  }
  return {
    categories: await fetchCategories(),
  }
}
