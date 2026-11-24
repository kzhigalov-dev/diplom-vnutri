import pg from 'pg';

export function openRoomsDatabase() {
  if (!process.env.ROOMS_DB_PASSWORD && !process.env.ROOMS_DATABASE_URL) {
    throw new Error('Set ROOMS_DB_PASSWORD or ROOMS_DATABASE_URL.');
  }
  return new pg.Pool({
    ...(process.env.ROOMS_DATABASE_URL
      ? {connectionString: process.env.ROOMS_DATABASE_URL}
      : {
          host: '127.0.0.1',
          port: Number(process.env.ROOMS_DB_PORT || 55432),
          user: 'vnutri',
          password: process.env.ROOMS_DB_PASSWORD,
          database: 'vnutri_rooms',
        }),
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
}
