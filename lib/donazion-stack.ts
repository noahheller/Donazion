import * as cdk from 'aws-cdk-lib'
import {Construct} from 'constructs'
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import {Duration} from 'aws-cdk-lib'

// Cognito group names (must match lambda/auth.ts Role and the frontend)
const ORGANIZATION_GROUP = 'Organization'
const DONATION_CENTER_GROUP = 'DonationCenter'

export class DonazionStack extends cdk.Stack {
    private vpc: ec2.IVpc
    private securityGroup: ec2.ISecurityGroup

    // NOTE: You First have to add RDS_USER and RDS_PASSWORD to
    // your environment variables for your account. Same with RDS_DATABASE and RDS_HOST
    private readonly rdsUser = process.env.RDS_USER!
    private readonly rdsPassword = process.env.RDS_PASSWORD!
    private readonly rdsDatabase = process.env.RDS_DATABASE!
    private readonly rdsHost = process.env.RDS_HOST!

    // Creates a Lambda function with the shared VPC, security group, and RDS environment
    private makeFunction(id: string, entry: string) {
        return new lambdaNodejs.NodejsFunction(this, id, {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            entry: entry,
            vpc: this.vpc,
            environment: {
                RDS_USER: this.rdsUser,
                RDS_PASSWORD: this.rdsPassword,
                RDS_DATABASE: this.rdsDatabase,
                RDS_HOST: this.rdsHost
            },
            securityGroups: [this.securityGroup],
            timeout: Duration.seconds(3),
        })
    }

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)
        const vpc = this.vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
            vpcId: 'vpc-0dace1116aca7de00',
            availabilityZones: ['us-east-2b', 'us-east-2a', 'us-east-2c'],
            privateSubnetIds: ['subnet-0aa25cae95f4cc0af', 'subnet-079698e83ac7dca2c', 'subnet-07bb51b538ee6a9f3'],
        })

        const securityGroup = this.securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-00c987594d9a6fbfa', {             // Find your security group
            mutable: false
        })


        // ===================== Cognito (authentication) =====================
        // Organizations and Donation Centers log in. Donors do not.
        // Users have a username, email, and password, and can sign in with either username or email.
        const userPool = new cognito.UserPool(this, 'DonazionUserPool', {
            userPoolName: 'DonazionUserPool',
            selfSignUpEnabled: true,                       // Donation Centers register themselves
            signInAliases: { username: true, email: true },
            signInCaseSensitive: false,
            autoVerify: { email: true },                   // email a confirmation code on sign-up
            standardAttributes: {
                email: { required: true, mutable: true },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY,      // class project: delete the pool with the stack
        })

        new cognito.UserPoolGroup(this, 'OrganizationGroup', {
            userPool, groupName: ORGANIZATION_GROUP, description: 'Organization administrators',
        })
        new cognito.UserPoolGroup(this, 'DonationCenterGroup', {
            userPool, groupName: DONATION_CENTER_GROUP, description: 'Donation Center accounts',
        })

        // Adds every self-registered user to the DonationCenter group once their email is confirmed.
        // Not in the VPC: it only needs to reach the Cognito API, not RDS.
        const postConfirmationFn = new lambdaNodejs.NodejsFunction(this, 'PostConfirmationFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            entry: path.join(__dirname, '..', 'lambda', 'cognito', 'postConfirmation.ts'),
            environment: { DONATION_CENTER_GROUP },
            timeout: Duration.seconds(10),
        })
        // Wildcard pool ARN avoids a circular dependency between the pool and its own trigger
        postConfirmationFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cognito-idp:AdminAddUserToGroup'],
            resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`],
        }))
        userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationFn)

        // App client used by the Amplify frontend (public client: no secret)
        const userPoolClient = userPool.addClient('DonazionWebClient', {
            userPoolClientName: 'DonazionWebClient',
            generateSecret: false,
            authFlows: { userSrp: true, userPassword: true },
            preventUserExistenceErrors: true,
            idTokenValidity: Duration.hours(1),
            accessTokenValidity: Duration.hours(1),
            refreshTokenValidity: Duration.days(30),
        })

        // generic default handler for any API function that doesn't get its own Lambda method
        const default_fn = new lambdaNodejs.NodejsFunction(this, 'LambdaDefaultFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            entry: path.join(__dirname, '..', 'lambda', 'default.ts'),
            vpc: vpc,
            securityGroups: [securityGroup],
            timeout: Duration.seconds(3),
        })

        const api_endpoint = new apigw.LambdaRestApi(this, `donazionapi`, {
            handler: default_fn,
            restApiName: `DonazionApi`,
            proxy: false,
            defaultCorsPreflightOptions: {                                        // Optional BUT very helpful: Add CORS configuration
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: apigw.Cors.DEFAULT_HEADERS,
            },
        })

        // Checks the Cognito ID token sent in the Authorization header
        const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'DonazionAuthorizer', {
            cognitoUserPools: [userPool],
        })

        // Make 401/403 from the authorizer carry CORS headers so the browser can read them
        api_endpoint.addGatewayResponse('Default4xx', {
            type: apigw.ResponseType.DEFAULT_4XX,
            responseHeaders: { 'Access-Control-Allow-Origin': "'*'", 'Access-Control-Allow-Headers': "'*'" },
        })
        api_endpoint.addGatewayResponse('Default5xx', {
            type: apigw.ResponseType.DEFAULT_5XX,
            responseHeaders: { 'Access-Control-Allow-Origin': "'*'", 'Access-Control-Allow-Headers': "'*'" },
        })

        // Create a resource (e.g., '/organization')
        const orgResource = api_endpoint.root.addResource('organization')
        const showDashOrgResource = orgResource.addResource('showDashboard')
        const addCategoryResource = orgResource.addResource('addCategory')
        const removeCategoryResource = orgResource.addResource('removeCategory')
        const uploadCategoryItemsResource = orgResource.addResource('uploadCategoryItems')
        const removeCategoryItemResource = orgResource.addResource('removeCategoryItem')
        const editCategoryItemResource = orgResource.addResource('editCategoryItem')
        const listDonationCentersOrgResource = orgResource.addResource('listDonationCenters')

        const dcResource = api_endpoint.root.addResource('donationCenter')
        const registerDCResource = dcResource.addResource('register')
        const removeDCResource = dcResource.addResource('remove')
        const showDashDCResource = dcResource.addResource('showDashboard')
        const listInventoryDCResource = dcResource.addResource('listInventory')
        const addWishlistItemDCResource = dcResource.addResource('addWishlistItem')
        const removeWishlistItemDCResource = dcResource.addResource('removeWishlistItem')

        const donorResource = api_endpoint.root.addResource('donor')
        const listDCDonorResource = donorResource.addResource('listDonationCenters')


        // Method responses declare which headers exist...
        const corsHeaders = {
            'method.response.header.Content-Type': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
        }
        // ...integration responses supply their actual values
        const corsHeaderValues = {
            'method.response.header.Content-Type': "'application/json'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
        }
        // https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-apigateway/README.md
        const integration_parameters = {
            proxy: false,
            passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_MATCH,

            integrationResponses: [
                {
                    // Successful response from the Lambda function, no filter defined
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': '$input.json(\'$\')',       // should just pass JSON through untouched
                    },
                    responseParameters: corsHeaderValues,
                },
                {
                    // For errors, we check if the error message is not empty, get the error data
                    selectionPattern: '(\n|.)+',
                    statusCode: "400",
                    responseTemplates: {
                        'application/json': JSON.stringify({
                            state: 'error',
                            message: "$util.escapeJavaScript($input.path('$.errorMessage'))"
                        })
                    },
                    responseParameters: corsHeaderValues
                }
            ]
        }


        const response_parameters = {
            methodResponses: [
                {
                    // Successful response from the integration
                    statusCode: '200',
                    // Define what parameters
                    responseParameters: corsHeaders
                },
                {
                    // Same thing for the error responses
                    statusCode: '400',
                    responseParameters: corsHeaders
                }
            ]
        }

        // For endpoints behind the Cognito authorizer: pass the JSON body through field by field
        // and add the caller's verified claims as `auth` (read them with lambda/auth.ts).
        // passthroughBehavior NEVER rejects non-JSON requests, so a client cannot skip this
        // template and forge its own `auth` field.
        const authed_request_template = `#set($body = $input.path('$'))
{
#if($body.keySet())
#foreach($key in $body.keySet())
#if($key != "auth")
  "$util.escapeJavaScript($key)": $input.json("$['$key']"),
#end
#end
#end
  "auth": {
    "sub": "$util.escapeJavaScript($context.authorizer.claims.sub)",
    "username": "$util.escapeJavaScript($context.authorizer.claims['cognito:username'])",
    "email": "$util.escapeJavaScript($context.authorizer.claims.email)",
    "groups": "$util.escapeJavaScript($context.authorizer.claims['cognito:groups'])"
  }
}`
        const authed_integration_parameters = {
            ...integration_parameters,
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: { 'application/json': authed_request_template },
        }
        const authed_response_parameters = {
            ...response_parameters,
            authorizer: authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        }

        // Path parameter specific configurations - use proxy integration for path parameters
        const path_parameter_integration = {
            proxy: true
        }

        const path_response_parameters = {
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: corsHeaders
                },
                {
                    statusCode: '400',
                    responseParameters: corsHeaders
                }
            ]
        }

        // Add a POST method to the '/organization/showDashboard' resource
        const show_dashboard_org_fn = this.makeFunction('ShowDashboardOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'showDashboard.ts'))
        showDashOrgResource.addMethod('POST', new apigw.LambdaIntegration(show_dashboard_org_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/addCategory' resource
        const add_category_fn = this.makeFunction('AddCategoryFunction', path.join(__dirname, '..', 'lambda', 'organization', 'addCategory.ts'))
        addCategoryResource.addMethod('POST', new apigw.LambdaIntegration(add_category_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/removeCategory' resource
        const remove_category_fn = this.makeFunction('RemoveCategoryFunction', path.join(__dirname, '..', 'lambda', 'organization', 'removeCategory.ts'))
        removeCategoryResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/uploadCategoryItems' resource
        const upload_category_items_fn = this.makeFunction('UploadCategoryItemsFunction', path.join(__dirname, '..', 'lambda', 'organization', 'uploadCategoryItems.ts'))
        uploadCategoryItemsResource.addMethod('POST', new apigw.LambdaIntegration(upload_category_items_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/removeCategoryItem' resource
        const remove_category_item_fn = this.makeFunction('RemoveCategoryItemFunction', path.join(__dirname, '..', 'lambda', 'organization', 'removeCategoryItem.ts'))
        removeCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_item_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/editCategoryItem' resource
        const edit_category_item_fn = this.makeFunction('EditCategoryItemFunction', path.join(__dirname, '..', 'lambda', 'organization', 'editCategoryItem.ts'))
        editCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(edit_category_item_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/organization/listDonationCenters' resource
        const list_donation_centers_org_fn = this.makeFunction('ListDonationCentersOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'listDonationCenters.ts'))
        listDonationCentersOrgResource.addMethod('POST', new apigw.LambdaIntegration(list_donation_centers_org_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/register' resource
        const register_dc_fn = this.makeFunction('RegisterDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'register.ts'))
        registerDCResource.addMethod('POST', new apigw.LambdaIntegration(register_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/remove' resource
        const remove_dc_fn = this.makeFunction('RemoveDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'remove.ts'))
        removeDCResource.addMethod('POST', new apigw.LambdaIntegration(remove_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/showDashboard' resource
        const show_dashboard_dc_fn = this.makeFunction('ShowDashboardDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'showDashboard.ts'))
        showDashDCResource.addMethod('POST', new apigw.LambdaIntegration(show_dashboard_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/listInventory' resource
        const list_inventory_dc_fn = this.makeFunction('ListInventoryDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'listInventory.ts'))
        listInventoryDCResource.addMethod('POST', new apigw.LambdaIntegration(list_inventory_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/addWishlistItem' resource
        const add_wishlist_item_dc_fn = this.makeFunction('AddWishlistItemDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'addWishlistItem.ts'))
        addWishlistItemDCResource.addMethod('POST', new apigw.LambdaIntegration(add_wishlist_item_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donationCenter/removeWishlistItem' resource
        const remove_wishlist_item_dc_fn = this.makeFunction('RemoveWishlistItemDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'removeWishlistItem.ts'))
        removeWishlistItemDCResource.addMethod('POST', new apigw.LambdaIntegration(remove_wishlist_item_dc_fn, authed_integration_parameters), authed_response_parameters)

        // Add a POST method to the '/donor/listDonationCenters' resource
        const list_dc_donor_fn = this.makeFunction('ListDCDonorFunction', path.join(__dirname, '..', 'lambda', 'donor', 'listDonationCenters.ts'))
        listDCDonorResource.addMethod('POST', new apigw.LambdaIntegration(list_dc_donor_fn, integration_parameters), response_parameters)

        // Values the frontend needs (copy into frontend/.env.local)
        new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
        new cdk.CfnOutput(this, 'Region', { value: this.region })
        new cdk.CfnOutput(this, 'ApiUrl', { value: api_endpoint.url })
    }

}
