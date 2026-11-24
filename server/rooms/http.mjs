import {openRoomsDatabase} from './db.mjs';
import {createRoomsApp} from './app.mjs';

const pool = openRoomsDatabase();
pool.on('error', () => console.error('PostgreSQL connection lost.'));

const app = await createRoomsApp({pool});
app.addHook('onClose', () => pool.end());

try {
  await pool.query('SELECT 1 FROM campus.rooms LIMIT 1');
  const address = await app.listen({port: Number(process.env.ROOMS_PORT || 4183), host: '127.0.0.1'});
  console.log(`Room catalog and campus map available at ${address}/`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void app.close());
} catch {
  await app.close();
  console.error('Could not start the local room catalog. Check PostgreSQL, the import, and the HTTP port.');
  process.exitCode = 1;
}
