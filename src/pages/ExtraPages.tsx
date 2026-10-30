import React,{useEffect,useMemo,useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from '../components/Icons';
import {Card,Empty,Pill,ProgressBar,SectionHead,Sparkline} from '../components/UI';
import type {Category,DayMetrics,Finance,Workout} from '../types';
import {dateAdd,initialTimezone,monthDays,monthStart,mondayOf,progress,shortDay,money,score,weekDates} from '../lib/date';
import {request} from '../lib/api';

export function CalendarPage(){const{today,setDay,open,calendarTasks,getCalendar}=useApp();const[month,setMonth]=useState(today.slice(0,7));
  const start=month+'-01',days=monthDays(start),pad=(new Date(start+'T12:00:00Z').getUTCDay()+6)%7;
  const end=month+'-'+String(days).padStart(2,'0');
  useEffect(()=>{void getCalendar(start,end)},[start,end]);
  const change=(n:number)=>{const d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);setMonth(d.toISOString().slice(0,7));};
  const taskCount=(d:string)=>calendarTasks.filter(t=>t.day===d).length;
  return <div className="page-stack"><PageTitle label="ПЛАНИРОВАНИЕ" title="Календарь"/><Card className="calendar-card"><div className="calendar-header"><button className="icon-btn" onClick={()=>change(-1)} aria-label="Прошлый месяц"><Icon name="left"/></button><h2>{new Date(start+'T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}</h2><button className="icon-btn" onClick={()=>change(1)} aria-label="Следующий месяц"><Icon name="right"/></button></div>
    <div className="calendar-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(s=><div key={s} className="weekday">{s}</div>)}
      {Array.from({length:pad},(_,i)=><div key={'pad'+i}/>)}{Array.from({length:days},(_,i)=>{const d=start.slice(0,8)+String(i+1).padStart(2,'0');return <button key={d} className={'cal-cell '+(d===today?'is-today':'')} onClick={()=>{setDay(d);open('today')}}><span>{i+1}</span>{!!taskCount(d)&&<div className="cal-dots">{Array.from({length:Math.min(3,taskCount(d))},(_,j)=><i key={j}/>)}</div>}</button>})}</div>
  </Card><Card><SectionHead title="Задачи месяца" caption={`${calendarTasks.length} запланировано`}/>{calendarTasks.slice(0,15).map(t=><button key={t.id} className="event-row" onClick={()=>{setDay(t.day||today);open('today')}}><span>{shortDay(t.day||today)}</span><strong>{t.title}</strong><Icon name="right" size={16}/></button>)}{calendarTasks.length===0&&<Empty title="Пока ничего не запланировано"/>}</Card></div>;
}
function PageTitle({label,title,subtitle,action}:{label:string;title:string;subtitle?:string;action?:React.ReactNode}){
  return <div className="page-heading"><div><p className="eyebrow">{label}</p><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}
export function TomorrowPage(){const{today,setDay,open,tasks}=useApp();const tomorrow=dateAdd(today,1);
  return <div className="page-stack"><PageTitle label="ПЛАН НА ЗАВТРА" title="Завтра" subtitle={shortDay(tomorrow)} action={<button className="btn accent" onClick={()=>{setDay(tomorrow);open('today')}}>Открыть план <Icon name="right"/></button>}/>
    <Card><Empty icon="calendar-check" title="План на следующий день" description="Выбери главные задачи дня заранее и перенеси невыполненные дела через меню задачи." action={<button className="btn outline" onClick={()=>{setDay(tomorrow);open('today')}}>Планировать завтра</button>}/></Card>
  </div>;
}
export function FinancePage(){const{os6,setEditor}=useApp();const data=os6.finance||[];const[currency,setCurrency]=useState(data[0]?.currency||'RUB');
  const filtered=data.filter(f=>f.currency===currency);const income=filtered.filter(f=>f.direction==='income').reduce((n,f)=>n+Number(f.amount),0);
  const expense=filtered.filter(f=>f.direction==='expense').reduce((n,f)=>n+Number(f.amount),0);
  const currencies=Array.from(new Set([...data.map(f=>f.currency),'RUB','USD']));
  return <div className="page-stack"><PageTitle label="ЛИЧНЫЕ ФИНАНСЫ" title="Финансы" action={<button className="btn accent" onClick={()=>setEditor({type:'finance'})}><Icon name="plus" size={18}/> Запись</button>}/>
    <div className="finance-head"><Card className="balance"><span className="eyebrow">БАЛАНС</span><strong>{money(income-expense,currency)}</strong><div className="finance-balance-pills"><span><Icon name="arrow-up-right" size={15}/> +{money(income,currency)}</span><span><Icon name="arrow-down-right" size={15}/> −{money(expense,currency)}</span></div></Card>
      <Card className="balance-aside"><span className="muted-label">Операции</span><strong>{filtered.length}</strong><label className="currency-picker">Валюта<select value={currency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></Card></div>
    <Card><SectionHead title="История операций" caption="Валюты не суммируются между собой"/>{filtered.map(f=><button className="record-row" key={f.id} onClick={()=>setEditor({type:'finance',item:f})}><span className={'record-icon '+(f.direction==='income'?'positive':'negative')}><Icon name={f.direction==='income'?'arrow-down-right':'arrow-up-right'}/></span><span className="record-main"><strong>{f.category}</strong><small>{shortDay(f.day)} {f.is_sale?'· Продажа':''}</small></span><strong className={f.direction==='income'?'positive-text':''}>{f.direction==='income'?'+':'−'}{money(Number(f.amount),f.currency)}</strong></button>)}
      {!filtered.length&&<Empty icon="wallet" title="Здесь появятся финансовые записи"/>}</Card>
  </div>;
}
export function SportPage(){const{os6,setEditor}=useApp();const workouts=os6.workouts||[];const weight=os6.weight||[];
  return <div className="page-stack"><PageTitle label="ПРОГРЕСС ТЕЛА" title="Здоровье и спорт" action={<button className="btn accent" onClick={()=>setEditor({type:'workout'})}><Icon name="plus"/> Тренировка</button>}/>
    <div className="sport-stat"><Card><span className="muted-label">Всего тренировок</span><strong className="big-stat">{workouts.length}</strong><span className="tiny-note">В журнале</span></Card><Card><span className="muted-label">Последний вес</span><strong className="big-stat">{weight.length?Number(weight[0].kg):'—'}<small> кг</small></strong><button className="btn text" onClick={()=>setEditor({type:'weight'})}>Добавить замер</button></Card></div>
    {!!weight.length&&<Card><SectionHead title="Динамика веса"/><Sparkline color="#70BFA7" height={100} values={[...weight].sort((a,b)=>a.day.localeCompare(b.day)).map(x=>Number(x.kg))}/></Card>}
    <Card><SectionHead title="Журнал тренировок" action={<button className="btn text" onClick={()=>setEditor({type:'exercise'})}>+ Упражнение</button>}/>
      {workouts.map(w=><button className="record-row" key={w.id} onClick={()=>setEditor({type:'workout',item:w})}><span className="record-icon sport-icon"><Icon name="dumbbell"/></span><span className="record-main"><strong>{w.title}</strong><small>{shortDay(w.day)} · {w.duration_min} мин</small></span><Icon name="right" size={17}/></button>)}
      {!workouts.length&&<Empty icon="dumbbell" title="Первая тренировка впереди"/>}</Card>
  </div>;
}
export function FocusPage(){const {os6,mutate,tasks,buffer}=useApp();const active=os6.focus.find(f=>f.state!=='finished');const [seconds,setSeconds]=useState(0);
 const [taskId,setTaskId]=useState(''),[presets,setPresets]=useState<number[]>([5,15,25,45]),[minutes,setMinutes]=useState(25),[custom,setCustom]=useState(''),[error,setError]=useState('');
 useEffect(()=>{function tick(){if(!active){setSeconds(0);return;}setSeconds(Number(active.accumulated_seconds)+(active.state==='running'&&active.started_at?Math.max(0,Math.floor((Date.now()-Date.parse(active.started_at))/1000)):0));}tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[active?.id,active?.state,active?.started_at,active?.accumulated_seconds]);
 const time=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':');
 const remaining=Math.max(0,minutes*60-seconds);const remain=[Math.floor(remaining/60),remaining%60].map(v=>String(v).padStart(2,'0')).join(':');
 const run=async(command:string)=>{setError('');try{const task=[...tasks,...buffer].find(t=>t.id===taskId);await mutate('os6','focus',{command,title:task?.title||'Фокус',task_id:task?.id||null})}catch(e:any){setError(e.message||'Ошибка сохранения')}};
 const addPreset=()=>{const n=Number(custom);if(Number.isInteger(n)&&n>=1&&n<=360){setPresets(p=>[...new Set([...p,n])].sort((a,b)=>a-b));setMinutes(n);setCustom('')}};
 return <div className="page-stack"><PageTitle label="ГЛУБОКАЯ РАБОТА" title="Фокус" subtitle="Один шаг за раз"/>
 <Card className="focus-card"><div className="focus-ring"><span className="eyebrow">ТВОЯ СЕССИЯ</span><strong>{time}</strong><span>{active?.state==='running'?'Идёт работа':active?.state==='paused'?'На паузе':'Готов к фокусу'}</span><small>До ориентира: {remain}</small></div>
 {!active&&<><label className="focus-task-select">Задача <select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">Без задачи</option>{[...tasks,...buffer].map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><div className="focus-presets">{presets.map(n=><span key={n}><button className={'btn small '+(minutes===n?'accent':'outline')} onClick={()=>setMinutes(n)}>{n} мин</button><button className="focus-preset-delete" aria-label={'Убрать '+n+' минут'} onClick={()=>setPresets(p=>p.filter(x=>x!==n))}>×</button></span>)}</div><form className="focus-add-preset" onSubmit={e=>{e.preventDefault();addPreset()}}><input aria-label="Своя длительность в минутах" type="number" min="1" max="360" placeholder="Минуты" value={custom} onChange={e=>setCustom(e.target.value)}/><button className="btn outline" type="submit">Добавить время</button></form></>}
 <div className="focus-controls">{!active?<button className="btn accent big" onClick={()=>void run('start')}><Icon name="play"/> Начать</button>:<><button className="btn accent big" onClick={()=>void run(active.state==='running'?'pause':'resume')}><Icon name={active.state==='running'?'pause':'play'}/>{active.state==='running'?'Пауза':'Продолжить'}</button><button className="btn outline big" onClick={()=>void run('stop')}><Icon name="stop"/> Завершить</button></>}</div>
 {error&&<p role="alert" className="os-inline-error">{error}</p>}<p className="tiny-note">Время сессии сохраняется в облаке. Выбранная длительность — ориентир, завершить можно в любой момент.</p></Card>
 <Card><SectionHead title="Последние сессии"/>{os6.focus.filter(f=>f.state==='finished').slice(0,12).map(f=><div key={f.id} className="record-row"><Icon name="clock" size={17}/><span className="record-main"><strong>{f.title}</strong></span><strong>{Math.round(f.accumulated_seconds/60)} мин</strong></div>)}{os6.focus.every(f=>f.state!=='finished')&&<Empty title="Завершённых сессий пока нет"/>}</Card></div>;
}
export function ChallengesPage(){const{os6,setEditor,today,mutate}=useApp();
  return <div className="page-stack"><PageTitle label="ЛИЧНЫЕ ИСПЫТАНИЯ" title="Вызовы" action={<button className="btn accent" onClick={()=>setEditor({type:'challenge'})}><Icon name="plus"/> Вызов</button>}/>
    {os6.challenges.map(c=>{const days=os6.challengeDays.filter(x=>x.challenge_id===c.id),pct=progress(days.length,c.target_days),checked=days.some(x=>x.day===today),active=today>=c.starts_on&&today<=c.ends_on;
      return <Card className="challenge-card" key={c.id}><div className="card-title-row"><h2>{c.title}</h2><Pill accent="lavender">{pct}%</Pill></div><p className="tiny-note">{shortDay(c.starts_on)} — {shortDay(c.ends_on)}</p><ProgressBar value={pct}/><div className="goal-full-footer"><span>{days.length} из {c.target_days} дней</span><button className="btn small outline" onClick={()=>setEditor({type:'challenge',item:c})}>Изменить</button></div>{active&&<button className="btn accent full" onClick={()=>void mutate('os61','challenge_day',{id:c.id,day:today,done:!checked})}>{checked?'Снять отметку':'✓ Выполнил сегодня'}</button>}</Card>})}
    {!os6.challenges.length&&<Card><Empty icon="trophy" title="Создай первый вызов" description="Дисциплина формируется из небольших повторяющихся действий"/></Card>}
  </div>;
}
export function RepeatsPage(){const{os6,setEditor}=useApp();return <div className="page-stack"><PageTitle label="АВТОМАТИЗАЦИЯ" title="Повторяющиеся задачи" action={<button className="btn accent" onClick={()=>setEditor({type:'repeat'})}><Icon name="plus"/> Шаблон</button>}/>
    <Card>{os6.repeats.map(r=><button className="record-row" key={r.id} onClick={()=>setEditor({type:'repeat',item:r})}><span className="record-icon"><Icon name="repeat"/></span><span className="record-main"><strong>{r.title}</strong><small>{r.frequency==='daily'?'Каждый день':r.frequency==='weekly'?'По неделям':'По месяцам'} · {r.sphere}</small></span><Pill accent={r.enabled?'mint':'lavender'}>{r.enabled?'Включено':'Пауза'}</Pill></button>)}
      {!os6.repeats.length&&<Empty icon="repeat" title="Создай повторяющуюся задачу" description="Например, тренировку три раза в неделю"/>}</Card>
  </div>}
export function ReviewPage(){const{today,os6,mutate}=useApp();const monday=mondayOf(today);const initial=os6.reviews.find(x=>x.monday===monday);const[wins,setWins]=useState(initial?.wins||'');const[lessons,setLessons]=useState(initial?.lessons||'');const[next,setNext]=useState(initial?.next_steps||'');
  return <div className="page-stack"><PageTitle label="РЕФЛЕКСИЯ" title="Обзор недели" subtitle={`${shortDay(monday)} — ${shortDay(dateAdd(monday,6))}`}/><Card><form className="editor-form" onSubmit={async e=>{e.preventDefault();await mutate('os6','review_save',{monday,wins,lessons,next_steps:next})}}><label>Что получилось?<textarea rows={3} value={wins} onChange={e=>setWins(e.target.value)} placeholder="Главные победы"/></label><label>Что улучшить?<textarea rows={3} value={lessons} onChange={e=>setLessons(e.target.value)} placeholder="Наблюдения и выводы"/></label><label>Фокус следующей недели<textarea rows={3} value={next} onChange={e=>setNext(e.target.value)} placeholder="Один приоритет"/></label><button className="btn accent" type="submit"><Icon name="save"/> Сохранить обзор</button></form></Card></div>;
}
export function DisciplinePage(){const{today,metrics}=useApp();const [rows,setRows]=useState<Record<string,DayMetrics>>(metrics);const start=dateAdd(today,-27);
  useEffect(()=>{if(location.search.includes('demo=1'))return;let active=true;
    void request<{days:Record<string,DayMetrics>}>('os6','metrics',{start,end:today}).then(r=>{if(active)setRows(r.days)}).catch(()=>{});
    return()=>{active=false};},[today]);
  const dates=Array.from({length:28},(_,i)=>dateAdd(start,i));const successful=dates.filter(d=>{
    const m=rows[d];return m&&m.important>0&&m.done_important===m.important;
  }).length;
  return <div className="page-stack"><PageTitle label="МЕТРИКИ ХАРАКТЕРА" title="Дисциплина" subtitle="28 последних дней"/>
    <Card className="discipline-summary"><span className="muted-label">Дни с выполненным главным планом</span><strong>{successful}<small> / 28</small></strong><ProgressBar value={progress(successful,28)}/></Card>
    <Card><SectionHead title="Календарь результатов"/><div className="discipline-grid">{dates.map(d=>{const m=rows[d];const n=m?score(m.important||0,m.done_important||0,m.extras||0,m.done_extras||0):0;return <div key={d} className={'discipline-cell '+(n>=100?'done':'')} title={`${shortDay(d)}: ${n}%`}>{n?'✓':''}</div>})}</div><p className="tiny-note">Акцентом отмечены дни с результатом от 100%.</p></Card>
  </div>;
}
const COLORS=['#8B84ED','#75B9EC','#E8A277','#69BFA7','#E6A9C4','#9B9BAF','#E0B55E','#90A9D7'];
const ICONS=['folder','briefcase','house','heart-pulse','wallet','dumbbell','book-open','sparkles','car','shopping-bag','palette','target'];
export function CategoriesPage(){const{categories,saveCategory,deleteCategory,mutate}=useApp();const[edit,setEdit]=useState<Category|null>(null);const[name,setName]=useState('');const[color,setColor]=useState(COLORS[0]);const[icon,setIcon]=useState(ICONS[0]);const [busy,setBusy]=useState(false);
  const begin=(c?:Category)=>{setEdit(c||{id:'',name:'',color:COLORS[0],icon:ICONS[0],sort_order:0});setName(c?.name||'');setColor(c?.color||COLORS[0]);setIcon(c?.icon||ICONS[0]);};
  const order=async(id:string,delta:number)=>{const list=[...categories],from=list.findIndex(c=>c.id===id),to=from+delta;if(from<0||to<0||to>=list.length)return;[list[from],list[to]]=[list[to],list[from]];await mutate('os61','category_reorder',{ids:list.map(c=>c.id)});};
  return <div className="page-stack"><PageTitle label="ОРГАНИЗАЦИЯ" title="Категории" action={<button className="btn accent" onClick={()=>begin()}><Icon name="plus"/> Новая</button>}/>
    <Card>{categories.map((c,i)=><div className="record-row" key={c.id}><span className="category-swatch" style={{background:c.color}}><Icon name={c.icon} size={18}/></span><span className="record-main"><strong>{c.name}</strong></span><button className="icon-btn compact" onClick={()=>void order(c.id,-1)} disabled={i===0} aria-label="Поднять категорию"><Icon name="arrow-up" size={17}/></button><button className="icon-btn compact" onClick={()=>void order(c.id,1)} disabled={i===categories.length-1} aria-label="Опустить категорию"><Icon name="arrow-down" size={17}/></button><button className="icon-btn compact" onClick={()=>begin(c)} aria-label="Редактировать категорию"><Icon name="edit" size={17}/></button></div>)}
      {!categories.length&&<Empty title="Добавь категории"/>}</Card>
    {edit&&<Card><SectionHead title={edit.id?'Изменить категорию':'Новая категория'}/><form className="editor-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await saveCategory({id:edit.id||null,name,color,icon});setEdit(null)}finally{setBusy(false)}}}>
      <label>Название<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Например: Работа"/></label>
      <div className="form-grid"><label>Иконка<select value={icon} onChange={e=>setIcon(e.target.value)}>{ICONS.map(x=><option key={x} value={x}>{x}</option>)}</select></label><div><label>Цвет</label><div className="color-swatches">{COLORS.map(c=><button key={c} type="button" onClick={()=>setColor(c)} className={'color-choice '+(c===color?'selected':'')} style={{background:c}} aria-label={`Цвет ${c}`}/>)}</div></div></div>
      <div className="form-actions">{edit.id&&<button className="btn danger-btn" type="button" onClick={()=>{void deleteCategory(edit);setEdit(null)}}>Удалить</button>}<button className="btn subtle" type="button" onClick={()=>setEdit(null)}>Отмена</button><button className="btn accent" disabled={busy}>Сохранить</button></div>
    </form></Card>}
  </div>;
}
export function SettingsPage(){const{os6,mutate,tz}=useApp();const s=os6.settings;const[timezone,setTimezone]=useState(tz);
  const [enabled,setEnabled]=useState(s.reminders_enabled);const[morning,setMorning]=useState(s.morning_time?.slice(0,5)||'09:00');const[evening,setEvening]=useState(s.evening_time?.slice(0,5)||'21:30');const[weekly,setWeekly]=useState(s.weekly_time?.slice(0,5)||'20:00');
  const save=async(e:React.FormEvent)=>{e.preventDefault();try{await mutate('os6','settings_save',{record:{tz:timezone,target_task:s.target_task,target_sale:s.target_sale,target_sport:s.target_sport,morning_time:morning,evening_time:evening,weekly_time:weekly,reminders_enabled:enabled}});
      await mutate('os61','timezone_save',{tz:timezone});}catch{/* reported */}};
  return <div className="page-stack"><PageTitle label="ЛИЧНЫЕ НАСТРОЙКИ" title="Настройки"/><Card><form className="editor-form" onSubmit={save}>
    <SectionHead title="Часовой пояс"/><label>Время и дата<input required value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Europe/Moscow"/><span className="tiny-note">Определяется автоматически при первом входе. Можно изменить вручную.</span></label>
    <p className="settings-goals-note">Планирование целей теперь находится в разделе «Цели»: обычные, амбициозные и с любым сроком.</p>
    <SectionHead title="Напоминания"/><label className="checkbox-inline"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Включить Telegram-напоминания</label>
    <p className="tiny-note">Автоматическая отправка требует отдельно настроенного Cron. Без него приложение продолжает работать.</p>
    <div className="form-grid"><label>Утро<input type="time" value={morning} onChange={e=>setMorning(e.target.value)}/></label><label>Вечер<input type="time" value={evening} onChange={e=>setEvening(e.target.value)}/></label></div><label>Обзор недели<input type="time" value={weekly} onChange={e=>setWeekly(e.target.value)}/></label>
    <button type="submit" className="btn accent"><Icon name="save"/> Сохранить настройки</button>
  </form></Card></div>;
}
export function HelpPage(){return <div className="page-stack"><PageTitle label="СПРАВКА" title="Как пользоваться"/><Card><h2>Personal OS</h2><p>Главное показывает сводку. В «Сегодня» — важные и дополнительные задачи. В боковом меню находятся буфер, календарь, финансы, спорт и другие инструменты.</p><div className="help-items"><div><Icon name="grip"/><span>Удерживай ручку задачи, чтобы поменять порядок или перенести в другую секцию.</span></div><div><Icon name="cloud-check"/><span>Облако в шапке показывает состояние сохранения в Supabase.</span></div><div><Icon name="calendar"/><span>Дата определяется по часовому поясу профиля.</span></div></div></Card></div>}

export function EntityEditor(){const {editor,setEditor,mutate,os6,today}=useApp();if(!editor||!['finance','workout','weight','exercise','repeat','challenge'].includes(editor.type))return null;
  const type=editor.type as 'finance'|'workout'|'weight'|'exercise'|'repeat'|'challenge';const item=editor.item||{};
  const[form,setForm]=useState<Record<string,any>>({...item,
    day:item.day||today,direction:item.direction||'income',currency:item.currency||'RUB',category:item.category||'Работа',
    duration_min:item.duration_min??45,kg:item.kg||'',frequency:item.frequency||'weekly',interval_n:item.interval_n||1,weekdays:item.weekdays||[1,3,5],
    title:item.title||'',priority:item.priority||'extra',sphere:item.sphere||'Личное',starts_on:item.starts_on||today,
    ends_on:item.ends_on||dateAdd(today,13),target_days:item.target_days||14,enabled:item.enabled??true,
    workout_id:item.workout_id||os6.workouts[0]?.id||'',sets:item.sets||3,reps:item.reps||10,weight_kg:item.weight_kg??''});
  const update=(key:string,value:any)=>setForm(x=>({...x,[key]:value}));const submit=async(e:React.FormEvent)=>{e.preventDefault();
    const record={...form};if(type==='repeat')record.ends_on=record.ends_on||null;
    if(type==='exercise')record.weight_kg=record.weight_kg===''?null:Number(record.weight_kg);
    try{await mutate('os6','entity_save',{entity:type,id:item.id||null,record});setEditor(null);}catch{/* toast */}};
  const field=(label:string,key:string,kind='text',required=false,extra:any={})=><label key={key}>{label}<input type={kind} required={required} value={form[key]??''} onChange={e=>update(key,kind==='number'?e.target.value:e.target.value)} {...extra}/></label>;
  return <form className="editor-form" onSubmit={submit}>
    {type==='finance'&&<>{field('Дата','day','date',true)}<label>Тип<select value={form.direction} onChange={e=>update('direction',e.target.value)}><option value="income">Доход</option><option value="expense">Расход</option></select></label>{field('Сумма','amount','number',true,{min:0.01,step:0.01})}{field('Валюта','currency','text',true,{maxLength:8})}{field('Категория','category')}{field('Заметка','note')}<label className="checkbox-inline"><input type="checkbox" checked={form.is_sale===true} onChange={e=>update('is_sale',e.target.checked)}/> Учитывать как продажу</label></>}
    {type==='workout'&&<>{field('Дата','day','date',true)}{field('Название тренировки','title','text',true)}{field('Длительность, мин','duration_min','number',true,{min:0})}{field('Заметки','notes')}</>}
    {type==='weight'&&<>{field('Дата','day','date',true)}{field('Вес, кг','kg','number',true,{min:.01,step:.01})}{field('Комментарий','note')}</>}
    {type==='exercise'&&<><label>Тренировка<select value={form.workout_id} onChange={e=>update('workout_id',e.target.value)}>{os6.workouts.map(w=><option key={w.id} value={w.id}>{w.title} · {shortDay(w.day)}</option>)}</select></label>{field('Упражнение','title','text',true)}<div className="form-grid">{field('Подходы','sets','number',true,{min:1})}{field('Повторения','reps','number',true,{min:0})}</div>{field('Вес снаряда, кг','weight_kg','number',false,{min:0,step:.1})}</>}
    {type==='repeat'&&<>{field('Название','title','text',true)}{field('Сфера','sphere')}<label>Тип<select value={form.priority} onChange={e=>update('priority',e.target.value)}><option value="important">Важная</option><option value="extra">Дополнительная</option></select></label><label>Повторять<select value={form.frequency} onChange={e=>update('frequency',e.target.value)}><option value="daily">Ежедневно</option><option value="weekly">По дням недели</option><option value="monthly">Ежемесячно</option></select></label>{field('Интервал','interval_n','number',true,{min:1,max:52})}<label>Дни недели (1=Пн, 7=Вс)<input value={(form.weekdays||[]).join(',')} onChange={e=>update('weekdays',e.target.value.split(',').map(x=>+x.trim()).filter(x=>x>=1&&x<=7))}/></label>{field('Начало','starts_on','date',true)}{field('Конец','ends_on','date')}<label className="checkbox-inline"><input type="checkbox" checked={form.enabled} onChange={e=>update('enabled',e.target.checked)}/> Включено</label></>}
    {type==='challenge'&&<>{field('Название вызова','title','text',true)}{field('Начало','starts_on','date',true)}{field('Конец','ends_on','date',true)}{field('Цель — дней','target_days','number',true,{min:1,max:366})}<label>Условия<textarea value={form.note||''} onChange={e=>update('note',e.target.value)}/></label></>}
    <div className="form-actions">{item.id&&<button type="button" className="btn danger-btn" onClick={async()=>{if(window.confirm('Удалить запись?')){await mutate('os6','entity_delete',{entity:type,id:item.id});setEditor(null)}}}>Удалить</button>}
      <button className="btn subtle" type="button" onClick={()=>setEditor(null)}>Отмена</button><button className="btn accent" type="submit">Сохранить</button></div>
  </form>;
}
