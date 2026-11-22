import { requireRole } from '../auth'
import mysql, { PoolConnection, RowDataPacket } from 'mysql2/promise'

type CategoryItemInput = {
  name: string
  lowPrice: number
  highPrice: number
}

type UploadCategoryItemsRequest = {
  category: string
  items: CategoryItemInput[]
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
      throw new Error('Invalid request. Please provide a valid category and item.')
    }
  }
  return event.body
}

function parseUploadRequest(event: unknown): UploadCategoryItemsRequest {
  const payload = getPayload(event)
  if (!isRecord(payload)) {
    throw new Error('Invalid request. Please provide a valid category and item.')
  }
  const { category, items } = payload
  if (
    typeof category !== 'string' ||
    !category.trim() ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error('Invalid request. Please provide a valid category and item.')
  }
  const parsedItems: CategoryItemInput[] = []
  const namesInRequest = new Set<string>()
  for (const item of items) {
    if (
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.lowPrice !== 'number' ||
      !Number.isFinite(item.lowPrice) ||
      typeof item.highPrice !== 'number' ||
      !Number.isFinite(item.highPrice) ||
      item.lowPrice < 0 ||
      item.highPrice < item.lowPrice
    ) {
      throw new Error('Invalid request. Please provide a valid category and item.')
    }
    const name = item.name.trim()
    const normalizedName = name.toLowerCase()
    if (namesInRequest.has(normalizedName)) {
      throw new Error(`${name} already exists in the ${category.trim()} category.`)
    }
    namesInRequest.add(normalizedName)
    parsedItems.push({
      name,
      lowPrice: item.lowPrice,
      highPrice: item.highPrice,
    })
  }
  return {
    category: category.trim(),
    items: parsedItems,
  }
}

const pool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
  waitForConnections: true,
  connectionLimit: 2,
})

async function categoryExists(connection: PoolConnection, category: string): Promise<boolean> {
  const [rows] = await connection.execute<CategoryRow[]>(
    'SELECT name FROM Category WHERE name = ?',
    [category],
  )
  return rows.length === 1
}

async function findDuplicateItem(
  connection: PoolConnection,
  category: string,
  itemName: string,
): Promise<boolean> {
  const [rows] = await connection.execute<CategoryItemRow[]>(
    'SELECT name FROM CategoryItems WHERE category = ? AND name = ?',
    [category, itemName],
  )
  return rows.length > 0
}

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
  const request = parseUploadRequest(event)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction() // Starts a transaction on database connection
    // Validates that category exists and items are unique in category
    if (!(await categoryExists(connection, request.category))) {
      throw new Error('Invalid request. Please provide a valid category and item.')
    }
    for (const item of request.items) {
      if (await findDuplicateItem(connection, request.category, item.name)) {
        throw new Error(
          `${item.name} already exists in the ${request.category} category.`,
        )
      }
    }
    for (const item of request.items) {
      await connection.execute(
        `INSERT INTO CategoryItems (name, category, lowPrice, highPrice)
         VALUES (?, ?, ?, ?)`,
        [item.name, request.category, item.lowPrice, item.highPrice],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return {
    categories: await fetchCategories(),
  }
}
