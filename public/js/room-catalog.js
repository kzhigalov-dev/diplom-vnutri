const purposeLabels = {
  computer: 'Компьютерный класс',
  lecture: 'Лекционная',
  laboratory: 'Лаборатория',
  practice: 'Аудитория для практических занятий',
  classroom: 'Учебная аудитория',
};

const photoReferences = {
  '478': {
    url: 'https://kit.sutd.ru/about/computers-classes/',
    evidence: 'На системном блоке видна маркировка 478-3. Номер аудитории предположительный.',
    computersAlongWalls: true,
  },
  '290': {
    url: 'https://sutd.ru/upload/iblock/5e3/05.jpg',
    evidence: 'Вероятный архивный кадр 290‑В. Назначение лаборатории и швейные машины совпадают с описанием СПбГУПТД.',
    sewingMachines: true,
  },
  '352': {
    url: 'https://t.me/ecogreenlight/165',
    evidence: 'Видео мастер-класса в аудитории 352 показывает двухсекционную зелёную доску и светлые деревянные столы.',
    doubleChalkboard: true,
  },
};

export function catalogPhotoReference(room) {
  return room?.buildingId === 'voznesensky' ? photoReferences[room.number] : undefined;
}

export function catalogTitle(room) {
  return room?.purposes.map((purpose) => purposeLabels[purpose]).filter(Boolean).join(' · ') ?? '';
}

export function catalogSummary(room) {
  const seats = room.capacity === null ? 'Вместимость не указана' : `Мест: ${room.capacity}`;
  if (room.computerCount === null) return `${seats}. Количество компьютеров не указано.`;
  const source = {
    estimate: 'оценка для модели',
    inventory: 'по ведомости',
    manual: 'по каталогу',
    verified: 'по проверенным данным',
  }[room.computerCountSource];
  return `${seats}. Компьютеров: ${room.computerCount}${source ? ` (${source})` : ''}.`;
}

export async function fetchRoomCatalog(id) {
  const path = id ? `/api/v1/rooms/${encodeURIComponent(id)}` : '/api/v1/rooms';
  const response = await fetch(path, {signal: AbortSignal.timeout(5000)});
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
  const data = await response.json();
  return id ? data : data.rooms;
}

export async function saveRoomCounts(room, after) {
  const before = {capacity: room.capacity, computerCount: room.computerCount};
  const response = await fetch(`/api/v1/rooms/${encodeURIComponent(room.id)}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({before, after}),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 409) return {conflict: (await response.json()).room};
  if (!response.ok) throw new Error('Room update failed');
  return {room: await response.json()};
}
