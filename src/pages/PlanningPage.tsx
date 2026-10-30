import React,{useRef,useState} from 'react';
import {useApp} from '../AppContext';
import {Card,Empty,SectionHead} from '../components/UI';
import {Icon} from '../components/Icons';
import {dateAdd,prettyDay} from '../lib/date';

export function PlanningPage(){
 const {today,buffer,saveTask,setEditor,open,setDay,getCalendar,calendarTasks}=useApp();
 const [target,setTarget]=useState(dateAdd(today,1)),[selected,setSelected]=useState<string[]>([]),[kind,setKind]=useState<'important'|'extra'>('important'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [query,setQuery]=useState('');
 const submitting=useRef(false);
 const current=calendarTasks.filter(t=>t.day===target);
 const eligible=buffer.filter(t=>!t.completed&&t.title.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 React.useEffect(()=>{void getCalendar(target,target)},[target]);
 const assign=async()=>{
  if(submitting.current||!selected.length)return;
  const chosen=selected.filter(id=>buffer.some(t=>t.id===id));
  if(!chosen.length){setSelected([]);setMessage('Выбранные задачи уже не в буфере.');return;}
  submitting.current=true;setBusy(true);setMessage('');
  const moved:string[]=[];
  try{
   for(const id of chosen){
    const t=buffer.find(task=>task.id===id);if(!t)continue;
    // Keep the original task id, notes, category and links while changing its calendar day.
    await saveTask({id:t.id,title:t.title,notes:t.notes,sphere:t.sphere,categoryId:t.os61_category_id||null,day:target,priority:kind});
    moved.push(id);
   }
   setMessage('Запланировано: '+moved.length);
  }catch(e:any){
   setMessage('Запланировано '+moved.length+' из '+chosen.length+'. '+(e?.message||'Ошибка связи')+' — оставшиеся задачи можно отправить повторно.');
  }finally{
   setSelected(prev=>prev.filter(id=>!moved.includes(id)));
   try{await getCalendar(target,target)}catch{/* AppContext handles read errors */}
   submitting.current=false;setBusy(false);
  }
 };
 return <div className="page-stack planning-page planning-action-flow">
  <div className="page-heading"><div><p className="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</p><h1>Планирование</h1><p>Выбери день, задачи из буфера и их приоритет.</p></div></div>
  <Card className="planning-date-card"><SectionHead title="День планирования"/><div className="planning-date">
   <button className="btn outline" disabled={busy} onClick={()=>setTarget(dateAdd(target,-1))} aria-label="Предыдущий день"><Icon name="left"/></button>
   <input type="date" aria-label="Дата плана" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)}/>
   <button className="btn outline" disabled={busy} onClick={()=>setTarget(dateAdd(target,1))} aria-label="Следующий день"><Icon name="right"/></button>
  </div><p className="tiny-note">{prettyDay(target)}</p><p className="planning-quick-stat">Уже в плане: <strong>{current.length}</strong> · Выбрано из буфера: <strong>{selected.length}</strong></p></Card>
  <Card><SectionHead title="Задачи из буфера" caption={selected.length+' выбрано'}/><label className="buffer-search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти задачу" aria-label="Поиск по буферу"/></label>
   <div className="planning-task-list">{eligible.length?eligible.map(t=><label className="planning-task" key={t.id}><input type="checkbox" disabled={busy} checked={selected.includes(t.id)} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,t.id])]:old.filter(x=>x!==t.id))}/><span>{t.title}</span></label>):<Empty title={buffer.length?'Ничего не найдено':'В буфере пока нет задач'} action={query?<button className="btn outline" onClick={()=>setQuery('')}>Сбросить поиск</button>:undefined}/>}</div>
   <div className="planning-actions"><select aria-label="Приоритет задач" disabled={busy} value={kind} onChange={e=>setKind(e.target.value as 'important'|'extra')}><option value="important">Важные</option><option value="extra">Дополнительные</option></select>
    <button className="btn accent" disabled={busy||!selected.length} onClick={()=>void assign()}><Icon name="check"/> {busy?'Переносим…':'Запланировать '+selected.length}</button>
   </div>{message&&<p role="status" className="planning-commit-message">{message}</p>}</Card>
  <Card><SectionHead title="Уже запланировано" caption={current.length+' задач'}/>{current.map(t=><div className="planning-task" key={t.id}><Icon name={t.completed?'check-circle':'calendar-check'}/><span>{t.title}</span><small>{t.priority==='important'?'Важная':'Дополнительная'}</small></div>)}{!current.length&&<p className="tiny-note">План пока пуст.</p>}
   <div className="planning-actions"><button className="btn outline" onClick={()=>setEditor({type:'task',day:target,priority:'important'})}><Icon name="plus"/> Новая задача</button>
    <button className="btn accent" onClick={()=>{setDay(target);open('today')}}>Открыть план <Icon name="right"/></button></div>
  </Card>
 </div>;
}
