type CategoryItemInput = {
  name: string
  lowPrice: number
  highPrice: number
}
type UploadCategoryItemsRequest = {
  username: string
  securityCredentials: string
  category: string
  items: CategoryItemInput[]
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
  const { username, securityCredentials, category, items } = payload
  if (
    typeof username !== 'string' ||
    !username.trim() ||
    typeof securityCredentials !== 'string' ||
    !securityCredentials.trim() ||
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
    username: username.trim(),
    securityCredentials,
    category: category.trim(),
    items: parsedItems,
  }
}
export const handler = async (event: unknown) => {
  const request = parseUploadRequest(event)
  // Next: authenticate, find the category, insert items, and fetch categories.
  throw new Error('uploadCategoryItems authentication and database steps are not implemented yet')
}