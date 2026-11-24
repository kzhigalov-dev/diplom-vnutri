import {readFile, stat} from 'node:fs/promises';
import {readSheet} from 'read-excel-file/node';
import {openRoomsDatabase} from './db.mjs';
import {mapRoomNumbers, readRoomInventory} from './inventory.mjs';

const [source] = process.argv.slice(2);
if (!source) throw new Error('Передайте локальный путь к файлу .xlsx.');
if ((await stat(source)).size > 2 * 1024 * 1024) throw new Error('Файл превышает 2 МБ.');

const load = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [sheet, geometry, spaces, schema] = await Promise.all([
  readSheet(source, 'Аудиторный фонд'),
  load('../../public/data/floor-geometry.json').then(JSON.parse),
  load('../../public/data/floor-spaces.json').then(JSON.parse),
  load('./schema.sql'),
]);
const {rooms, withoutNumber} = readRoomInventory(sheet, mapRoomNumbers(geometry, spaces));

const pool = openRoomsDatabase();
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    const {rowCount} = await client.query(`
      INSERT INTO campus.rooms
        (building_id, number, space_id, purposes, capacity, computer_count, computer_count_source)
      SELECT 'voznesensky', "number", "spaceId", purposes, capacity, "computerCount", "computerCountSource"
      FROM jsonb_to_recordset($1::jsonb) AS r("number" text, "spaceId" text, purposes text[],
        capacity integer, "computerCount" integer, "computerCountSource" text)
      ON CONFLICT (building_id, number) DO NOTHING`, [JSON.stringify(rooms)]);
    await client.query('COMMIT');
    console.log(`Добавлено: ${rowCount}. Уже в базе: ${rooms.length - rowCount}. Строк без номера: ${withoutNumber}.`);
    console.log(`Точные совпадения номеров с навигационными панелями: ${rooms.filter((room) => room.spaceId).length}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Импорт отменён (${error.code ?? 'ошибка базы'}).`);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
