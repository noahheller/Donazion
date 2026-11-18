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
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],                                          // Replace with your AZs
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
      handler: 'default.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'default')),
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
   // TODO: create the functions that are run under these resources.

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

    // Add a POST method to the '/calc/add' resource
    const add_fn = new lambdaNodejs.NodejsFunction(this, 'AddFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'add.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'add')),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: process.env.RDS_USER!,
        RDS_PASSWORD: process.env.RDS_PASSWORD!,
        RDS_DATABASE: process.env.RDS_DATABASE!,
        RDS_HOST: process.env.RDS_HOST!
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })

    addResource.addMethod('POST', new apigw.LambdaIntegration(add_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/calc/mult' resource
    const multiply_fn = new lambdaNodejs.NodejsFunction(this, 'MultiplyFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'mult.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'mult')),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: process.env.RDS_USER!,
        RDS_PASSWORD: process.env.RDS_PASSWORD!,
        RDS_DATABASE: process.env.RDS_DATABASE!,
        RDS_HOST: process.env.RDS_HOST!
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    multResource.addMethod('POST', new apigw.LambdaIntegration(multiply_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/calc/create-constant' resource
    const create_constant_fn = new lambdaNodejs.NodejsFunction(this, 'CreateConstantFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'create-constant.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'create-constant')),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: process.env.RDS_USER!,
        RDS_PASSWORD: process.env.RDS_PASSWORD!,
        RDS_DATABASE: process.env.RDS_DATABASE!,
        RDS_HOST: process.env.RDS_HOST!
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    createConstantResource.addMethod('POST', new apigw.LambdaIntegration(create_constant_fn, integration_parameters), response_parameters)

    // Add a GET method to the '/calc/list-constants' resource
    const list_constants_fn = new lambdaNodejs.NodejsFunction(this, 'ListConstantsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'list-constants.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'list-constants')),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: process.env.RDS_USER!,
        RDS_PASSWORD: process.env.RDS_PASSWORD!,
        RDS_DATABASE: process.env.RDS_DATABASE!,
        RDS_HOST: process.env.RDS_HOST!
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })
    listConstantsResource.addMethod('GET', new apigw.LambdaIntegration(list_constants_fn, integration_parameters), response_parameters)

    // Add a POST method to the '/calc/delete-constant' resource
    const delete_constant_fn = new lambdaNodejs.NodejsFunction(this, 'DeleteConstantFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'delete-constant.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'delete-constant')),
      vpc: vpc,                                                             // Reference the VPC defined above
      environment: {
        // Define your environment variables here
        RDS_USER: process.env.RDS_USER!,
        RDS_PASSWORD: process.env.RDS_PASSWORD!,
        RDS_DATABASE: process.env.RDS_DATABASE!,
        RDS_HOST: process.env.RDS_HOST!
      },
      securityGroups: [securityGroup],                                      // Associate the security group
      timeout: Duration.seconds(3),                                         // Example timeout, adjust as needed
    })

    // Note: you don't have to have BOTH. I just showed how it is possible to reuse the same lambda function
    // with two different access points (either POST or DELETE)
    deleteConstantResource.addMethod('POST', new apigw.LambdaIntegration(delete_constant_fn, integration_parameters), response_parameters)

    // Add a DELETE method to the '/calc/delete-constant/{name}' resource (path parameter)
    // This works BUT CLIENT BROWSER still experiences a CORS error -- not sure why
    deleteConstantWithNameResource.addMethod('DELETE', new apigw.LambdaIntegration(delete_constant_fn, path_parameter_integration), path_response_parameters)
  }
}

