import {demoVisits, programLink, routeLink, selectedVisits, upcomingOfficialEvents, visitItinerary} from './campus-days-model.js?v=20261112-polish';
import {escapeHTML as e} from './escape-html.js';

const $ = id => document.getElementById(id);
const official = upcomingOfficialEvents();
const dateFormat = new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Moscow', day:'numeric', month:'short'});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Moscow', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
$('official-event-list').innerHTML = official.map(event => {
  const start = new Date(event.startsAt);
  return `<article class="agenda-row">
    <time class="agenda-time" datetime="${e(event.startsAt)}">${dateFormat.format(start)}<span>${timeFormat.format(start)}</span></time>
    <div class="agenda-content"><h3>${e(event.title)}</h3><p>${e(event.venue)}</p><p>${e(event.note)}</p></div>
    <div class="agenda-location agenda-links">
      <a class="text-link" href="${e(event.source)}" target="_blank" rel="noopener noreferrer">Объявление ↗</a>
      ${event.building?`<a class="text-link" href="./buildings.html?to=${e(event.building)}">До корпуса →</a>`:''}
    </div>
  </article>`;
}).join('') || '<p class="agenda-empty">Ближайших встреч в проверенных объявлениях нет. <a href="https://prouniver.ru/news/" target="_blank" rel="noopener noreferrer">Новости приёмной комиссии ↗</a></p>';
const params = new URLSearchParams(location.search);
if (params.has('program') && params.get('program') !== 'demo-open-day') {
  $('visit-list').textContent = 'Программа по этой ссылке не найдена. Откройте пример программы заново.';
  document.querySelector('.share-box').hidden = true;
} else {
  const chosen = new Set(selectedVisits(location.search));
  $('visit-list').innerHTML = demoVisits.map(visit => `<article class="agenda-row" data-visit="${e(visit.id)}">
    <time class="agenda-time" datetime="${e(visit.time)}">${e(visit.time)}</time>
    <div class="agenda-content">
      <h3 id="visit-${e(visit.id)}">${e(visit.title)}</h3>
      <p>${e(visit.description)}</p>
      <label class="visit-select"><input type="checkbox" value="${e(visit.id)}" aria-labelledby="visit-option-${e(visit.id)} visit-${e(visit.id)}" ${chosen.has(visit.id) ? 'checked' : ''}><span id="visit-option-${e(visit.id)}">В программе</span></label>
    </div>
    <div class="agenda-location">
      <span class="agenda-room">Аудитория <strong>${e(visit.room)}</strong></span>
      <span class="agenda-location-note">4-й этаж</span>
      <div data-visit-route></div>
    </div>
  </article>`).join('');
  const cards = [...$('visit-list').querySelectorAll('[data-visit]')];
  const update = event => {
    const ids = [...$('visit-list').querySelectorAll('input:checked')].map(input => input.value);
    const stops = new Map(visitItinerary(ids).map(stop => [stop.visit.id, stop]));
    for (const card of cards) {
      const stop = stops.get(card.dataset.visit);
      const leg = card.querySelector('[data-visit-route]');
      leg.replaceChildren();
      if (!stop) continue;
      if (!stop.route) {
        leg.textContent = 'Для этого участка нет подтверждённой точки на плане.';
        continue;
      }
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = routeLink(location.href, stop.route.destination, stop.route.origin);
      link.textContent = stop.previous ? `От аудитории ${stop.previous.room} →` : 'От главного входа →';
      leg.append(link);
    }
    const url = programLink(location.href, ids);
    $('share-link').value = url.href;
    if (event?.type === 'change') history.replaceState(null, '', url);
    $('copy-status').textContent = ids.length ? `Остановок в программе: ${ids.length}` : 'Остановки не выбраны.';
  };
  $('visit-list').addEventListener('change', update);
  $('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('share-link').value);
      $('copy-status').textContent = 'Ссылка скопирована.';
    } catch {
      $('share-link').focus();
      $('share-link').select();
      $('copy-status').textContent = 'Выделите и скопируйте ссылку вручную.';
    }
  });
  update();
}
