import {createPool, type RowDataPacket } from "mysql2/promise";

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

function mapCenter(row: CenterRow) {
  return {
    name: row.name,
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: row.address,
      zipCode: row.zipCode
    }
  };
}

const centersColumn = 'dc.name, dc.lat, dc.\`long\` AS lon, dc.address, dc.zip_code AS zipCode'

export const handler = async (event: unknown) => {
  const [rows] = await pool.execute<CenterRow[]>(
    `SELECT ${centersColumn}
    FROM DonationCenters dc
    ORDER BY dc.name`
  );

  return {
    donationCenters: rows.map(mapCenter),
  }
}
