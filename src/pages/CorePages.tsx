import React,{useEffect,useMemo,useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from '../components/Icons';
import {Card,Empty,GoalMini,Pill,ProgressBar,SectionHead,Sparkline,WeekBars} from '../components/UI';
import {TaskList} from '../components/Tasks';
import type {DayMetrics,Goal,Task} from '../types';
import {dateAdd,goalProgress,mondayOf,prettyDay,progress,score,shortDay,weekDates} from '../lib/date';
import {request} from '../lib/api';
import {RegularGoals} from '../components/RegularGoals';
import {PlanScore} from '../components/PlanScore';
import {QuickCategory} from '../components/QuickCategory';

const sums=(days:Record<string,DayMetrics>,dates:string[])=>dates.reduce((a,d)=>{const m=days[d];return {tasks:a.tasks+(m?.tasks||0),sales:a.sales+(m?.sales||0),sport:a.sport+(m?.sport||0)};},{tasks:0,sales:0,sport:0});
function dayKpi(tasks:Task[]){const imp=tasks.filter(t=>t.priority==='important');const extra=tasks.filter(t=>t.priority==='extra');
  return {important:imp.length,doneImportant:imp.filter(t=>t.completed).length,extra:extra.length,doneExtra:extra.filter(t=>t.completed).length,
    score:score(imp.length,imp.filter(t=>t.completed).length,extra.length,extra.filter(t=>t.completed).length)};
}
export function HomePage(){
  const {today,day,setDay,tasks,goals,goalHistory,os6,metrics,open,setEditor,openTaskPage}=useApp();
  useEffect(()=>{if(day!==today)setDay(today)},[today]);
  const k=dayKpi(tasks);const dates=weekDates(mondayOf(today));const totals=sums(metrics,dates);
  const important=tasks.filter(t=>t.priority==='important'&&!t.completed).slice(0,3);
  return <div className="page-stack home-dashboard">
    <div className="hello-block"><div><p className="eyebrow">ТВОЯ ЛИЧНАЯ СИСТЕМА</p><h1>Добро пожаловать<span className="hello-dot">.</span></h1><p>Всё важное — на одном экране</p></div><span className="date-chip"><Icon name="calendar" size={16}/>{shortDay(today)}</span></div>
    <div className="home-bento">
      <Card className="hero-result">
        <div className="hero-orb orb1"/><div className="hero-orb orb2"/>
        <div className="hero-top"><span className="eyebrow">РЕЗУЛЬТАТ ДНЯ</span><Pill accent={k.important&&k.important===k.doneImportant?'mint':'lavender'}>{k.important&&k.important===k.doneImportant?'Главное выполнено':'В процессе'}</Pill></div>
        <PlanScore important={k.important} doneImportant={k.doneImportant} extra={k.extra} doneExtra={k.doneExtra}/>
        <div className="hero-sub"><span>Важные <b>{k.doneImportant}/{k.important}</b></span><span>Дополнительные <b>{k.doneExtra}/{k.extra}</b></span></div>
        <button className="link-action" onClick={()=>open('today')}>Открыть задачи <Icon name="arrow-right" size={16}/></button>
      </Card>
      <div className="home-stat-grid actual-goals"><RegularGoals compact/></div>
    </div>
    <div className="home-second">
      <Card className="week-overview"><div className="card-title-row"><div><span className="eyebrow">АКТИВНОСТЬ</span><h2>Неделя в цифрах</h2></div><button className="icon-btn" onClick={()=>open('analytics')} aria-label="Открыть аналитику"><Icon name="arrow-up-right"/></button></div>
        <WeekBars days={dates} current={Object.fromEntries(dates.map(d=>[d,metrics[d]?.tasks||0]))}/>
        <div className="week-footer"><span><i className="legend-lavender"/> Выполненные задачи</span><b>{totals.tasks} всего</b></div>
      </Card>
      <Card className="priority-card"><div className="card-title-row"><div><span className="eyebrow">ФОКУС</span><h2>Главное сегодня</h2></div><button className="icon-btn" onClick={()=>setEditor({type:'task',day:today,priority:'important'})} aria-label="Добавить важную задачу"><Icon name="plus"/></button></div>
        {important.length?important.map(t=><button className="mini-task" key={t.id} onClick={()=>void openTaskPage(t)}><span className="mini-checkbox"/><span>{t.title}</span><Icon name="right" size={17}/></button>):
          <div className="success-spot"><Icon name="check-circle" size={26}/><strong>Важные дела закрыты</strong><span>Можно заняться дополнительными задачами</span></div>}
        <button className="btn subtle" onClick={()=>open('focus')}><Icon name="timer" size={16}/> Начать с 5 минут</button>
        <button className="link-action" onClick={()=>open('today')}>Весь список <Icon name="arrow-right" size={16}/></button>
      </Card>
    </div>
    <div className="home-goals"><SectionHead title="Мои ориентиры" action={<button className="btn text" onClick={()=>open('goals')}>Все цели <Icon name="right" size={16}/></button>}/>
      <div className="goals-grid">{goals.slice(0,2).map(g=><GoalMini key={g.id} title={g.title} current={Number(g.current_value)} target={Number(g.target_value)} start={Number(g.start_value)} unit={g.unit} history={goalHistory.filter(x=>x.goal_id===g.id)} open={()=>open('goals')}/>)}
        {!goals.length&&<Card><Empty icon="target" title="Добавь первую цель" action={<button className="btn accent" onClick={()=>setEditor({type:'goal'})}>Создать цель</button>}/></Card>}
      </div>
    </div>
  </div>;
}
export function TodayPage(){const{day,setDay,today,tasks,buffer,saveTask,setEditor,open,mutate,os6}=useApp();
  const k=dayKpi(tasks),important=tasks.filter(t=>t.priority==='important'),extra=tasks.filter(t=>t.priority==='extra');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [bufferId,setBufferId]=useState('');const [bufferPriority,setBufferPriority]=useState<'important'|'extra'>('important');const [moving,setMoving]=useState(false);
  const group=(items:Task[],zone:'important'|'extra')=>{
    const pending=items.filter(t=>!t.completed),done=items.filter(t=>t.completed);
    return <Card className="task-group"><div className="task-group-heading"><div className="task-group-icon"><Icon name={zone==='important'?'target':'zap'} size={20}/></div><div><h3>{zone==='important'?'Самые важные':'Дополнительные'}</h3><span>{done.length} из {items.length} выполнено</span></div><button className="btn small outline" onClick={()=>setEditor({type:'task',day,priority:zone})}><Icon name="plus" size={16}/> Задача</button></div>
      <TaskList items={pending} zone={zone} emptyMessage={done.length?'Все задачи этой группы выполнены':'Добавь задачу, чтобы начать'}/>
      {!!done.length&&<div className="done-group"><button className="done-toggle" onClick={()=>setExpanded(p=>({...p,[zone]:!p[zone]}))} aria-expanded={!!expanded[zone]}><Icon name="check-circle" size={16}/> Выполнено · {done.length}<Icon name={expanded[zone]?'up':'down'} size={16}/></button>
        {expanded[zone]&&<TaskList zone={zone} items={done}/>}</div>}
    </Card>;
  };
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">ПЛАН НА ДЕНЬ</p><h1>Сегодня</h1><p>{prettyDay(day)}</p></div><div className="date-chooser"><button onClick={()=>setDay(dateAdd(day,-1))} aria-label="Предыдущий день"><Icon name="left"/></button><input aria-label="Дата задач" type="date" value={day} onChange={e=>setDay(e.target.value)}/><button onClick={()=>setDay(dateAdd(day,1))} aria-label="Следующий день"><Icon name="right"/></button></div></div>
    {day!==today&&<button className="pill-tab" onClick={()=>setDay(today)}>Вернуться к сегодняшнему дню</button>}
    <Card className="today-summary"><div className="today-numbers"><span className="eyebrow">ВЫПОЛНЕНИЕ ПЛАНА</span><span className="status-pill">{k.important&&k.important===k.doneImportant?'Главное закрыто':'Фокус на главном'}</span></div>
      <PlanScore important={k.important} doneImportant={k.doneImportant} extra={k.extra} doneExtra={k.doneExtra}/>
      <div className="summary-grid"><div><span>Важные</span><b>{progress(k.doneImportant,k.important)}%</b></div><div><span>Дополнительные</span><b>{progress(k.doneExtra,k.extra)}%</b></div></div></Card>
    <Card className="quick-plan-card"><div className="card-title-row"><div><h2>Из буфера — в план</h2><p className="tiny-note">Выбери задачу и нажми «В день»</p></div></div>
      <div className="quick-plan-form"><select aria-label="Задача из буфера" value={bufferId} onChange={e=>setBufferId(e.target.value)}><option value="">Выбрать задачу…</option>{buffer.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
      <select aria-label="Важность" value={bufferPriority} onChange={e=>setBufferPriority(e.target.value as 'important'|'extra')}><option value="important">Важная</option><option value="extra">Дополнительная</option></select>
      <button className="btn accent" type="button" disabled={!bufferId||moving} onClick={async()=>{const task=buffer.find(t=>t.id===bufferId);if(!task)return;setMoving(true);try{await saveTask({id:task.id,title:task.title,notes:task.notes,sphere:task.sphere,categoryId:task.os61_category_id||null,day,priority:bufferPriority});setBufferId('')}finally{setMoving(false)}}}>В день <Icon name="right" size={16}/></button></div>
    </Card>
    {important.some(t=>!t.completed)&&!os6.focus.some(f=>f.state!=='finished')&&<button className="btn accent today-start-focus" onClick={()=>{const t=important.find(x=>!x.completed);if(t)void mutate('os6','focus',{command:'start',title:t.title,task_id:t.id}).then(()=>open('focus')).catch(()=>{})}}><Icon name="play" size={18}/> Начать главное — фокус</button>}
    {group(important,'important')}{group(extra,'extra')}
    <button className="btn add-inline" onClick={()=>setEditor({type:'task',day,priority:'important'})}><Icon name="plus" size={20}/> Добавить задачу</button>
    <button className="link-action center" onClick={()=>open('buffer')}><Icon name="inbox" size={17}/> Открыть буфер задач <Icon name="right" size={15}/></button>
  </div>;
}
export function BufferPage(){
 const {buffer,categories,setEditor,saveTask}=useApp();
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[title,setTitle]=useState(''),[adding,setAdding]=useState(false);
 const matchCategory=(t:Task)=>categories.find(c=>c.id===t.os61_category_id)||categories.find(c=>c.name===t.sphere);
 const matching=buffer.filter(t=>(filter==='all'||matchCategory(t)?.id===filter)&&(t.title+' '+t.notes).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 const groupKeys=[...new Set(matching.map(t=>matchCategory(t)?.id||'uncategorized'))];
 const quick=async(e:React.FormEvent)=>{e.preventDefault();if(!title.trim())return;setAdding(true);
  try{await saveTask({title,categoryId:filter==='all'?'':filter,day:null,priority:'extra'});setTitle('');}finally{setAdding(false)};
 };
 return <div className="page-stack buffer-mvp"><div className="page-heading"><div><p className="eyebrow">ТВОИ ИДЕИ И ПРОЕКТЫ</p><h1>Буфер задач</h1><p>Создай запись сейчас, планируй подробно потом</p></div><button className="btn accent" onClick={()=>setEditor({type:'task',day:null})}><Icon name="plus"/> Задача</button></div>
  <Card className="buffer-quick"><form onSubmit={quick}><Icon name="plus" size={20}/><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Новая задача или идея…" maxLength={180} aria-label="Быстро добавить задачу"/><button type="submit" disabled={!title.trim()||adding}>{adding?'…':'Добавить'}</button></form></Card>
  <div className="buffer-categories" aria-label="Категории задач"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Все <span>{buffer.length}</span></button>{categories.map(c=><button key={c.id} className={filter===c.id?'active':''} onClick={()=>setFilter(c.id)}><i style={{background:c.color}}/>{c.name}<span>{buffer.filter(t=>matchCategory(t)?.id===c.id).length}</span></button>)}<QuickCategory/></div>
  <label className="buffer-search"><Icon name="search" size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по задачам и заметкам" aria-label="Поиск задач"/></label>
  {!matching.length?<Card><Empty title={buffer.length?'Ничего не найдено':'Буфер пока пуст'} description="Запиши задачу в одну строку — детали добавишь в её странице"/></Card>:groupKeys.map(id=>{
   const group=matching.filter(t=>(matchCategory(t)?.id||'uncategorized')===id);const cat=categories.find(c=>c.id===id);
   return <Card className="buffer-group" key={id}><SectionHead title={cat?.name||'Без категории'} caption={`${group.length} задач`}/><TaskList zone="buffer" items={group}/></Card>;
  })}
 </div>;
}
export function GoalsPage(){const{goals,goalHistory,setEditor}=useApp();
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">ТВОИ ОРИЕНТИРЫ</p><h1>Цели</h1><p>Обычные и амбициозные цели в одном месте</p></div><button className="btn accent" onClick={()=>setEditor({type:'goal'})}><Icon name="plus" size={18}/> Амбициозная</button></div>
    <Card><RegularGoals/></Card><SectionHead title="Амбициозные цели"/><div className="goals-grid">{goals.map(g=>{const percent=goalProgress(g),history=goalHistory.filter(p=>p.goal_id===g.id).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
      return <Card key={g.id} className="goal-full"><div className="goal-full-head"><div><span className="eyebrow">{g.sphere||'ЦЕЛЬ'}</span><h2>{g.title}</h2></div><div className="goal-value">{percent}<small>%</small></div></div>
        <div className="goal-current"><strong>{Number(g.current_value).toLocaleString('ru-RU')} {g.unit}</strong><span>из {Number(g.target_value).toLocaleString('ru-RU')} {g.unit}</span></div>
        <ProgressBar value={percent}/><Sparkline values={history.length?history.map(p=>Number(p.value)):[Number(g.start_value),Number(g.current_value)]}/>
        <div className="goal-full-footer"><span>Прогресс от старта · {history.length} обновлений</span><button className="btn small outline" onClick={()=>setEditor({type:'goal',item:g})}>Обновить <Icon name="right" size={15}/></button></div>
      </Card>})}
      {!goals.length&&<Card><Empty title="Добавь амбициозную цель" action={<button className="btn accent" onClick={()=>setEditor({type:'goal'})}>Создать цель</button>}/></Card>}
    </div>
  </div>;
}
export function GoalEditor(){const{editor,setEditor,saveGoal,deleteGoal}=useApp();const goal=editor?.type==='goal'?editor.item as Goal|undefined:undefined;
  const [title,setTitle]=useState(goal?.title||'');const [sphere,setSphere]=useState(goal?.sphere||'Личное');const [start,setStart]=useState(String(goal?.start_value??0));
  const [target,setTarget]=useState(String(goal?.target_value??100));const [current,setCurrent]=useState(String(goal?.current_value??0));const [unit,setUnit]=useState(goal?.unit||'');
  const [deadline,setDeadline]=useState(goal?.deadline||'');const[notes,setNotes]=useState(goal?.notes||'');const[busy,setBusy]=useState(false);
  return <form className="editor-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await saveGoal({id:goal?.id,title,sphere,start_value:start,target_value:target,current_value:current,unit,deadline,notes});}finally{setBusy(false)}}}>
    <label>Название цели<input autoFocus required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <div className="form-grid"><label>Старт<input required type="number" step="any" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Цель<input required type="number" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label></div>
    <div className="form-grid"><label>Сейчас<input required type="number" step="any" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>Единицы<input value={unit} maxLength={20} onChange={e=>setUnit(e.target.value)} placeholder="$ / кг / раз"/></label></div>
    <label>Сфера<input value={sphere} maxLength={60} onChange={e=>setSphere(e.target.value)}/></label>
    <details className="advanced-details"><summary>Дополнительно <Icon name="down" size={16}/></summary><label>Срок<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label>Описание<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label></details>
    <div className="form-actions">{goal&&<button type="button" className="btn danger-btn" onClick={()=>{void deleteGoal(goal);setEditor(null)}}>Удалить</button>}<button className="btn accent" type="submit" disabled={!title.trim()||Number(start)===Number(target)||busy}>Сохранить</button></div>
  </form>;
}
export function AnalyticsPage(){const{today,os6,metrics,legacyRows}=useApp();const[week,setWeek]=useState(mondayOf(today));const[rows,setRows]=useState<Record<string,DayMetrics>>(metrics);const[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;const load=async()=>{setBusy(true);try{const end=dateAdd(week,6),start=dateAdd(week,-7);const result=await request<{days:Record<string,DayMetrics>}>('os6','metrics',{start,end});if(active)setRows(result.days||{});}catch{/* existing data retained */}finally{if(active)setBusy(false)}};
    if(new URLSearchParams(location.search).get('demo')==='1')setRows(metrics);else void load();return()=>{active=false};
  },[week,metrics]);
  const dates=weekDates(week);const sum=sums(rows,dates);const prev=sums(rows,weekDates(dateAdd(week,-7)));
  const kpi=[{name:'Задачи',value:sum.tasks,goal:os6.settings.target_task,icon:'check-circle',color:'purple'},{name:'Продажи',value:sum.sales,goal:os6.settings.target_sale,icon:'wallet',color:'peach'},{name:'Спорт',value:sum.sport,goal:os6.settings.target_sport,icon:'dumbbell',color:'mint'}];
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">ПОКАЗАТЕЛИ</p><h1>Аналитика</h1><p>Твой прогресс в цифрах</p></div><div className="date-chooser"><button onClick={()=>setWeek(dateAdd(week,-7))} aria-label="Прошлая неделя"><Icon name="left"/></button><span>{shortDay(week)} — {shortDay(dateAdd(week,6))}</span><button disabled={week>=mondayOf(today)} onClick={()=>setWeek(dateAdd(week,7))} aria-label="Следующая неделя"><Icon name="right"/></button></div></div>
    <div className="analytics-top">{kpi.map(s=><Card key={s.name} className="analytics-kpi"><div className={`icon-wrap ${s.color}`}><Icon name={s.icon}/></div><p>{s.name}</p><strong>{s.value}<small> / {s.goal}</small></strong><ProgressBar value={progress(s.value,s.goal)}/></Card>)}</div>
    <Card className="analytics-graph"><div className="card-title-row"><div><span className="eyebrow">ДИНАМИКА</span><h2>Выполненные задачи</h2></div>{busy&&<Icon name="refresh"/>}</div><WeekBars days={dates} current={Object.fromEntries(dates.map(d=>[d,rows[d]?.tasks||0]))}/>
      <div className="analytics-legend"><span>К предыдущей неделе</span><strong>{sum.tasks-prev.tasks>0?'+':''}{sum.tasks-prev.tasks} задач</strong></div></Card>
    <Card><SectionHead title="По дням"/><div className="daily-table">{dates.map(d=><div className="daily-line" key={d}><span>{shortDay(d)}</span><strong>{rows[d]?.tasks||0}</strong><span>задач</span><span>{rows[d]?.sport||0} трен.</span></div>)}</div></Card>
    <p className="footnote">Исторические ручные записи до даты перехода сохранены в Supabase. Новые KPI рассчитываются из фактически выполненных задач, продаж и тренировок.</p>
  </div>;
}
