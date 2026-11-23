import {createPool, type RowDataPacket } from "mysql2/promise";

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

function mapCenter(row: CenterRow) {
  return {
    name: row.name,
    location: {
      lat: Number(row.lat),
      lon: Number(row.lon),
      address: row.address,
      zipCode: row.zipCode
    }
  };
}

const centersColumn = 'dc.name, dc.lat, dc.lon, dc.address, dc.zip_code AS zipCode'

export const handler = async (event: unknown) => {

  try{
  const [rows] = await pool.execute<CenterRow[]>(
    `SELECT ${centersColumn}
    FROM DonationCenters dc
    ORDER BY dc.name`
  );

  return {
    donationCenters: rows.map(mapCenter),
  }
}
  catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error) //store error message
        console.error('donor/listDonationCenters:', message)

        throw new Error('Unable to load donation centers')
    }
  }
