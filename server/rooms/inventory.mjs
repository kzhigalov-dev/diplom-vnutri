const purposeCodes = new Map([
  ['лекционная', 'lecture'],
  ['для практических занятий', 'practice'],
  ['лаборатория', 'laboratory'],
  ['компьютерный класс', 'computer'],
  ['аудитория', 'classroom'],
]);

export function normalizeRoomNumber(value) {
  return String(value ?? '').normalize('NFKC').toUpperCase()
    .replace(/[–—−]/gu, '-').replace(/\s/gu, '')
    .replace(/A/gu, 'А').replace(/B/gu, 'В')
    .replace(/^(\d{3})-([А-Я])$/u, '$1$2');
}

export function mapRoomNumbers(geometry, spaces) {
  const signedFloors = new Set(geometry.floors
    .filter((floor) => floor.sourceKind === 'wayfinding-panel').map((floor) => floor.floor));
  const ids = new Map();
  for (const floor of spaces.floors) {
    if (!signedFloors.has(floor.floor)) continue;
    for (const space of floor.spaces) {
      const number = normalizeRoomNumber(space.label);
      if (!/^\d{3}[А-Я]?$/u.test(number)) continue;
      ids.set(number, ids.has(number) ? null : space.id);
    }
  }
  return ids;
}

function readCounts(value, notes, purposes) {
  const text = String(value ?? '').toLowerCase().trim().replace(/\s+/gu, ' ');
  const unqualified = text.match(/^(\d+)(?:,\s*ремонт|\s*\(треб\.?\s*ремонт\))?$/u);
  const computersAndSeats = text.match(/^(\d+) комп\.?\s*\+\s*(\d+)\s+пос\.?\s*мест/u);
  const seatsAndComputers = text.match(/^(\d+) мест без пк;\s*(\d+)\s*\+\s*(\d+)\s*раб\.?\s*место пк/u);
  const computersWithTeacher = text.match(/^(\d+)(?:\s*комп\.?)?\s*\+\s*(\d+)\s*(?:преп|комп\.?\s*\(преп)/u);
  const computerOnly = text.match(/^(\d+)\s+(?:комп\.?|раб\.?\s*место пк)$/u);
  const studio = text.match(/фотостудия\s*\+\s*(\d+)\s+комп/iu);
  const approximate = String(notes ?? '').match(/есть\s*~\s*(\d+)\s*комп/iu);

  if (computersAndSeats) {
    const [computers, seats] = computersAndSeats.slice(1).map(Number);
    return [computers + seats, computers, 'inventory'];
  }
  if (seatsAndComputers) {
    const [seats, computers, extra] = seatsAndComputers.slice(1).map(Number);
    return [seats + computers + extra, computers + extra, 'inventory'];
  }
  if (computersWithTeacher) {
    const count = Number(computersWithTeacher[1]) + Number(computersWithTeacher[2]);
    return [count, count, 'inventory'];
  }
  if (computerOnly) return [Number(computerOnly[1]), Number(computerOnly[1]), 'inventory'];
  if (studio) return [null, Number(studio[1]), 'inventory'];
  const capacity = unqualified ? Number(unqualified[1]) : null;
  if (approximate) return [capacity, Number(approximate[1]), 'estimate'];
  const pureComputerClass = purposes.length === 1 && purposes[0] === 'computer';
  return capacity !== null && pureComputerClass ? [capacity, capacity, 'estimate'] : [capacity, null, null];
}

export function readRoomInventory(rows, mapIds) {
  const headers = rows[0]?.map((value) => String(value ?? '').trim()) ?? [];
  const address = headers.indexOf('Адрес УЛК');
  const number = headers.indexOf('№ аудитории');
  const purpose = headers.findIndex((header) => header.startsWith('Назначение аудитории'));
  const capacity = headers.findIndex((header) => header.startsWith('Вместимость'));
  const notes = headers.indexOf('Примечание');
  if ([address, number, purpose, capacity].includes(-1)) {
    throw new Error('Не найдены обязательные столбцы аудиторного фонда.');
  }

  const rooms = [];
  const seen = new Set();
  let withoutNumber = 0;
  for (const [index, row] of rows.slice(1).entries()) {
    if (!/Вознесенский/iu.test(String(row[address] ?? ''))) continue;
    const key = normalizeRoomNumber(row[number]);
    if (!key) {
      withoutNumber += 1;
      continue;
    }
    const purposes = [...new Set(String(row[purpose]).toLowerCase().split(',')
      .map((item) => purposeCodes.get(item.trim())))];
    if (!/^\d{3}(?:[А-Я]|-\d{3})?$/u.test(key) || seen.has(key) || purposes.includes(undefined)) {
      throw new Error(`Проверьте номер или назначение в строке ${index + 2}.`);
    }
    const [seats, computers, countSource] = readCounts(row[capacity], row[notes], purposes);
    seen.add(key);
    rooms.push({
      number: key,
      spaceId: mapIds.get(key) ?? null,
      purposes,
      capacity: seats,
      computerCount: computers,
      computerCountSource: countSource,
    });
  }
  if (!rooms.length) throw new Error('В листе нет помещений Вознесенского корпуса.');
  return {rooms, withoutNumber};
}
