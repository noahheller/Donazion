import { requireRole } from '../auth'
import { createPool, type RowDataPacket } from 'mysql2/promise'

const pool = createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
  connectionLimit: 2,
});

type CenterRow = RowDataPacket & {
  name: string
  lat: number
  lon: number
  address: string
  zipCode: string
};

type OrganizationDonationCenterRow = CenterRow & {
  items: number | string
  inventoryValue: number
};

function mapCenter(row: CenterRow) {
  return {
    name: row.name,
    location: {
      lat: Number(row.lat),
      lon: Number(row.lon),
      address: row.address,
      zipCode: row.zipCode
      },
  };
}

const centersColumn = 'dc.name, dc.lat, dc.lon, dc.address, dc.zip_code AS zipCode'

export const handler = async (event: any) => {
  const auth = requireRole(event, 'Organization')

  try{
  const [rows] = await pool.execute<OrganizationDonationCenterRow[]>(
    `SELECT ${centersColumn},
           COALESCE(inv.items, 0) AS items,
           COALESCE(inv.inventoryValue, 0) AS inventoryValue
    FROM DonationCenters dc
    LEFT JOIN (
      SELECT dc_name, COUNT(*) AS items, SUM(price) AS inventoryValue
      FROM Items
      GROUP BY dc_name
    ) inv ON inv.dc_name = dc.name
    ORDER BY dc.name`
  );

  return {
    donationCenters:rows.map((row) => ({
      name: row.name,
      location: {
        lat: Number(row.lat),
        lon: Number(row.lon),
        address: row.address,
        zipCode: row.zipCode
      },
      items: row.items,
      inventoryValue: row.inventoryValue,
    })),
  }

}
  catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error) //store error message
        console.error('organization/listDonationCenters:', message)
        throw new Error('Unable to load donation centers')
    }
}
