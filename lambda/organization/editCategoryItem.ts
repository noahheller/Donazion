import { requireRole } from '../auth'

export const handler = async (event: any) => {
  // Caller verified by the Cognito authorizer. Use auth.username / auth.sub instead of
  // the "username" + "securityCredentials" fields in APIDesign.md.
  const auth = requireRole(event, 'Organization')

  // TODO: implement editCategoryItem
  throw new Error('editCategoryItem is not implemented yet')
}
