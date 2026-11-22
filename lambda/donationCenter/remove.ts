import mysql from 'mysql2'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import {
    CognitoIdentityProviderClient,
    AdminDeleteUserCommand,
    UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import { requireRole } from '../auth'

// define OUTSIDE so it is reused between invocations
const pool = mysql.createPool({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    connectionLimit: 2, // keep small per lambda container
})

interface DCRow extends RowDataPacket {
    name: string
    lat: number
    lon: number
    address: string
    zip_code: string
}

export const handler = async (event: any) => {
    let result
    let code

    try {
        const auth = requireRole(event, 'DonationCenter')

        const deleteDonationCenter = () => {
            return new Promise<number>((resolve, reject) => {
                const deleteQuery = "DELETE FROM calc.DonationCenters WHERE cognito_sub = ?"
                pool.query<ResultSetHeader>(deleteQuery, [auth.sub], (error, deleteResult) => {
                    if (error) {
                        reject(new Error("Database error: " + error.message))
                    } else {
                        resolve(deleteResult.affectedRows)
                    }
                })
            })
        }

        // List the donation centers that are left
        const listDonationCenters = () => {
            return new Promise<DCRow[]>((resolve, reject) => {
                const listQuery = "SELECT name, lat, lon, address, zip_code FROM calc.DonationCenters ORDER BY name"
                pool.query<DCRow[]>(listQuery, (error, rows) => {
                    if (error) {
                        reject(new Error("Database error: " + error.message))
                    } else {
                        resolve(rows)
                    }
                })
            })
        }

        const deleted = await deleteDonationCenter()
        if (deleted === 0) {
            throw new Error("No donation center is registered for this account")
        }

        const rows = await listDonationCenters()
        result = {
            donationCenters: rows.map(r => ({
                name: r.name,
                location: { lat: r.lat, lon: r.lon, address: r.address, zipCode: r.zip_code },
            })),
        }
        code = 200

    } catch (error) {
        result = { error: error instanceof Error ? error.message : String(error) }
        code = 400
    }

    const response = {
        statusCode: code,
        body: JSON.stringify(result),
    }

    return response
}
