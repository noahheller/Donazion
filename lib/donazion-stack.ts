import * as cdk from 'aws-cdk-lib'
import {Construct} from 'constructs'
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import {Duration} from 'aws-cdk-lib'

// import * as sqs from 'aws-cdk-lib/aws-sqs';

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

        // Create a resource (e.g., '/organization')
        const orgResource = api_endpoint.root.addResource('organization')
        const loginOrgResource = orgResource.addResource('login')
        const changePasswordOrgResource = orgResource.addResource('changePassword')
        const showDashOrgResource = orgResource.addResource('showDashboard')
        const addCategoryResource = orgResource.addResource('addCategory')
        const removeCategoryResource = orgResource.addResource('removeCategory')
        const uploadCategoryItemsResource = orgResource.addResource('uploadCategoryItems')
        const removeCategoryItemResource = orgResource.addResource('removeCategoryItem')
        const editCategoryItemResource = orgResource.addResource('editCategoryItem')
        const listDonationCentersOrgResource = orgResource.addResource('listDonationCenters')

        const dcResource = api_endpoint.root.addResource('donationCenter')
        const loginDCResource = dcResource.addResource('login')
        const registerDCResource = dcResource.addResource('register')
        const removeDCResource = dcResource.addResource('remove')

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

        // Add a POST method to the '/organization/login' resource
        const login_org_fn = this.makeFunction('LoginOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'login.ts'))
        loginOrgResource.addMethod('POST', new apigw.LambdaIntegration(login_org_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/changePassword' resource
        const change_password_org_fn = this.makeFunction('ChangePasswordOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'changePassword.ts'))
        changePasswordOrgResource.addMethod('POST', new apigw.LambdaIntegration(change_password_org_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/showDashboard' resource
        const show_dashboard_org_fn = this.makeFunction('ShowDashboardOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'showDashboard.ts'))
        showDashOrgResource.addMethod('POST', new apigw.LambdaIntegration(show_dashboard_org_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/addCategory' resource
        const add_category_fn = this.makeFunction('AddCategoryFunction', path.join(__dirname, '..', 'lambda', 'organization', 'addCategory.ts'))
        addCategoryResource.addMethod('POST', new apigw.LambdaIntegration(add_category_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/removeCategory' resource
        const remove_category_fn = this.makeFunction('RemoveCategoryFunction', path.join(__dirname, '..', 'lambda', 'organization', 'removeCategory.ts'))
        removeCategoryResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/uploadCategoryItems' resource
        const upload_category_items_fn = this.makeFunction('UploadCategoryItemsFunction', path.join(__dirname, '..', 'lambda', 'organization', 'uploadCategoryItems.ts'))
        uploadCategoryItemsResource.addMethod('POST', new apigw.LambdaIntegration(upload_category_items_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/removeCategoryItem' resource
        const remove_category_item_fn = this.makeFunction('RemoveCategoryItemFunction', path.join(__dirname, '..', 'lambda', 'organization', 'removeCategoryItem.ts'))
        removeCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_item_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/editCategoryItem' resource
        const edit_category_item_fn = this.makeFunction('EditCategoryItemFunction', path.join(__dirname, '..', 'lambda', 'organization', 'editCategoryItem.ts'))
        editCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(edit_category_item_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/organization/listDonationCenters' resource
        const list_donation_centers_org_fn = this.makeFunction('ListDonationCentersOrgFunction', path.join(__dirname, '..', 'lambda', 'organization', 'listDonationCenters.ts'))
        listDonationCentersOrgResource.addMethod('POST', new apigw.LambdaIntegration(list_donation_centers_org_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/donationCenter/login' resource
        const login_dc_fn = this.makeFunction('LoginDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'login.ts'))
        loginDCResource.addMethod('POST', new apigw.LambdaIntegration(login_dc_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/donationCenter/register' resource
        const register_dc_fn = this.makeFunction('RegisterDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'register.ts'))
        registerDCResource.addMethod('POST', new apigw.LambdaIntegration(register_dc_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/donationCenter/remove' resource
        const remove_dc_fn = this.makeFunction('RemoveDCFunction', path.join(__dirname, '..', 'lambda', 'donationCenter', 'remove.ts'))
        removeDCResource.addMethod('POST', new apigw.LambdaIntegration(remove_dc_fn, integration_parameters), response_parameters)

        // Add a POST method to the '/donor/listDonationCenters' resource
        const list_dc_donor_fn = this.makeFunction('ListDCDonorFunction', path.join(__dirname, '..', 'lambda', 'donor', 'listDonationCenters.ts'))
        listDCDonorResource.addMethod('POST', new apigw.LambdaIntegration(list_dc_donor_fn, integration_parameters), response_parameters)

    }

}
