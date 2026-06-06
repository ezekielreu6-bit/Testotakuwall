import { NextResponse } from 'next/server';
import { Client } from 'pg'; // Your Postgres driver

export async function GET(request: Request) {
  const client = new Client({ connectionString: process.env.SPARKDB_URL });
  await client.connect();
  const result = await client.query('SELECT * FROM wallpapers WHERE file_type = $1', ['video']);
  await client.end();
  return NextResponse.json(result.rows);
}