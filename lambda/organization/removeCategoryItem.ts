import {requireRole} from '../auth'
import mysql, {PoolConnection, RowDataPacket} from 'mysql2/promise'

const pool = mysql.createPool({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    waitForConnections: true,
    connectionLimit: 2,
})
export const handler = async (event: unknown) => { // The main handler function for the Lambda function
    let code
    let result
    try {
        requireRole(event, 'Organization')
        const deleteCategoryItem = () => {
            return new Promise<number>((resolve, reject) => {
                const deleteQuery = "DELETE FROM CategoryItems WHERE name = ?"
                pool.query<ResultSetHeader>(deleteQuery, [event.name], (error, deleteResult) => {
                    if (error) {
                        reject(new Error("Database error: " + error.message))
                    } else {
                        resolve(deleteResult.affectedRows)
                    }
                })
            })
        }
        const del = await deleteCategoryItem();
        if (deleted === 0) {
            throw new Error("No Category items exist with that name")
        }
        code = 200
        result = `Successfully deleted Category Item with name: ${name}`
    } catch (error) {
        result = {error: error instanceof Error ? error.message : String(error)}
        code = 400
    }

    const response = {
        statusCode: code,
        body: JSON.stringify(result),
    }
    return response;
}