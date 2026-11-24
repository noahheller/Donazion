import {requireRole} from '../auth'
import mysql, {ResultSetHeader} from 'mysql2/promise'

const pool = mysql.createPool({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    waitForConnections: true,
    connectionLimit: 2,
})

export const handler = async (event: any) => { // The main handler function for the Lambda function
    let code
    let result
    try {
        requireRole(event, 'Organization')
        const name = event.name
        if (!name) {
            throw new Error("Missing Category Item name")
        }

        // mysql2/promise: query returns a promise, it does NOT take a callback
        const [deleteResult] = await pool.query<ResultSetHeader>(
            "DELETE FROM CategoryItems WHERE name = ?", [name])

        if (deleteResult.affectedRows === 0) {
            throw new Error("No Category items exist with that name")
        }
        code = 200
        result = `Successfully deleted Category Item with name: ${name}`
    } catch (error) {
        result = {error: error instanceof Error ? error.message : String(error)}
        code = 400
    }

    return {
        statusCode: code,
        body: JSON.stringify(result),
    }
}
