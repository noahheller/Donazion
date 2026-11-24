import {  requireRole } from '../auth'
import { createPool, type RowDataPacket } from "mysql2/promise";

const pool = createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
  connectionLimit: 2,
});

type CategoryItem = {
  name: string
  lowPrice: number
  highPrice: number
}

type CategoryList = {
  name: string
  items: CategoryItem[]
}

type DashboardRow = RowDataPacket & {
  totalCenters: number | string;
  categoryName: string | null;
  itemName: string | null;
  lowPrice: number | null;
  highPrice: number | null;
}

export const handler = async (event: unknown) => {
  const auth = requireRole(event, 'Organization')
  try{
    const [rows] = await pool.execute<DashboardRow[]>(
      `SELECT totals.totalCenters, c.name AS categoryName,
             ci.name AS itemName, ci.lowPrice, ci.highPrice
      FROM (SELECT COUNT(*) AS totalCenters FROM DonationCenters) AS totals
      LEFT JOIN Category c ON 1 = 1
      LEFT JOIN CategoryItems ci ON ci.category = c.name
      ORDER BY c.name, ci.name`
    );
    const categories = new Map<string, CategoryList>();
    for (const row of rows) {
      if(row.categoryName === null) continue;

      let category = categories.get(row.categoryName);
      if (!category) {
        category = { name: row.categoryName, items: [] };
        categories.set(row.categoryName, category);
      }
      if (row.itemName !== null && row.itemName !== "") {
        category.items.push({
          name: row.itemName,
          lowPrice: Number(row.lowPrice) || 0,
          highPrice: Number(row.highPrice) || 0
        });
      }
    }
    return {
      username: auth.username,
      "total centers": Number(rows[0]?.totalCenters) || 0,
      categories: [...categories.values()],
    }
  }
     catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error) //store error message

        console.error('organization/showDashboard:', message)

        throw new Error('Unable to load Organization Dashboard')
    }
}
