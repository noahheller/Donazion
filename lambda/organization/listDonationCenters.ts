import { requireRole } from '../auth'
import { createPool, type RowDataPacket } from 'mysql2/promise'

const pool = createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
  port: Number(process.env.RDS_PORT ?? "3306"),
  ssl: { rejectUnauthorized: true, verifyIdentity: true },
  connectTimeout: 2000,
  connectionLimit: 2,
});

type CenterRow = RowDataPacket & {
  name: string
  lat: number
  lng: number
  address: string
  zipCode: string
};

type OrganizationDonationCenterRow = CenterRow & {
  items: number | string
  inventoryValue: number | string
};

function mapCenter(row: CenterRow) {
  return {
    name: row.name,
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: row.address,
      zipCode: row.zipCode
      },
  };
}

const centersColumn = 'dc.name, dc.lat, dc.\`long\` AS lon, dc.address, dc.zip_code AS zipCode'

export const handler = async (event: any) => {
  const auth = requireRole(event, 'Organization')

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
    ORDER BY dc.name`,
    [auth.username]
  );

  return {
    donationCenters:rows.map((row) => ({
      name: row.name,
      location: {
        lat: Number(row.lat),
        lng: Number(row.lng),
        address: row.address,
        zipCode: row.zipCode
      },
      items: row.items,
      inventoryValue: row.inventoryValue,
    })),
  }

}
