// import { Location } from 'aws-cdk-lib/aws-s3'
import mysql from 'mysql2'
import { RowDataPacket } from 'mysql2/promise'
import { requireRole } from '../auth'

/**
 * Register DonationCenter use case
 * 
 * If DonationCenter exists, return 400 error
 * Otherwise, register donation center and return security credentials -- NEED TO IMPLEMENT.
 */

/**
 * Incoming JSON payload:
 * 
 {
   "name": "Newport",
   "location": {
       "address": "115 King Street, Township, NY",
       "zipCode": "97365",
       "lat": 43.5081,
       "lon": -124.0299
     },
     "cognito_sub": "fill in later!!!"
}
 */
interface Location {
    address: string,
    zipCode: string,
    lat: number,
    lon: number
}

interface CategoryItem {
    name: string,
    lowPrice: number,
    highPrice: number
}

interface Item {
    name: string,
    price: number,
    categoryItem: CategoryItem
}

interface RequestPayload {
    name: string,
    location: Location
}

/**
 * Outgoing JSON payload: // FIX THIS!!
 * 
 * { "statusCode" : 200 | 400,
 *   on success:
 *      will have "credentials" : "securityCredentials"
 *   on failure:
 *      will have "error" : "e" on failure
 * }
 */

interface ResponsePayload {
  statusCode: number,        // always exists
  credentials? : string, // NEED TO IMPLEMENT
  error?: string
}

// specify credentials. Created OUTSIDE handler, so it can be reused 
const pool = mysql.createPool({
    host: 	process.env.RDS_HOST!,
    user: 	process.env.RDS_USER!,
    password: process.env.RDS_PASSWORD!,
    database: process.env.RDS_DATABASE!,
    connectionLimit: 2, // keep small per lambda container
})

export const handler = async (event: RequestPayload): Promise<any> => {

    const auth = requireRole(event, 'DonationCenter')

    const isLocation = (loc: any): loc is Location => {
        return (
            loc !== undefined &&
            loc.address !== "" &&
            loc.zipCode !== "" && loc.zipCode.length == 5 &&
            typeof loc.lat === "number" && loc.lat >= -90 && loc.lat <= 90 &&
            typeof loc.lon === "number" && loc.lat >= -180 && loc.lat <= 180
        );
    }

    // assume this will fail until proven that it will succeed.
    let response:ResponsePayload = { statusCode: 400 }

    // Get all Donation Center names
    interface DCRow extends RowDataPacket {
        name: string
    }

    // function that checks if donation center does not exist
    const checkDCDoesNotExist = (name:string) => {
        return new Promise((resolve, reject) => {

            const selectQuery = "SELECT name from calc.DonationCenters where name=?"

            pool.query<DCRow[]>(selectQuery, [name], (error, rows) => {
                if (error) {
                    reject(new Error("Database error: " + error.message))
                } else {
                    resolve(rows.length === 0)
                }
            })
        })
    }

    // function that will add donation center
    const addDC = (name:string, lat:number, lon:number, address:string, zipCode:string, cognito_sub:string) => {
        return new Promise((resolve, reject) => {
            const insertQuery = "INSERT INTO calc.DonationCenters (name, lat, lon, address, zip_code, cognito_sub) VALUES (?, ?, ?, ?, ?, ?)"

            pool.query(insertQuery, [name, lat, lon, address, zipCode, cognito_sub], (error, insertResult) => {
                if (error) {
                    reject(new Error("Database error: " + error.message))
                } else {
                    resolve(insertResult)
                }
            })
        })
    }
    
    try {
        const dcName = event.name
        if (dcName !== undefined) {
            if (dcName === "") {
                throw new Error ("empty donation center name in name field")
            }

            const location = event.location 
            const cognito_sub = auth.sub

            if (!isLocation(location)) {
                throw new Error ("invalid location")
            }

            const dne  = await checkDCDoesNotExist(dcName)    // validate ToDo list exists
            if (!dne) {
                response.error = "Donation Center already exists"
                return response
            }

            const added = await addDC(dcName, location.lat, location.lon, location.address, location.zipCode, cognito_sub) // WHY ARE WE EVEN TAKING IN INVENTORY AND WISHLIST

            response.statusCode = 200                  // success!
            response.credentials = "securityCredentials"
        } else {
            throw new Error ("missing Donation Center Name field") 
        }
    } catch (error) {
        // WHAT IS THE POINT OF THROWING OTHER ERROS
        //response.error = `error: ${JSON.stringify(event)}`  // pass back the actual event that caused problem in first place. 
        response.error = error instanceof Error ? error.message : String(error)
    }

    return response

} 