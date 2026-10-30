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
import {GoalSnapshot,GoalValues} from '../components/GoalValues';
import {PremiumAction} from '../components/PremiumControls';
import {QuickCategory} from '../components/QuickCategory';

const sums=(days:Record<string,DayMetrics>,dates:string[])=>dates.reduce((a,d)=>{const m=days[d];return {tasks:a.tasks+(m?.tasks||0),sales:a.sales+(m?.sales||0),sport:a.sport+(m?.sport||0)};},{tasks:0,sales:0,sport:0});
function dayKpi(tasks:Task[]){const imp=tasks.filter(t=>t.priority==='important');const extra=tasks.filter(t=>t.priority==='extra');
  return {important:imp.length,doneImportant:imp.filter(t=>t.completed).length,extra:extra.length,doneExtra:extra.filter(t=>t.completed).length,
    score:score(imp.length,imp.filter(t=>t.completed).length,extra.length,extra.filter(t=>t.completed).length)};
}

export function HomePage(){
 const {today,day,setDay,tasks,goals,goalHistory,os6,metrics,open,setEditor,openTaskPage,mutate}=useApp();
 const [startingFocus,setStartingFocus]=useState(false),[focusError,setFocusError]=useState('');
 useEffect(()=>{if(day!==today)setDay(today)},[today]);
 const k=dayKpi(tasks),dates=weekDates(mondayOf(today)),totals=sums(metrics,dates);
 const nextImportant=tasks.find(t=>t.priority==='important'&&!t.completed);
 const remaining=tasks.filter(t=>t.priority==='important'&&!t.completed).slice(0,3);
 const activeFocus=os6.focus.some(f=>f.state!=='finished');
 const allDone=k.important>0&&k.doneImportant===k.important;
 const beginFocus=async()=>{
  if(!nextImportant){open('today');return;}
  if(activeFocus){open('focus');return;}
  if(startingFocus)return;
  setStartingFocus(true);setFocusError('');
  try{await mutate('os6','focus',{command:'start',title:nextImportant.title,task_id:nextImportant.id});open('focus')}
  catch(e:any){setFocusError(e?.message||'Не получилось начать фокус. Попробуй снова.')}
  finally{setStartingFocus(false)}
 };
 return <div className="page-stack home-dashboard">
  <div className="hello-block"><div><p className="eyebrow">ТВОЯ ЛИЧНАЯ СИСТЕМА</p><h1>Добро пожаловать<span className="hello-dot">.</span></h1><p>Действуй точно. Прогресс придёт следом.</p></div><span className="date-chip"><Icon name="calendar" size={16}/>{shortDay(today)}</span></div>
  <div className="home-bento">
   <Card className="hero-result next-step-card">
    <div className="hero-orb orb1"/><div className="hero-orb orb2"/>
    <div className="hero-top"><span className="eyebrow">СЛЕДУЮЩИЙ ШАГ</span><Pill accent={allDone?'mint':'lavender'}>{allDone?'Главное сделано':nextImportant?'Самое важное':'Выбери направление'}</Pill></div>
    <h2 className="next-step-title">{nextImportant?nextImportant.title:allDone?'Главное на сегодня сделано':'Выбери главное на сегодня'}</h2>
    <p className="next-step-caption">{nextImportant?'Начни с одной задачи. Не нужно делать всё сразу.':allDone?'Можно перейти к дополнительному или свободно завершить работу.':'Назначь одну важную задачу, чтобы видеть конкретный следующий шаг.'}</p>
    <div className="next-step-actions">
     <PremiumAction onClick={()=>void beginFocus()} disabled={startingFocus} pending={startingFocus} pendingText="Начинаем…">
      <Icon name={nextImportant?'play':'calendar-check'} size={18}/>{nextImportant?(activeFocus?'Вернуться в фокус':'Начать фокус'):'Открыть план'}
     </PremiumAction>
     {nextImportant?<button className="btn outline" onClick={()=>void openTaskPage(nextImportant)}><Icon name="arrow-up-right" size={16}/> Открыть задачу</button>:<button className="btn subtle" onClick={()=>setEditor({type:'task',day:today,priority:'important'})}><Icon name="plus" size={16}/> Добавить важную</button>}
    </div>
    {focusError&&<p className="next-step-error" role="alert">{focusError}</p>}
    <div className="next-step-score"><div className="next-step-score-heading"><span>РЕЗУЛЬТАТ ДНЯ</span><button onClick={()=>open('today')} aria-label="Открыть план на сегодня">Весь план <Icon name="right" size={15}/></button></div>
     <PlanScore important={k.important} doneImportant={k.doneImportant} extra={k.extra} doneExtra={k.doneExtra}/>
     <div className="hero-sub"><span>Важные <b>{k.doneImportant}/{k.important}</b></span><span>Дополнительные <b>{k.doneExtra}/{k.extra}</b></span></div>
    </div>
   </Card>
   <div className="home-stat-grid actual-goals"><RegularGoals compact/></div>
  </div>
  <div className="home-second">
   <Card className="priority-card"><div className="card-title-row"><div><span className="eyebrow">ПЛАН</span><h2>Важные задачи</h2></div><button className="icon-btn" onClick={()=>setEditor({type:'task',day:today,priority:'important'})} aria-label="Добавить важную задачу"><Icon name="plus"/></button></div>
    {remaining.length?remaining.map(t=><button className="mini-task" key={t.id} onClick={()=>void openTaskPage(t)}><span className="mini-checkbox"/><span>{t.title}</span><Icon name="right" size={17}/></button>):
     <div className="success-spot"><Icon name="check-circle" size={26}/><strong>Главное под контролем</strong><span>{allDone?'Важные задачи выполнены':'Добавь первую важную задачу'}</span></div>}
    <PremiumAction tone="secondary" onClick={()=>open('focus')}><Icon name="timer" size={16}/> Начать с 5 минут</PremiumAction>
    <button className="link-action" onClick={()=>open('today')}>Весь список <Icon name="arrow-right" size={16}/></button>
   </Card>
   <Card className="week-overview"><div className="card-title-row"><div><span className="eyebrow">АКТИВНОСТЬ</span><h2>Неделя в цифрах</h2></div><button className="icon-btn" onClick={()=>open('analytics')} aria-label="Открыть аналитику"><Icon name="arrow-up-right"/></button></div>
    <WeekBars days={dates} current={Object.fromEntries(dates.map(d=>[d,metrics[d]?.tasks||0]))}/>
    <div className="week-footer"><span><i className="legend-lavender"/> Выполненные задачи</span><b>{totals.tasks} всего</b></div>
   </Card>
  </div>
  <div className="home-goals"><SectionHead title="Мои ориентиры" action={<button className="btn text" onClick={()=>open('goals')}>Все цели <Icon name="right" size={16}/></button>}/>
   <div className="goals-grid">{goals.slice(0,2).map(g=><GoalMini key={g.id} title={g.title} current={Number(g.current_value)} target={Number(g.target_value)} start={Number(g.start_value)} unit={g.unit} history={goalHistory.filter(x=>x.goal_id===g.id)} open={()=>open('goals')}/>)}
    {!goals.length&&<Card><Empty icon="target" title="Добавь первую цель" action={<button className="btn accent" onClick={()=>setEditor({type:'goal'})}>Создать цель</button>}/></Card>}
   </div>
  </div>
 </div>;
}


export function TodayPage(){
 const{day,setDay,today,tasks,buffer,saveTask,setEditor,open}=useApp();
 const k=dayKpi(tasks),important=tasks.filter(t=>t.priority==='important'),extra=tasks.filter(t=>t.priority==='extra');
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [bufferId,setBufferId]=useState(''),[bufferPriority,setBufferPriority]=useState<'important'|'extra'>('important');
 const [moving,setMoving]=useState(false),[pickerOpen,setPickerOpen]=useState(false),[moveError,setMoveError]=useState('');
 const transfer=async()=>{
  const task=buffer.find(t=>t.id===bufferId);if(!task||moving)return;
  setMoving(true);setMoveError('');
  try{await saveTask({id:task.id,title:task.title,notes:task.notes,sphere:task.sphere,categoryId:task.os61_category_id||null,day,priority:bufferPriority});setBufferId('');setPickerOpen(false)}
  catch(e:any){setMoveError(e?.message||'Не удалось перенести задачу. Попробуй снова.')}
  finally{setMoving(false)}
 };
 const group=(items:Task[],zone:'important'|'extra')=>{
  const pending=items.filter(t=>!t.completed),done=items.filter(t=>t.completed);
  return <Card className={'task-group today-task-group today-task-group--'+zone}><div className="task-group-heading"><div className="task-group-icon"><Icon name={zone==='important'?'target':'zap'} size={20}/></div><div><h3>{zone==='important'?'Самые важные':'Дополнительные'}</h3><span>{done.length} из {items.length} выполнено</span></div><button className="btn small outline" onClick={()=>setEditor({type:'task',day,priority:zone})}><Icon name="plus" size={16}/> Задача</button></div>
    <TaskList items={pending} zone={zone} emptyMessage={done.length?'Все задачи этой группы выполнены':'Добавь задачу, чтобы начать'}/>
    {!!done.length&&<div className="done-group"><button className="done-toggle" onClick={()=>setExpanded(p=>({...p,[zone]:!p[zone]}))} aria-expanded={!!expanded[zone]}><Icon name="check-circle" size={16}/> Выполнено · {done.length}<Icon name={expanded[zone]?'up':'down'} size={16}/></button>
      {expanded[zone]&&<TaskList zone={zone} items={done}/>}</div>}
   </Card>
 };
 return <div className="page-stack today-action-flow">
  <div className="page-heading"><div><p className="eyebrow">ПЛАН НА ДЕНЬ</p><h1>Сегодня</h1><p>{prettyDay(day)}</p></div><div className="date-chooser"><button onClick={()=>setDay(dateAdd(day,-1))} aria-label="Предыдущий день"><Icon name="left"/></button><input aria-label="Дата задач" type="date" value={day} onChange={e=>setDay(e.target.value)}/><button onClick={()=>setDay(dateAdd(day,1))} aria-label="Следующий день"><Icon name="right"/></button></div></div>
  {day!==today&&<button className="pill-tab" onClick={()=>setDay(today)}>Вернуться к сегодняшнему дню</button>}
  {group(important,'important')}
  <div className="today-after-important">
   <Card className="today-summary today-summary--compact"><div className="today-numbers"><span className="eyebrow">РЕЗУЛЬТАТ ДНЯ</span><span className="status-pill">{k.important&&k.important===k.doneImportant?'Главное закрыто':'Фокус на главном'}</span></div>
    <PlanScore important={k.important} doneImportant={k.doneImportant} extra={k.extra} doneExtra={k.doneExtra}/>
    <div className="summary-grid"><div><span>Важные</span><b>{progress(k.doneImportant,k.important)}%</b></div><div><span>Дополнительные</span><b>{progress(k.doneExtra,k.extra)}%</b></div></div>
   </Card>
   <div className="quick-plan-disclosure"><button className="btn outline quick-plan-toggle" aria-expanded={pickerOpen} aria-controls="today-buffer-picker" onClick={()=>setPickerOpen(v=>!v)}><Icon name="inbox" size={18}/> Из буфера {buffer.length>0?'· '+buffer.length:''}<Icon name={pickerOpen?'up':'down'} size={16}/></button>
    {pickerOpen&&<Card className="quick-plan-card" ><div id="today-buffer-picker"><div className="card-title-row"><div><h2>Перенести из буфера</h2><p className="tiny-note">Задача сохранит свой ID, категорию и связь с целью.</p></div></div>
     <div className="quick-plan-form"><select aria-label="Задача из буфера" value={bufferId} onChange={e=>setBufferId(e.target.value)}><option value="">Выбрать задачу…</option>{buffer.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
      <select aria-label="Важность" value={bufferPriority} onChange={e=>setBufferPriority(e.target.value as 'important'|'extra')}><option value="important">Важная</option><option value="extra">Дополнительная</option></select>
      <button className="btn accent" type="button" disabled={!bufferId||moving} onClick={()=>void transfer()}>{moving?'Переносим…':'В день'} <Icon name="right" size={16}/></button>
     </div>{moveError&&<p className="next-step-error" role="alert">{moveError}</p>}</div>
    </Card>}
   </div>
  </div>
  {group(extra,'extra')}
  <button className="btn add-inline" onClick={()=>setEditor({type:'task',day,priority:'important'})}><Icon name="plus" size={20}/> Добавить задачу</button>
  <button className="link-action center" onClick={()=>open('buffer')}><Icon name="inbox" size={17}/> Открыть буфер задач <Icon name="right" size={15}/></button>
 </div>;
}


export function BufferPage(){
 const {buffer,categories,setEditor,saveTask}=useApp();
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[title,setTitle]=useState(''),[adding,setAdding]=useState(false),[addError,setAddError]=useState('');
 const submitting=React.useRef(false),inputRef=React.useRef<HTMLInputElement>(null);
 const matchCategory=(t:Task)=>categories.find(c=>c.id===t.os61_category_id)||categories.find(c=>c.name===t.sphere);
 const matching=buffer.filter(t=>(filter==='all'||matchCategory(t)?.id===filter)&&(t.title+' '+t.notes).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 const groupKeys=[...new Set(matching.map(t=>matchCategory(t)?.id||'uncategorized'))];
 const quick=async(e:React.FormEvent)=>{
  e.preventDefault();if(!title.trim()||submitting.current)return;
  submitting.current=true;setAdding(true);setAddError('');
  try{await saveTask({title:title.trim(),categoryId:filter==='all'?'':filter,day:null,priority:'extra'});setTitle('');inputRef.current?.focus()}
  catch(e:any){setAddError(e?.message||'Не удалось сохранить. Попробуй снова.');inputRef.current?.focus()}
  finally{submitting.current=false;setAdding(false)}
 };
 return <div className="page-stack buffer-mvp buffer-action-flow">
  <div className="page-heading"><div><p className="eyebrow">ВВЕДИ СЕЙЧАС — РАЗБЕРЁШЬ ПОТОМ</p><h1>Буфер задач</h1><p>Одна строка для идеи. Детали добавишь позже.</p></div><button className="btn outline" onClick={()=>setEditor({type:'task',day:null})}><Icon name="settings" size={16}/> Подробно</button></div>
  <Card className="buffer-quick"><form onSubmit={quick}><Icon name="plus" size={20}/><input ref={inputRef} value={title} onChange={e=>{setTitle(e.target.value);if(addError)setAddError('')}} placeholder="Что нужно сделать?" maxLength={180} aria-label="Быстро добавить задачу"/><button type="submit" disabled={!title.trim()||adding}>{adding?'Сохраняю…':'Добавить'}</button></form></Card>
  {addError&&<p className="buffer-save-error" role="alert">{addError}</p>}
  <div className="buffer-categories" aria-label="Категории задач"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Все <span>{buffer.length}</span></button>{categories.map(c=><button key={c.id} className={filter===c.id?'active':''} onClick={()=>setFilter(c.id)}><i style={{background:c.color}}/>{c.name}<span>{buffer.filter(t=>matchCategory(t)?.id===c.id).length}</span></button>)}<QuickCategory/></div>
  <label className="buffer-search"><Icon name="search" size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по задачам и заметкам" aria-label="Поиск задач"/></label>
  {!matching.length?<Card><Empty title={buffer.length?'Ничего не найдено':'Буфер пока пуст'} description={buffer.length?'Попробуй другой запрос или сбрось фильтры.':'Запиши задачу в одну строку — детали добавишь в её странице.'} action={buffer.length?<button className="btn outline" onClick={()=>{setQuery('');setFilter('all')}}>Сбросить фильтры</button>:undefined}/></Card>:groupKeys.map(id=>{
   const group=matching.filter(t=>(matchCategory(t)?.id||'uncategorized')===id),cat=categories.find(c=>c.id===id);
   return <Card className="buffer-group" key={id}><SectionHead title={cat?.name||'Без категории'} caption={group.length+' задач'}/><TaskList zone="buffer" items={group}/></Card>
  })}
 </div>;
}

export function GoalsPage(){const{goals,goalHistory,setEditor,tasks,buffer,os6,openTaskPage}=useApp();
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">ТВОИ ОРИЕНТИРЫ</p><h1>Цели</h1><p>Обычные и амбициозные цели в одном месте</p></div><button className="btn accent" onClick={()=>setEditor({type:'goal'})}><Icon name="plus" size={18}/> Амбициозная</button></div>
    <Card><RegularGoals/></Card><SectionHead title="Амбициозные цели"/><div className="goals-grid">{goals.map(g=>{const percent=goalProgress(g),history=goalHistory.filter(p=>p.goal_id===g.id).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
      return <Card key={g.id} className="goal-full"><div className="goal-full-head"><div><span className="eyebrow">{g.sphere||'ЦЕЛЬ'}</span><h2>{g.title}</h2></div><div className="goal-value">{percent}<small>%</small></div></div>
        <GoalValues current={Number(g.current_value)} target={Number(g.target_value)} start={Number(g.start_value)} unit={g.unit}/>
        <ProgressBar value={percent}/>{(()=>{const ids=new Set(os6.links.filter(l=>l.goal_id===g.id).map(l=>l.task_id));const candidate=[...tasks,...buffer].find(t=>ids.has(t.id)&&!t.completed);return candidate?<button className="goal-next-action" onClick={()=>void openTaskPage(candidate)}><Icon name="arrow-right" size={15}/><span>Следующий шаг: <strong>{candidate.title}</strong></span></button>:null})()}<Sparkline values={history.length?history.map(p=>Number(p.value)):[Number(g.start_value),Number(g.current_value)]}/>
        <div className="goal-full-footer"><span>Прогресс от старта · {history.length} обновлений</span><button className="btn small outline" onClick={()=>setEditor({type:'goal',item:g})}>Обновить <Icon name="right" size={15}/></button></div>
      </Card>})}
      {!goals.length&&<Card><Empty title="Добавь амбициозную цель" action={<button className="btn accent" onClick={()=>setEditor({type:'goal'})}>Создать цель</button>}/></Card>}
    </div>
  </div>;
}
export function GoalEditor(){
 const{editor,setEditor,saveGoal,deleteGoal}=useApp();
 const goal=editor?.type==='goal'?editor.item as Goal|undefined:undefined;
 const [title,setTitle]=useState(goal?.title||'');
 const [sphere,setSphere]=useState(goal?.sphere||'Личное');
 const [start,setStart]=useState(String(goal?.start_value??0));
 const [target,setTarget]=useState(String(goal?.target_value??100));
 const [current,setCurrent]=useState(String(goal?.current_value??0));
 const [unit,setUnit]=useState(goal?.unit||'');
 const [deadline,setDeadline]=useState(goal?.deadline||'');
 const [notes,setNotes]=useState(goal?.notes||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const finite=(raw:string)=>raw.trim()!==''&&Number.isFinite(Number(raw));
 const valid=finite(start)&&finite(target)&&finite(current)&&Number(start)!==Number(target);
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!valid||busy)return;
  setError('');setBusy(true);
  try{await saveGoal({id:goal?.id,title,sphere,start_value:start,target_value:target,current_value:current,unit,deadline,notes})}
  catch(err:any){setError(err?.message||'Не удалось сохранить цель. Данные остались в форме.')}
  finally{setBusy(false)}
 };
 return <form className="editor-form goal-measure-editor" onSubmit={e=>void save(e)}>
  <label>Название цели<input autoFocus required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, Вес или Месячный доход"/></label>
  <div className="form-grid"><label>Стартовое значение<input required type="number" step="any" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label>Целевое значение<input required type="number" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label></div>
  <div className="form-grid"><label>Текущее значение<input required type="number" step="any" value={current} onChange={e=>setCurrent(e.target.value)}/></label>
   <label>Единицы измерения<input value={unit} maxLength={20} onChange={e=>setUnit(e.target.value)} placeholder="USD, кг, раз"/></label></div>
  {!valid?<p className="goal-snapshot-validation" role="alert">Введи числа для всех значений. Старт и цель должны различаться.</p>
    :<GoalSnapshot start={Number(start)} current={Number(current)} target={Number(target)} unit={unit}/>}
  <label>Сфера<input value={sphere} maxLength={60} onChange={e=>setSphere(e.target.value)}/></label>
  <details className="advanced-details"><summary>Дополнительно <Icon name="down" size={16}/></summary><label>Срок<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label>Описание<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label></details>
  {error&&<div className="os-error-banner" role="alert">{error}</div>}
  <div className="form-actions">{goal&&<button type="button" className="btn danger-btn" disabled={busy} onClick={()=>{void deleteGoal(goal);setEditor(null)}}>Удалить</button>}
   <button className="btn accent" type="submit" disabled={!title.trim()||!valid||busy}>{busy?'Сохраняем…':'Сохранить'}</button></div>
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
