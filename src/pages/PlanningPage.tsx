import React,{useMemo,useState} from 'react';
import {useApp} from '../AppContext';
import {Card,Empty,SectionHead} from '../components/UI';
import {Icon} from '../components/Icons';
import {dateAdd,prettyDay,shortDay} from '../lib/date';
import type {Task} from '../types';
export function PlanningPage(){
 const {today,day,buffer,tasks,saveTask,setEditor,open,setDay,getCalendar,calendarTasks}=useApp();
 const [target,setTarget]=useState(dateAdd(today,1)),[selected,setSelected]=useState<string[]>([]),[kind,setKind]=useState<'important'|'extra'>('important'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [query,setQuery]=useState('');const current=calendarTasks.filter(t=>t.day===target);
 const eligible=buffer.filter(t=>!t.completed&&t.title.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
 React.useEffect(()=>{void getCalendar(target,target)},[target]);
 const assign=async()=>{if(!selected.length)return;setBusy(true);setMessage('');let count=0;try{for(const id of selected){const t=buffer.find(x=>x.id===id);if(!t)continue;await saveTask({id:t.id,title:t.title,notes:t.notes,sphere:t.sphere,categoryId:t.os61_category_id||null,day:target,priority:kind});count++;}
   setSelected([]);setMessage('Запланировано: '+count);await getCalendar(target,target);}catch(err:any){setMessage('Сохранено '+count+' из '+selected.length+'. '+(err?.message||'Ошибка связи'))}finally{setBusy(false)}};
 return <div className="page-stack planning-page"><div className="page-heading"><div><p className="eyebrow">ВЫБЕРИ СЛЕДУЮЩИЙ ШАГ</p><h1>Планирование</h1><p>Выбери день, задачи из буфера и их приоритет.</p></div></div>
 <Card><SectionHead title="День планирования"/><div className="planning-date"><button className="btn outline" onClick={()=>setTarget(dateAdd(target,-1))} aria-label="Предыдущий день"><Icon name="left"/></button><input type="date" aria-label="Дата плана" value={target} onChange={e=>setTarget(e.target.value)}/><button className="btn outline" onClick={()=>setTarget(dateAdd(target,1))} aria-label="Следующий день"><Icon name="right"/></button></div><p className="tiny-note">{prettyDay(target)}</p></Card>
 <Card><SectionHead title="Перенести из буфера" caption={selected.length+' выбрано'}/><label className="buffer-search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти задачу" aria-label="Поиск по буферу"/></label>
 <div className="planning-task-list">{eligible.length?eligible.map(t=><label className="planning-task" key={t.id}><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id]:old.filter(x=>x!==t.id))}/><span>{t.title}</span></label>):<Empty title="В буфере нет подходящих задач"/>}</div>
 <div className="planning-actions"><select aria-label="Приоритет задач" value={kind} onChange={e=>setKind(e.target.value as 'important'|'extra')}><option value="important">Важные</option><option value="extra">Дополнительные</option></select><button className="btn accent" disabled={busy||!selected.length} onClick={()=>void assign()}><Icon name="check"/> Запланировать {selected.length||''}</button></div>{message&&<p role="status" className="tiny-note">{message}</p>}</Card>
 <Card><SectionHead title="Уже запланировано" caption={current.length+' задач'}/>{current.map(t=><div className="planning-task" key={t.id}><Icon name={t.completed?'check-circle':'calendar-check'}/><span>{t.title}</span><small>{t.priority==='important'?'Важная':'Дополнительная'}</small></div>)}{!current.length&&<p className="tiny-note">План пока пуст.</p>}<div className="planning-actions"><button className="btn outline" onClick={()=>setEditor({type:'task',day:target,priority:'important'})}><Icon name="plus"/> Новая задача</button><button className="btn accent" onClick={()=>{setDay(target);open('today')}}>Открыть план <Icon name="right"/></button></div></Card></div>;
}
