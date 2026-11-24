import mysql from 'mysql2'
import { RowDataPacket } from 'mysql2/promise'
import { requireRole } from '../auth'

interface RequestPayload {
    name: string
}

interface ResponsePayload {
  statusCode: number,        // always exists
  message? : string, 
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



export const handler = async (event: any) => {
  // Caller verified by the Cognito authorizer. Use auth.username / auth.sub 
  const auth = requireRole(event, 'Organization')

  // assume this will fail until proven that it will succeed.
  let response:ResponsePayload = { statusCode: 400 }

  // Get all Category names
  interface CategoryRow extends RowDataPacket {
      name: string
  }

  // function that checks if category exists
  const checkCategoryExists = (name:string) => {
    return new Promise((resolve, reject) => {

        const selectQuery = "SELECT name from calc.Category where name=?"

        pool.query<CategoryRow[]>(selectQuery, [name], (error, rows) => {
            if (error) {
                reject(new Error("Database error: " + error.message))
            } else {
                resolve(rows.length === 1)
            }
        })
    })
  }

  // function that will remove category
  const removeCategory = (name:string) => {
    return new Promise((resolve, reject) => {
        const deleteQuery = "DELETE FROM calc.Category WHERE name=?"

        pool.query(deleteQuery, [name], (error, deleteQuery) => {
            if (error) {
                reject(new Error("Database error: " + error.message))
            } else {
                resolve(deleteQuery)
            }
        })
    })
  }

  try {
        const catName = event.name
        if (catName !== undefined) {
            if (catName === "") {
                throw new Error ("empty donation center name in name field")
            }

            const cognito_sub = auth.sub

            const exists  = await checkCategoryExists(catName)    // validate DC does not exist
            if (!exists) {
                response.error = "Category does not exist"
                return response
            }

            const added = await removeCategory(catName)

            response.statusCode = 200                  // success!
            response.message = "successfully deleted"
        } else {
            throw new Error ("missing Category Name field") 
        }
    } catch (error) {
        response.error = error instanceof Error ? error.message : String(error) // store error's message whether it is Error object or string/object
    }

    return response

  // TODO: implement removeCategory
  // throw new Error('removeCategory is not implemented yet')
}
