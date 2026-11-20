import { requireRole } from '../auth'

export const handler = async (event: any) => {
  // Caller verified by the Cognito authorizer. Use auth.username / auth.sub instead of
  // the "username" + "securityCredentials" fields in APIDesign.md.
  const auth = requireRole(event, 'Organization')

  // TODO: implement removeCategory
  throw new Error('removeCategory is not implemented yet')
}
