import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Duration } from 'aws-cdk-lib'
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DonazionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
      vpcId: 'vpc-0dace1116aca7de00',                                                                         // Replace with your VPC ID
      availabilityZones: ['us-east-2b', 'us-east-2a', 'us-east-2c'],                                          // Must match the order of privateSubnetIds
      privateSubnetIds: ['subnet-0aa25cae95f4cc0af', 'subnet-079698e83ac7dca2c', 'subnet-07bb51b538ee6a9f3'], // Replace with your private subnet IDs
    })

    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-00c987594d9a6fbfa', {             // Find your security group
      mutable: false
    })

    // NOTE: You First have to add RDS_USER and RDS_PASSWORD to
    // your environment variables for your account. Same with RDS_DATABASE and RDS_HOST
    const rdsUser = process.env.RDS_USER!
    const rdsPassword = process.env.RDS_PASSWORD!
    const rdsDatabase = process.env.RDS_DATABASE!
    const rdsHost = process.env.RDS_HOST!

    // generic default handler for any API function that doesn't get its own Lambda method
    const default_fn = new lambdaNodejs.NodejsFunction(this, 'LambdaDefaultFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'default.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
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
          responseParameters: {
            'method.response.header.Content-Type': "'application/json'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          },
        },
        {
          // For errors, we check if the error message is not empty, get the error data
          selectionPattern: '(\n|.)+',
          statusCode: "400",
          responseTemplates: {
            'application/json': JSON.stringify({ state: 'error', message: "$util.escapeJavaScript($input.path('$.errorMessage'))" })
          },
          responseParameters: {
            'method.response.header.Content-Type': "'application/json'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          },
        }
      ]
    }


    const response_parameters = {
      methodResponses: [
        {
          // Successful response from the integration
          statusCode: '200',
          // Define what parameters
          responseParameters: {
            'method.response.header.Content-Type': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          },

        },
        {
          // Same thing for the error responses
          statusCode: '400',
          responseParameters: {
            'method.response.header.Content-Type': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          },

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
          responseParameters: {
            'method.response.header.Content-Type': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Content-Type': true,
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        }
      ]
    }

    // Add a POST method to the '/organization/login' resource
    const login_org_fn = new lambdaNodejs.NodejsFunction(this, 'LoginOrgFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'login.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    loginOrgResource.addMethod('POST', new apigw.LambdaIntegration(login_org_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/changePassword' resource
    const change_password_org_fn = new lambdaNodejs.NodejsFunction(this, 'ChangePasswordOrgFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'changePassword.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    changePasswordOrgResource.addMethod('POST', new apigw.LambdaIntegration(change_password_org_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/showDashboard' resource
    const show_dashboard_org_fn = new lambdaNodejs.NodejsFunction(this, 'ShowDashboardOrgFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'showDashboard.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    showDashOrgResource.addMethod('POST', new apigw.LambdaIntegration(show_dashboard_org_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/addCategory' resource
    const add_category_fn = new lambdaNodejs.NodejsFunction(this, 'AddCategoryFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'addCategory.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    addCategoryResource.addMethod('POST', new apigw.LambdaIntegration(add_category_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/removeCategory' resource
    const remove_category_fn = new lambdaNodejs.NodejsFunction(this, 'RemoveCategoryFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'removeCategory.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    removeCategoryResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/uploadCategoryItems' resource
    const upload_category_items_fn = new lambdaNodejs.NodejsFunction(this, 'UploadCategoryItemsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'uploadCategoryItems.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    uploadCategoryItemsResource.addMethod('POST', new apigw.LambdaIntegration(upload_category_items_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/removeCategoryItem' resource
    const remove_category_item_fn = new lambdaNodejs.NodejsFunction(this, 'RemoveCategoryItemFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'removeCategoryItem.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    removeCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(remove_category_item_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/editCategoryItem' resource
    const edit_category_item_fn = new lambdaNodejs.NodejsFunction(this, 'EditCategoryItemFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'editCategoryItem.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    editCategoryItemResource.addMethod('POST', new apigw.LambdaIntegration(edit_category_item_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/organization/listDonationCenters' resource
    const list_donation_centers_org_fn = new lambdaNodejs.NodejsFunction(this, 'ListDonationCentersOrgFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'lambda', 'organization', 'listDonationCenters.ts'),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: rdsUser,
        RDS_PASSWORD: rdsPassword,
        RDS_DATABASE: rdsDatabase,
        RDS_HOST: rdsHost
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    listDonationCentersOrgResource.addMethod('POST', new apigw.LambdaIntegration(list_donation_centers_org_fn, integration_parameters), response_parameters)
  }
}
