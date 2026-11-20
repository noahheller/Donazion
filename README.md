# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Authentication (Cognito)

Organizations and Donation Centers log in through a Cognito user pool. Donors have no login.
Users have a **username, email, and password** and can sign in with either username or email.

* **Donation Centers** self-register (Amplify `signUp` + `confirmSignUp`). A post-confirmation
  trigger (`lambda/cognito/postConfirmation.ts`) adds them to the `DonationCenter` group.
* **Organizations** are created by an admin: `scripts/create-org-user.sh <username> <email> <password>`
  (adds them to the `Organization` group).
* **Login / change password / forgot password** happen in the frontend with Amplify
  (`signIn`, `updatePassword`, `resetPassword`), so there are no `/login` or `/changePassword` API routes.

### Calling protected endpoints

Every `/organization/*` and `/donationCenter/*` route uses a Cognito authorizer. Send the
**ID token** (not the access token) in the `Authorization` header:

```ts
const token = (await fetchAuthSession()).tokens?.idToken?.toString()
fetch(`${API_URL}/organization/addCategory`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: token! },
  body: JSON.stringify({ name: 'electronics' }),
})
```

This replaces the `username` / `securityCredentials` fields in `APIDesign.md`. API Gateway adds the
verified caller to the event, so in a Lambda:

```ts
import { requireRole } from '../auth'
const auth = requireRole(event, 'Organization')   // throws -> 400 if wrong role
auth.username; auth.email; auth.sub               // sub = stable id, store it in the DB
event.name                                        // body fields are still top-level
```

Frontend config values are in the `cdk deploy` outputs: `UserPoolId`, `UserPoolClientId`, `Region`, `ApiUrl`.
