import {demoClasses, nextClass, routeLink} from './campus-days-model.js?v=20261112-polish';
import {buildingDirectionsLink} from './campus-buildings.js?v=20261112-polish';
import {todayMoscow} from './moscow-date.js';
import {readSchedule,readScheduleFile,scheduleDays,SCHEDULE_STORAGE_KEY} from './local-schedule.js?v=20261113-xlsx';
import {readWeeklySchedule,lessonsForWeek,WEEKDAYS,WEEK_TYPES} from './weekly-schedule.js?v=20261113-xlsx';
import {escapeHTML as e} from './escape-html.js';

const $ = id => document.getElementById(id);
const dateLabel=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const formatDay=date=>{
 const label=dateLabel.format(new Date(date+'T12:00:00Z'));
 return label[0].toUpperCase()+label.slice(1);
};
let localSchedule=null,fileRevision=0,selectedDay=null;
const status=$('schedule-status'),reset=$('schedule-reset'),daySelect=$('schedule-day');
const weekSelect=$('schedule-week'),weekdaySelect=$('schedule-weekday');
let selectedWeekday=null;
weekdaySelect.replaceChildren(...WEEKDAYS.map((day,index)=>new Option(day,String(index))));

function weeklyView(schedule,today){
 const weekdays=lessonsForWeek(schedule.rows,schedule.week);
 const todayIndex=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7;
 const weekday=selectedWeekday??(weekdays.find(lesson=>lesson.weekday>=todayIndex)??weekdays[0])?.weekday??todayIndex;
 weekSelect.value=schedule.week;
 weekdaySelect.value=String(weekday);
 $('today-date').textContent=WEEKDAYS[weekday];
 $('schedule-title').textContent=schedule.group?'Группа '+schedule.group:'Моё расписание';
 const classes=weekdays.filter(lesson=>lesson.weekday===weekday);
 $('next-status').textContent=classes.length
  ?''
  :'На этот день занятий в выбранной неделе нет.';
 return {classes,next:null};
}

function datedView(schedule,today,now){
 const days=scheduleDays(schedule??[],today);
 const day=schedule&&days.dates.includes(selectedDay)?selectedDay:days.initial;
 const classes=schedule?schedule.filter(item=>item.date===day).sort((a,b)=>a.start.localeCompare(b.start)):demoClasses;
 const next=day===today?nextClass(classes,now):null;
 $('today-date').textContent=schedule?formatDay(day):'Учебный день';
 $('schedule-title').textContent=schedule?'Моё расписание':'Пример расписания';
 if(schedule){
  daySelect.replaceChildren(...days.dates.map(date=>new Option(date===today?'Сегодня · '+formatDay(date):formatDay(date),date)));
  daySelect.value=day;
 }
 $('next-status').textContent=!schedule||next?''
  :!classes.length?(schedule?.length?'На выбранную дату занятий в файле нет.':'В файле нет занятий.')
  :day===today?'На сегодня больше нет неотменённых занятий.'
  :day===days.initial&&!selectedDay?'На сегодня занятий в файле нет.':'';
 return {classes,next:schedule?next:null};
}

function lessonRow(item, next, imported) {
 const address=item.address||(!imported?'Вознесенский проспект, 44–46':'');
 const isNext=next?.id===item.id;
 const statusLabel={moved:'Перенесено',cancelled:'Отменено'}[item.status];
 const city=item.building&&item.status!=='cancelled'
  ?buildingDirectionsLink(location.href,item.building,item.destination?item.room:undefined)
  :null;
 const destination=item.destination&&item.status!=='cancelled'
  ?routeLink(location.href,item.destination)
  :null;
 const locationLabel=address||item.room?[
  item.room?`<span class="agenda-room">Аудитория <strong>${e(item.room)}</strong></span>`:'',
  address?`<span class="agenda-location-note">${e(address)}</span>`:'',
  item.status==='moved'?`<span class="agenda-location-note">Вместо аудитории ${e(item.previousRoom)}</span>`:'',
 ].join(''):'';
 const actions=[
  destination?`<a class="text-link" href="${e(destination)}">От входа до аудитории →</a>`:'',
  city?`<a class="text-link" href="${e(city.href)}">${destination?'Сначала до корпуса':'До корпуса'} →</a>`:'',
 ].join('');
 return `<article class="agenda-row${isNext?' agenda-row-next':''}">
  <div class="agenda-time"><time datetime="${item.start}">${item.start}</time><span>до <time datetime="${item.end}">${item.end}</time></span></div>
  <div class="agenda-content">
   <h3>${e(item.title)}</h3>
   ${item.teacher?`<p>${e(item.teacher)}</p>`:''}
   ${item.lessonType||statusLabel||isNext?`<div class="agenda-meta">
    ${statusLabel?`<span class="agenda-state" data-status="${item.status}">${statusLabel}</span>`:''}
    ${isNext?'<span class="agenda-state">Ближайшее</span>':''}
    ${item.lessonType?`<span>${e(item.lessonType)}</span>`:''}
   </div>`:''}
  </div>
  ${locationLabel||actions?`<div class="agenda-location">${locationLabel}
   ${actions?`<div class="agenda-links">${actions}</div>`:''}
   ${city&&item.room&&!destination?'<span class="agenda-location-note">Положение аудитории на плане не подтверждено.</span>':''}
  </div>`:''}
 </article>`;
}

function saveLocalSchedule(){
 try{
  localStorage.setItem(SCHEDULE_STORAGE_KEY,JSON.stringify(localSchedule));
  return true;
 }catch{
  return false;
 }
}
function renderSchedule(){
  const now=new Date(),today=todayMoscow(now),imported=localSchedule!==null;
  const weekly=localSchedule?.format==='weekly';
  reset.hidden=!imported;
  $('schedule-import-title').textContent=imported?'Управление расписанием':'Загрузить расписание';
  $('schedule-day-control').hidden=!imported||weekly;
  $('schedule-week-control').hidden=!weekly;
  $('schedule-weekday-control').hidden=!weekly;
  $('schedule-week-note').hidden=!weekly;
  const {classes,next}=weekly?weeklyView(localSchedule,today):datedView(localSchedule,today,now);
  $('class-list').innerHTML=classes.map(item=>lessonRow(item,next,imported)).join('')||
   `<p class="agenda-empty">${weekly?'Выберите другой день или неделю.':'Выберите другую дату или загрузите файл с занятиями.'}</p>`;
}
try{
  const saved=localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if(saved){
    const data=JSON.parse(saved);
    localSchedule=Array.isArray(data)?readSchedule(saved):readWeeklySchedule(data);
  }
}catch{
  status.textContent='Не удалось прочитать сохранённое расписание. Загрузите файл повторно.';
}
renderSchedule();
daySelect.addEventListener('change',()=>{
  selectedDay=daySelect.value;
  renderSchedule();
});
weekSelect.addEventListener('change',()=>{
  if(localSchedule?.format!=='weekly'||!Object.hasOwn(WEEK_TYPES,weekSelect.value))return;
  selectedWeekday=Number(weekdaySelect.value);
  localSchedule.week=weekSelect.value;
  saveLocalSchedule();
  renderSchedule();
});
weekdaySelect.addEventListener('change',()=>{
  selectedWeekday=Number(weekdaySelect.value);
  renderSchedule();
});
$('schedule-file').addEventListener('change',async event=>{
  const input=event.currentTarget,file=input.files[0];
  if(!file)return;
  const revision=++fileRevision;
  status.classList.add('campus-loading');
  $('class-list').setAttribute('aria-busy','true');
  status.textContent='Читаем файл…';
  try{
    const rows=await readScheduleFile(file);
    if(revision!==fileRevision)return;
    localSchedule=rows;
    selectedDay=null;
    selectedWeekday=null;
    const count=Array.isArray(rows)?rows.length:rows.rows.length;
    status.textContent='Загружено занятий: '+count+'. '+(saveLocalSchedule()
      ?'Расписание сохранено в этом браузере.'
      :'Хранилище недоступно, поэтому расписание открыто до перезагрузки страницы.');
    renderSchedule();
  }catch(error){
    if(revision===fileRevision)status.textContent=error.message;
  }finally{
    if(revision===fileRevision){
      input.value='';
      status.classList.remove('campus-loading');
      $('class-list').removeAttribute('aria-busy');
    }
  }
});
reset.addEventListener('click',()=>{
  fileRevision++;
  status.classList.remove('campus-loading');
  $('class-list').removeAttribute('aria-busy');
  localSchedule=null;
  selectedDay=null;
  selectedWeekday=null;
  $('schedule-file').value='';
  try{
    localStorage.removeItem(SCHEDULE_STORAGE_KEY);
    status.textContent='Загруженное расписание удалено.';
  }catch{
    status.textContent='Расписание закрыто. Браузер не разрешил удалить сохранённую копию.';
  }
  renderSchedule();
});
