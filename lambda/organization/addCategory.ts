type AddCategoryRequest = {
  username: string
  securityCredentials: string
  name: string
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
  if (!isRecord(payload)) {
    throw new Error('Invalid request')
  }
  const { username, securityCredentials, name } = payload
  if (
    typeof username !== 'string' ||
    typeof securityCredentials !== 'string' ||
    typeof name !== 'string' ||
    !username.trim() ||
    !securityCredentials ||
    !name.trim()
  ) {
    throw new Error('Invalid request')
  }
  return {
    username: username.trim(),
    securityCredentials,
    name: name.trim(),
  }
}
export const handler = async (event: unknown) => {
  const request = parseAddCategoryRequest(event)
  
  // Temporary: replace this when you add credential verification and database work.
  throw new Error('addCategory authentication and database steps are not implemented yet')
}
