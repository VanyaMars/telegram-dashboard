import React,{useEffect,useMemo,useState} from 'react';
import {useApp} from '../AppContext';
import {Icon} from '../components/Icons';
import {Card,Dialog,Empty,GoalMini,Pill,ProgressBar,SectionHead,Sparkline,WeekBars} from '../components/UI';
import {TaskLibrary,type TaskLibraryView} from '../components/TaskLibrary';
import {TaskList} from '../components/Tasks';
import type {DayMetrics,Goal,Task} from '../types';
import {dateAdd,goalProgress,monthDays,mondayOf,prettyDay,progress,shortDay,weekDates} from '../lib/date';
import {request} from '../lib/api';
import {RegularGoals} from '../components/RegularGoals';
import {GoalsWorkspace} from '../components/GoalsWorkspace';
import {readGoalDocument} from '../lib/goalDocument';
import {PlanScore} from '../components/PlanScore';
import {GoalSnapshot,GoalValues} from '../components/GoalValues';
import {PremiumAction} from '../components/PremiumControls';
import {QuickCategory} from '../components/QuickCategory';
import {useTaskCardMeta} from '../components/TaskCardMeta';
import '../task-polish-v2.css';
import '../today.css';

const sums=(days:Record<string,DayMetrics>,dates:string[])=>dates.reduce((a,d)=>{const m=days[d];return {tasks:a.tasks+(m?.tasks||0),sales:a.sales+(m?.sales||0),sport:a.sport+(m?.sport||0)};},{tasks:0,sales:0,sport:0});
function dayKpi(tasks:Task[]){const imp=tasks.filter(t=>t.priority==='important');const extra=tasks.filter(t=>t.priority==='extra');
  return {important:imp.length,doneImportant:imp.filter(t=>t.completed).length,extra:extra.length,doneExtra:extra.filter(t=>t.completed).length};
}
function pluralCount(value:number,forms:string[]){const mod10=value%10,mod100=value%100;return forms[mod10===1&&mod100!==11?0:mod10>=2&&mod10<=4&&(mod100<12||mod100>14)?1:2]||forms[2]}
function progressLevel(value:number){if(value>=100)return'complete';if(value>=75)return'near';if(value>=50)return'momentum';if(value>=25)return'building';if(value>0)return'start';return'rest'}

export function HomePage(){
 const {today,day,setDay,tasks,goals,goalHistory,metrics,open,setEditor,openTaskPage}=useApp();
 useEffect(()=>{if(day!==today)setDay(today)},[today]);
 const k=dayKpi(tasks),dates=weekDates(mondayOf(today)),totals=sums(metrics,dates);
 const nextImportant=tasks.find(t=>t.priority==='important'&&!t.completed);
 const remaining=tasks.filter(t=>t.priority==='important'&&!t.completed).slice(0,3);
 const allDone=k.important>0&&k.doneImportant===k.important;
 return <div className="page-stack home-dashboard">
  <div className="hello-block"><div><h1>Добро пожаловать<span className="hello-dot">.</span></h1></div><span className="date-chip"><Icon name="calendar" size={16}/>{shortDay(today)}</span></div>
  <div className="home-bento">
   <Card className="hero-result next-step-card">
    <div className="hero-orb orb1"/><div className="hero-orb orb2"/>
    <div className="hero-top"><span className="eyebrow">СЛЕДУЮЩИЙ ШАГ</span><Pill accent={allDone?'mint':'lavender'}>{allDone?'Главное сделано':nextImportant?'Самое важное':'Выбери направление'}</Pill></div>
    <h2 className="next-step-title">{nextImportant?nextImportant.title:allDone?'Главное на сегодня сделано':'Выбери главное на сегодня'}</h2>
    <p className="next-step-caption">{nextImportant?'Начни с одной задачи. Не нужно делать всё сразу.':allDone?'Можно перейти к дополнительному или свободно завершить работу.':'Назначь одну важную задачу, чтобы видеть конкретный следующий шаг.'}</p>
    <div className="next-step-actions">
     <PremiumAction onClick={()=>{if(nextImportant)void openTaskPage(nextImportant);else open('today')}}><Icon name={nextImportant?'arrow-up-right':'calendar-check'} size={18}/>{nextImportant?'Открыть задачу':'Открыть план'}</PremiumAction>
     <button className="btn outline" onClick={()=>nextImportant?open('today'):setEditor({type:'task',day:today,priority:'important'})}><Icon name={nextImportant?'calendar':'plus'} size={16}/>{nextImportant?'К плану':'Добавить важную'}</button>
    </div>
    <div className="next-step-score"><div className="next-step-score-heading"><span>РЕЗУЛЬТАТ ДНЯ</span><button onClick={()=>open('today')} aria-label="Открыть план на сегодня">Весь план <Icon name="right" size={15}/></button></div>
     <PlanScore important={k.important} doneImportant={k.doneImportant} extra={k.extra} doneExtra={k.doneExtra}/>
     <div className="hero-sub"><span>Важные <b>{k.doneImportant}/{k.important}</b></span><span>Дополнительные <b>{k.doneExtra}/{k.extra}</b></span></div>
    </div>
   </Card>
   <div className="home-stat-grid actual-goals"><RegularGoals compact/></div>
  </div>
  <div className="home-second">
   {remaining.length>0&&<Card className="priority-card"><div className="card-title-row"><div><span className="eyebrow">ПЛАН</span><h2>Важные задачи</h2></div><button className="icon-btn" onClick={()=>setEditor({type:'task',day:today,priority:'important'})} aria-label="Добавить важную задачу"><Icon name="plus"/></button></div>
    {remaining.length?remaining.map(t=><button className="mini-task" key={t.id} onClick={()=>void openTaskPage(t)}><span className="mini-checkbox"/><span>{t.title}</span><Icon name="right" size={17}/></button>):
     <div className="success-spot"><Icon name="check-circle" size={26}/><strong>Главное под контролем</strong><span>{allDone?'Важные задачи выполнены':'Добавь первую важную задачу'}</span></div>}
    <button className="link-action" onClick={()=>open('today')}>Весь список <Icon name="arrow-right" size={16}/></button>
   </Card>}
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
 const {day,setDay,today,tasks,buffer,categories,saveTask,setEditor,calendarTasks,getCalendar}=useApp();
 const pending=tasks.filter(task=>!task.completed),completed=tasks.filter(task=>task.completed);
 const percent=tasks.length?progress(completed.length,tasks.length):0;
 const cardMeta=useTaskCardMeta(tasks.map(task=>task.id));
 const [completedOpen,setCompletedOpen]=useState(false);
 const [moving,setMoving]=useState(false),[pickerOpen,setPickerOpen]=useState(false),[moveError,setMoveError]=useState('');
 const [datePickerOpen,setDatePickerOpen]=useState(false),[calendarMonth,setCalendarMonth]=useState(day.slice(0,7)),[calendarSelection,setCalendarSelection]=useState(day),[calendarLoading,setCalendarLoading]=useState(false);
 const [bufferQuery,setBufferQuery]=useState(''),[categoryFilter,setCategoryFilter]=useState('all'),[selectedBuffer,setSelectedBuffer]=useState<string[]>([]);
 const visibleBuffer=useMemo(()=>buffer.filter(task=>{
  const category=categories.find(item=>item.id===task.os61_category_id)||categories.find(item=>item.name===task.sphere);
  const matchesCategory=categoryFilter==='all'||(categoryFilter==='uncategorized'?!category:category?.id===categoryFilter);
  const matchesQuery=(task.title+' '+task.notes).toLocaleLowerCase('ru').includes(bufferQuery.trim().toLocaleLowerCase('ru'));
  return matchesCategory&&matchesQuery;
 }),[buffer,categories,categoryFilter,bufferQuery]);
 const toggleBufferSelection=(id:string)=>setSelectedBuffer(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
 const closePicker=()=>{if(moving)return;setPickerOpen(false);setMoveError('');setSelectedBuffer([]);setBufferQuery('');setCategoryFilter('all')};
 const transferSelected=async()=>{
  const selected=buffer.filter(task=>selectedBuffer.includes(task.id));if(!selected.length||moving)return;
  setMoving(true);setMoveError('');const moved:string[]=[];
  try{
   for(const task of selected){
    await saveTask({id:task.id,title:task.title,notes:task.notes,sphere:task.sphere,categoryId:task.os61_category_id||categories.find(item=>item.name===task.sphere)?.id||null,day,priority:task.priority});
    moved.push(task.id);
   }
   setPickerOpen(false);setMoveError('');setSelectedBuffer([]);setBufferQuery('');setCategoryFilter('all');
  }catch(e:any){
   setSelectedBuffer(current=>current.filter(id=>!moved.includes(id)));
   setMoveError(e?.message||'Не удалось перенести все задачи. Оставшиеся можно добавить повторно.');
  }finally{setMoving(false)}
 };
 const inWork=tasks.length-completed.length;
 const statusText=!tasks.length?'Добавь задачи, чтобы собрать план дня':!inWork?`Все ${tasks.length} ${pluralCount(tasks.length,['задача','задачи','задач'])} готовы`:!completed.length?`${inWork} ${pluralCount(inWork,['задача','задачи','задач'])} в работе`:`${completed.length} ${pluralCount(completed.length,['задача готова','задачи готовы','задач готовы'])}, ещё ${inWork} ${pluralCount(inWork,['задача','задачи','задач'])} в работе`;
 const pipelineTasks=tasks.filter(task=>(cardMeta[task.id]?.pipelineCount||0)>0);
 const pipelineCount=pipelineTasks.reduce((sum,task)=>sum+(cardMeta[task.id]?.pipelineCount||0),0);
 const pipelineActions=pipelineTasks.reduce((sum,task)=>sum+(cardMeta[task.id]?.pipelineActions||0),0);
 const waitingCount=tasks.length-pipelineTasks.length;
 const analysisLoading=tasks.some(task=>!cardMeta[task.id]);
 const calendarStart=`${calendarMonth}-01`;
 const calendarCount=monthDays(calendarStart);
 const calendarPad=(new Date(`${calendarStart}T12:00:00Z`).getUTCDay()+6)%7;
 const selectedDayTasks=calendarSelection===day?tasks:calendarTasks.filter(task=>task.day===calendarSelection);
 const selectedDayDone=selectedDayTasks.filter(task=>task.completed).length;
 const dateButtonLabel=new Date(`${day}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
 const weekdayLabel=new Date(`${day}T12:00:00Z`).toLocaleDateString('ru-RU',{weekday:'long',timeZone:'UTC'});
 useEffect(()=>{
  if(!datePickerOpen)return;
  const end=`${calendarMonth}-${String(monthDays(`${calendarMonth}-01`)).padStart(2,'0')}`;
  setCalendarLoading(true);
  void getCalendar(`${calendarMonth}-01`,end).finally(()=>setCalendarLoading(false));
 },[datePickerOpen,calendarMonth]);
 const openDatePicker=()=>{setCalendarMonth(day.slice(0,7));setCalendarSelection(day);setDatePickerOpen(true)};
 const shiftCalendarMonth=(amount:number)=>{
  const first=new Date(`${calendarMonth}-01T12:00:00Z`);first.setUTCMonth(first.getUTCMonth()+amount);
  setCalendarMonth(first.toISOString().slice(0,7));
 };

 return <div className="page-stack today-action-flow">
  <div className="page-heading">
   <div><h1>Сегодня</h1></div>
   <div className="today-date-chooser">
    <button type="button" onClick={()=>setDay(dateAdd(day,-1))} aria-label="Предыдущий день"><Icon name="left"/></button>
    <button type="button" className="today-date-trigger" onClick={openDatePicker} aria-label={`Выбрать дату, сейчас ${prettyDay(day)}`}><span>{dateButtonLabel}</span><small>{weekdayLabel}</small><Icon name="calendar" size={17}/></button>
    <button type="button" onClick={()=>setDay(dateAdd(day,1))} aria-label="Следующий день"><Icon name="right"/></button>
   </div>
  </div>
  {day!==today&&<button className="pill-tab today-return" onClick={()=>setDay(today)}>Вернуться к сегодняшнему дню</button>}
  <Card className="today-summary today-summary--compact">
   <div className="today-progress-heading"><div><strong className="today-status-copy">{statusText}</strong></div><strong className="today-percent">{percent}%</strong></div>
   <div className="today-progress-track" data-level={progressLevel(percent)} role="progressbar" aria-label="Выполнение задач дня" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span className="today-progress-fill" style={{width:percent+'%'}}/></div>
   <div className="today-progress-scale"><span>{completed.length} готово</span><span>{tasks.length} задач</span></div>
   <div className="today-analytics-line" aria-label="Аналитика плана">
    <span><Icon name="list" size={14}/><strong>{analysisLoading?'…':pipelineActions}</strong> {pluralCount(pipelineActions,['шаг','шага','шагов'])} <i>·</i> {analysisLoading?'…':pipelineCount} Pipeline</span>
    <span><Icon name="clock" size={14}/>{analysisLoading?'…':waitingCount?`${waitingCount} без плана`:'Всё запланировано'}</span>
   </div>
  </Card>
  <Dialog open={datePickerOpen} onClose={()=>setDatePickerOpen(false)} title="Выбрать день" className="today-calendar-dialog">
   <div className="today-calendar-content">
    <div className="today-calendar-month"><button type="button" onClick={()=>shiftCalendarMonth(-1)} aria-label="Предыдущий месяц"><Icon name="left"/></button><strong>{new Date(`${calendarMonth}-01T12:00:00Z`).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" onClick={()=>shiftCalendarMonth(1)} aria-label="Следующий месяц"><Icon name="right"/></button></div>
    <div className="today-calendar-grid" aria-label="Календарь задач">
     {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(label=><span className="today-calendar-weekday" key={label}>{label}</span>)}
     {Array.from({length:calendarPad},(_,index)=><span className="today-calendar-empty" role="presentation" key={`blank-${index}`}/>)}
     {Array.from({length:calendarCount},(_,index)=>{const date=`${calendarMonth}-${String(index+1).padStart(2,'0')}`;const count=calendarTasks.filter(task=>task.day===date).length;return <button type="button" aria-label={`${index+1}${count?`, ${count} задач`:''}`} aria-pressed={calendarSelection===date} aria-current={date===today?'date':undefined} className={'today-calendar-day '+(calendarSelection===date?'is-selected ':'')+(date===today?'is-today':'')} onClick={()=>setCalendarSelection(date)} key={date}><span>{index+1}</span>{count>0&&<i><b/></i>}</button>})}
    </div>
    <div className="today-calendar-agenda">
     <div><strong>{prettyDay(calendarSelection)}</strong><span>{calendarLoading&&calendarSelection!==day?'Загружаем…':selectedDayTasks.length?`${selectedDayDone} из ${selectedDayTasks.length} готово`:'План пока пуст'}</span></div>
     {selectedDayTasks.length>0&&<ul>{selectedDayTasks.slice(0,3).map(task=><li key={task.id} className={task.completed?'is-done':''}>{task.title}</li>)}</ul>}
     <button type="button" className="btn accent" onClick={()=>{setDay(calendarSelection);setDatePickerOpen(false)}}>{selectedDayTasks.length?'Открыть план дня':'Запланировать день'}<Icon name="right" size={16}/></button>
    </div>
   </div>
  </Dialog>
  <Card className="today-task-group">
   <div className="today-list-heading">
    <h2>Задачи</h2>
    <div className="today-list-actions">
     <button type="button" className="btn outline quick-plan-toggle" aria-expanded={pickerOpen} aria-controls={pickerOpen?'today-buffer-picker':undefined} onClick={()=>setPickerOpen(true)}><Icon name="inbox" size={17}/> Из буфера</button>
     <button type="button" className="btn accent" onClick={()=>setEditor({type:'task',day,priority:'extra'})}><Icon name="plus" size={18}/> Задача</button>
    </div>
   </div>
   <Dialog open={pickerOpen} onClose={closePicker} title="Добавить из буфера" className="today-buffer-dialog">
    <div id="today-buffer-picker" className="today-picker-content">
     <label className="today-picker-search"><Icon name="search" size={18}/><input autoFocus type="search" value={bufferQuery} onChange={event=>setBufferQuery(event.target.value)} placeholder="Найти задачу" aria-label="Поиск задач в буфере"/></label>
     <div className="today-picker-categories" role="group" aria-label="Фильтр по категории">
      <button type="button" className={categoryFilter==='all'?'is-active':''} onClick={()=>setCategoryFilter('all')}>Все <span>{buffer.length}</span></button>
      {buffer.some(task=>!(categories.find(item=>item.id===task.os61_category_id)||categories.find(item=>item.name===task.sphere)))&&<button type="button" className={categoryFilter==='uncategorized'?'is-active':''} onClick={()=>setCategoryFilter('uncategorized')}>Без категории <span>{buffer.filter(task=>!(categories.find(item=>item.id===task.os61_category_id)||categories.find(item=>item.name===task.sphere))).length}</span></button>}
      {categories.map(category=><button type="button" key={category.id} className={categoryFilter===category.id?'is-active':''} onClick={()=>setCategoryFilter(category.id)}><i style={{background:category.color}}/>{category.name}<span>{buffer.filter(task=>task.os61_category_id===category.id||(!task.os61_category_id&&task.sphere===category.name)).length}</span></button>)}
     </div>
     <div className="today-picker-results" role="group" aria-label="Задачи из буфера">
      {!buffer.length?<div className="today-picker-empty"><Icon name="inbox" size={22}/><strong>Буфер пуст</strong><span>Добавь задачу в буфер, и она появится здесь.</span></div>
       :!visibleBuffer.length?<div className="today-picker-empty"><Icon name="search" size={22}/><strong>Ничего не найдено</strong><span>Измени поиск или выбери другую категорию.</span></div>
       :visibleBuffer.map(task=>{const category=categories.find(item=>item.id===task.os61_category_id)||categories.find(item=>item.name===task.sphere);const selected=selectedBuffer.includes(task.id);return <label className={'today-picker-task '+(selected?'is-selected':'')} key={task.id}><input type="checkbox" checked={selected} onChange={()=>toggleBufferSelection(task.id)}/><span className="today-picker-check"><Icon name="check" size={14}/></span><span className="today-picker-task-copy"><strong>{task.title}</strong><small>{category&&<><i style={{background:category.color}}/>{category.name}</>}{task.notes&&<span>{task.notes}</span>}</small></span><span className="today-picker-priority">{task.priority==='important'?'Важная':'Обычная'}</span></label>})}
     </div>
     {moveError&&<p className="today-picker-error" role="alert">{moveError}</p>}
     <div className="today-picker-footer"><span>{selectedBuffer.length?`Выбрано: ${selectedBuffer.length}`:'Отметь одну или несколько задач'}</span><button className="btn accent" type="button" disabled={!selectedBuffer.length||moving} onClick={()=>void transferSelected()}>{moving?'Добавляем…':`Добавить выбранные${selectedBuffer.length?` · ${selectedBuffer.length}`:''}`}<Icon name="arrow-right" size={16}/></button></div>
    </div>
   </Dialog>
   <TaskList items={pending} zone="today" cardMeta={cardMeta} emptyMessage={completed.length?'Все задачи на этот день выполнены':'На этот день пока нет задач'}/>
   {completed.length>0&&<div className="done-group today-done-group">
    <button type="button" className="done-toggle today-done-toggle" onClick={()=>setCompletedOpen(value=>!value)} aria-expanded={completedOpen} aria-controls={completedOpen?'today-completed':undefined}>
     <Icon name="check-circle" size={17}/> Выполнено <span>{completed.length}</span><Icon name={completedOpen?'up':'down'} size={16}/>
    </button>
    {completedOpen&&<div id="today-completed"><TaskList items={completed} zone="today" cardMeta={cardMeta}/></div>}
   </div>}
  </Card>
 </div>;
}


export function BufferPage(){
 const [view,setView]=useState<'active'|TaskLibraryView>(()=>{const saved=sessionStorage.getItem('os-task-view');return ['working','completed','templates','archive'].includes(saved||'')?saved as TaskLibraryView:'active'});
 const {buffer,categories,setEditor,saveTask,saveCategory}=useApp();
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[title,setTitle]=useState(''),[adding,setAdding]=useState(false),[addError,setAddError]=useState('');
 const [categoryPicker,setCategoryPicker]=useState(false),[creatingCategory,setCreatingCategory]=useState(false),[newCategoryName,setNewCategoryName]=useState('');
 const submitting=React.useRef(false),inputRef=React.useRef<HTMLInputElement>(null);
 const matchCategory=(t:Task)=>categories.find(c=>c.id===t.os61_category_id)||categories.find(c=>c.name===t.sphere);
 const matching=buffer.filter(t=>(filter==='all'||matchCategory(t)?.id===filter)&&(t.title+' '+t.notes).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 const groupKeys=[...new Set(matching.map(t=>matchCategory(t)?.id||'uncategorized'))];
 const quick=(e:React.FormEvent)=>{e.preventDefault();if(!title.trim()||adding)return;setAddError('');setCategoryPicker(true)};
 const createWithCategory=async(categoryId:string)=>{
  if(!title.trim()||submitting.current)return;submitting.current=true;setAdding(true);setAddError('');
  try{await saveTask({title:title.trim(),categoryId,day:null,priority:'extra'});setTitle('');setCategoryPicker(false);setCreatingCategory(false);setNewCategoryName('');inputRef.current?.focus()}
  catch(err:any){setAddError(err?.message||'Не удалось сохранить задачу. Повтори попытку.')}
  finally{submitting.current=false;setAdding(false)}
 };
 const createNewCategory=async(e:React.FormEvent)=>{
  e.preventDefault();if(!newCategoryName.trim()||submitting.current)return;submitting.current=true;setAdding(true);setAddError('');
  try{
   const created=await saveCategory({name:newCategoryName.trim(),color:'#8B84ED',icon:'folder'});
   if(!created?.id)throw Error('Категория создана, но её идентификатор не получен');
   await saveTask({title:title.trim(),categoryId:created.id,day:null,priority:'extra'});
   setTitle('');setCategoryPicker(false);setCreatingCategory(false);setNewCategoryName('');inputRef.current?.focus();
  }catch(err:any){setAddError(err?.message||'Не удалось создать категорию или задачу. Попробуй снова.')}
  finally{submitting.current=false;setAdding(false)}
 };

 return <div className="page-stack buffer-mvp buffer-action-flow">
  <div className="page-heading"><div><h1>Буфер задач</h1></div><button className="btn outline" onClick={()=>setEditor({type:'task',day:null})}><Icon name="settings" size={16}/> Подробно</button></div>
  <div className="task-view-tabs" role="tablist" aria-label="Списки задач">{([['active','Активные'],['working','В работе'],['completed','Завершённые'],['templates','Шаблоны'],['archive','Архив']] as const).map(([id,label])=><button role="tab" key={id} aria-selected={view===id} onClick={()=>{setView(id);sessionStorage.setItem('os-task-view',id);setQuery('')}}>{label}</button>)}</div>
  {view==='active'&&<><Card className="buffer-quick"><form onSubmit={quick}><Icon name="plus" size={20}/><input ref={inputRef} value={title} onChange={e=>{setTitle(e.target.value);if(addError)setAddError('')}} placeholder="Что нужно сделать?" maxLength={180} aria-label="Быстро добавить задачу"/><button type="submit" disabled={!title.trim()||adding}>{adding?'Сохраняю…':'Добавить'}</button></form></Card>
  <Dialog open={categoryPicker} onClose={()=>{if(!adding){setCategoryPicker(false);setCreatingCategory(false)}}} title="Категория новой задачи">
   <div className="buffer-category-picker">
    <p className="buffer-category-preview">«{title.trim()}»</p>
    <div className="buffer-category-choice-list" role="group" aria-label="Выбрать категорию для задачи">
     {categories.map(cat=><button type="button" key={cat.id} disabled={adding} onClick={()=>void createWithCategory(cat.id)}><span className="buffer-category-dot" style={{background:cat.color}}/>{cat.name}</button>)}
    </div>
    {!creatingCategory?<button type="button" className="buffer-category-new" disabled={adding} onClick={()=>setCreatingCategory(true)}><Icon name="plus" size={16}/>Создать категорию</button>
    :<form className="buffer-category-new-form" onSubmit={e=>void createNewCategory(e)}><label>Название категории<input autoFocus maxLength={60} value={newCategoryName} aria-label="Название категории для задачи" onChange={e=>setNewCategoryName(e.target.value)} placeholder="Новая категория"/></label><div><button type="submit" disabled={!newCategoryName.trim()||adding}>Создать и добавить</button><button type="button" onClick={()=>setCreatingCategory(false)} disabled={adding}>Отмена</button></div></form>}
    {addError&&<p role="alert" className="buffer-save-error">{addError}</p>}
    <button type="button" className="buffer-category-skip" disabled={adding} onClick={()=>void createWithCategory('')}>Добавить без категории</button>
   </div>
  </Dialog>
  {addError&&<p className="buffer-save-error" role="alert">{addError}</p>}
  <div className="buffer-categories" aria-label="Категории задач"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Все <span>{buffer.length}</span></button>{categories.map(c=><button key={c.id} className={filter===c.id?'active':''} onClick={()=>setFilter(c.id)}><i style={{background:c.color}}/>{c.name}<span>{buffer.filter(t=>matchCategory(t)?.id===c.id).length}</span></button>)}<QuickCategory/></div>
  </>}<label className="buffer-search"><Icon name="search" size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={view==='active'?'Поиск по задачам и заметкам':'Поиск по названию'} aria-label="Поиск задач"/></label>
  {view!=='active'?<TaskLibrary view={view} query={query}/>:!matching.length?<Card><Empty title={buffer.length?'Ничего не найдено':'Буфер пока пуст'} description={buffer.length?'Попробуй другой запрос или сбрось фильтры.':'Запиши задачу в одну строку — детали добавишь в её странице.'} action={buffer.length?<button className="btn outline" onClick={()=>{setQuery('');setFilter('all')}}>Сбросить фильтры</button>:undefined}/></Card>:groupKeys.map(id=>{
   const group=matching.filter(t=>(matchCategory(t)?.id||'uncategorized')===id),cat=categories.find(c=>c.id===id);
   return <Card className="buffer-group" key={id}><SectionHead title={cat?.name||'Без категории'} caption={group.length+' задач'}/><TaskList zone="buffer" items={group}/></Card>
  })}
 </div>;
}

export function GoalsPage(){return <GoalsWorkspace/>;}
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
 const [notes,setNotes]=useState(readGoalDocument(goal?.notes).body);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const finite=(raw:string)=>raw.trim()!==''&&Number.isFinite(Number(raw));
 const valid=finite(start)&&finite(target)&&finite(current)&&Number(start)!==Number(target);
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!valid||busy)return;
  setError('');setBusy(true);
  try{
   const legacy=readGoalDocument(goal?.notes);
   // Old v1 metadata must be migrated before the notes are cleaned.
   if(goal?.id&&(legacy.fields.length||legacy.closedAt))
    await request('os8','goal_document_save',{kind:'strategic',goalId:goal.id,fields:legacy.fields,closedAt:legacy.closedAt,notesBody:notes});
   await saveGoal({id:goal?.id,title,sphere,start_value:start,target_value:target,current_value:current,unit,deadline,notes});
  }
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
