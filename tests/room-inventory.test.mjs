import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapRoomNumbers, normalizeRoomNumber, readRoomInventory} from '../server/rooms/inventory.mjs';

test('normalizeRoomNumber normalizes dashes, spaces, and Latin A/B suffixes', () => {
  assert.equal(normalizeRoomNumber('478a'), '478А');
  assert.equal(normalizeRoomNumber(' 290 – b '), '290В');
  assert.equal(normalizeRoomNumber('452-а'), '452А');
  assert.equal(normalizeRoomNumber(null), '');
});

test('mapRoomNumbers maps only unique wayfinding-panel rooms and ignores archive floors', () => {
  const geometry = JSON.parse(readFileSync(new URL('../public/data/floor-geometry.json', import.meta.url), 'utf8'));
  const spaces = JSON.parse(readFileSync(new URL('../public/data/floor-spaces.json', import.meta.url), 'utf8'));
  const mapped = mapRoomNumbers(geometry, spaces);
  assert.ok(mapped.get('452'));
  assert.ok(mapped.get('478'));
  assert.equal(mapped.get('П1.01'), undefined);

  const synthetic = mapRoomNumbers(
    {floors: [{floor: 1, sourceKind: 'archive'}, {floor: 4, sourceKind: 'wayfinding-panel'}]},
    {
      floors: [
        {floor: 1, spaces: [{id: 'f1-s1', label: '101'}]},
        {floor: 4, spaces: [{id: 'f4-s1', label: '452'}, {id: 'f4-s2', label: '459'}, {id: 'f4-s3', label: '459'}]},
      ],
    },
  );
  assert.equal(synthetic.get('101'), undefined);
  assert.equal(synthetic.get('452'), 'f4-s1');
  assert.equal(synthetic.get('459'), null);
});

test('readRoomInventory parses SPbGUTD capacity/PC formulas and filters Вознесенский rows', () => {
  const rows = [
    ['Адрес УЛК', '№ аудитории', 'Назначение аудитории (по паспорту)', 'Вместимость (по факту)', 'Примечание'],
    ['Большая Морская ул., 18', '101', 'аудитория', '30', ''],
    ['Вознесенский пр., 44-46', '', 'лаборатория', '10', 'без номера'],
    ['Вознесенский пр., 44-46', '452', 'лекционная', '60, ремонт', ''],
    ['Вознесенский пр., 44-46', '478', 'компьютерный класс, лаборатория', '15 комп. + 10 пос. мест', ''],
    ['Вознесенский пр., 44-46', '459', 'компьютерный класс', '10 мест без пк; 12 + 1 раб. место пк', ''],
    ['Вознесенский пр., 44-46', '462', 'компьютерный класс', '12 + 1 преп', ''],
    ['Вознесенский пр., 44-46', '466', 'компьютерный класс', '18 раб. место пк', ''],
    ['Вознесенский пр., 44-46', '290-b', 'лаборатория', 'фотостудия + 4 комп.', ''],
    ['Вознесенский пр., 44-46', '352', 'для практических занятий', '24', 'есть ~ 8 комп.'],
    ['Вознесенский пр., 44-46', '484', 'компьютерный класс', '20', ''],
  ];

  const {rooms, withoutNumber} = readRoomInventory(rows, new Map([['452', 'f4-s27'], ['478', 'f4-s10']]));
  assert.equal(withoutNumber, 1);
  assert.equal(rooms.length, 8);

  const byNum = new Map(rooms.map((room) => [room.number, room]));
  assert.deepEqual(byNum.get('452'), {
    number: '452', spaceId: 'f4-s27', purposes: ['lecture'], capacity: 60, computerCount: null, computerCountSource: null,
  });
  assert.deepEqual(byNum.get('478'), {
    number: '478', spaceId: 'f4-s10', purposes: ['computer', 'laboratory'], capacity: 25, computerCount: 15, computerCountSource: 'inventory',
  });
  assert.deepEqual(byNum.get('459'), {
    number: '459', spaceId: null, purposes: ['computer'], capacity: 23, computerCount: 13, computerCountSource: 'inventory',
  });
  assert.deepEqual(byNum.get('462'), {
    number: '462', spaceId: null, purposes: ['computer'], capacity: 13, computerCount: 13, computerCountSource: 'inventory',
  });
  assert.deepEqual(byNum.get('466'), {
    number: '466', spaceId: null, purposes: ['computer'], capacity: 18, computerCount: 18, computerCountSource: 'inventory',
  });
  assert.deepEqual(byNum.get('290В'), {
    number: '290В', spaceId: null, purposes: ['laboratory'], capacity: null, computerCount: 4, computerCountSource: 'inventory',
  });
  assert.deepEqual(byNum.get('352'), {
    number: '352', spaceId: null, purposes: ['practice'], capacity: 24, computerCount: 8, computerCountSource: 'estimate',
  });
  assert.deepEqual(byNum.get('484'), {
    number: '484', spaceId: null, purposes: ['computer'], capacity: 20, computerCount: 20, computerCountSource: 'estimate',
  });
});

test('readRoomInventory rejects missing headers, invalid rows, duplicates, and empty imports', () => {
  assert.throws(() => readRoomInventory([['Адрес УЛК', '№ аудитории']], new Map()), /столбцы/);
  const headers = ['Адрес УЛК', '№ аудитории', 'Назначение аудитории', 'Вместимость'];
  assert.throws(() => readRoomInventory([headers, ['Садовая, 54', '101', 'аудитория', '10']], new Map()), /Вознесенского/);
  assert.throws(() => readRoomInventory([headers, ['Вознесенский, 44-46', '452', 'неизвестно', '10']], new Map()), /строке 2/);
  assert.throws(() => readRoomInventory([
    headers,
    ['Вознесенский, 44-46', '452', 'аудитория', '10'],
    ['Вознесенский, 44-46', '452', 'аудитория', '20'],
  ], new Map()), /строке 3/);
});
