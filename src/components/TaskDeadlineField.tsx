import React,{useEffect,useState} from 'react';
import {useApp} from '../AppContext';
import {request} from '../lib/api';
import {dateAdd,mondayOf,monthDays} from '../lib/date';
import {TaskPropertyAppearance,type PropertyAppearance} from './TaskPropertyAppearance';
import type {Task} from '../types';

export function deadlinePreset(today:string,preset:'today'|'tomorrow'|'week'|'month'):string{
 if(preset==='tomorrow')return dateAdd(today,1);
 if(preset==='week')return dateAdd(mondayOf(today),6);
 if(preset==='month')return today.slice(0,7)+'-'+String(monthDays(today)).padStart(2,'0');
 return today;
}
export function deadlineDescription(date:string,time:string,today:string,now:Date,tz:string){
 if(!date)return 'Не установлен';
 const dayDiff=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
 if(!time){
  if(dayDiff<0)return 'Просрочено на '+Math.abs(dayDiff)+' дн.';
  if(dayDiff===0)return 'Сегодня';if(dayDiff===1)return 'Завтра';return 'Осталось '+dayDiff+' дн.';
 }
 const timeParts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const [h,m]=timeParts.split(':').map(Number),[dh,dm]=time.split(':').map(Number);
 const minutes=dayDiff*1440+dh*60+dm-h*60-m;
 if(minutes<0){const abs=Math.abs(minutes);return 'Просрочено на '+(abs<60?abs+' мин.':abs<1440?Math.ceil(abs/60)+' ч.':Math.ceil(abs/1440)+' дн.')}
 if(minutes===0)return 'Срок наступил';
 if(minutes<60)return 'Осталось '+minutes+' мин.';
 if(minutes<1440)return 'Осталось '+Math.ceil(minutes/60)+' ч.';
 return 'Осталось '+Math.ceil(minutes/1440)+' дн.';
}
export function TaskDeadlineField({task,onSaved,appearance,onAppearanceChange,onRemove}:{task:Task;onSaved:()=>Promise<void>;appearance:PropertyAppearance;onAppearanceChange:(name:string,icon:string)=>void;onRemove:()=>void}){
 const {today,tz}=useApp();
 const opts=task.task_options||{},[expanded,setExpanded]=useState(false),[date,setDate]=useState(opts.deadline||''),[time,setTime]=useState(opts.deadlineTime||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [clock,setClock]=useState(()=>new Date());
 useEffect(()=>{setDate(task.task_options?.deadline||'');setTime(task.task_options?.deadlineTime||'')},[task.id,task.task_options?.deadline,task.task_options?.deadlineTime]);
 useEffect(()=>{const id=setInterval(()=>setClock(new Date()),60000);return()=>clearInterval(id)},[]);
 const save=async(nextDate:string,nextTime:string)=>{
  setBusy(true);setError('');
  try{await request('os8','task_options_set',{taskId:task.id,patch:{deadline:nextDate||null,deadlineTime:nextDate?nextTime:''}});await onSaved();setExpanded(false)}
  catch(e:any){setError(e.message||'Не удалось сохранить дедлайн')}finally{setBusy(false)}
 };
 const display=deadlineDescription(opts.deadline||'',opts.deadlineTime||'',today,clock,tz);
 return <div className="os-property-row os-deadline-property">
  <TaskPropertyAppearance fieldKey="deadline" {...appearance} onChange={onAppearanceChange} onRemove={onRemove}/>
  <div className="os-deadline-value">
   <button type="button" className={'os-deadline-trigger '+((opts.deadline&&display.startsWith('Просрочено'))?'is-overdue':'')} aria-expanded={expanded} aria-controls={'deadline-picker-'+task.id} onClick={()=>setExpanded(v=>!v)}>
    <span>{opts.deadline?new Date(opts.deadline+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):'Выбрать срок'}{opts.deadlineTime?' · '+opts.deadlineTime:''}</span>
    <small>{display}</small>
   </button>
   {expanded&&<form id={'deadline-picker-'+task.id} className="os-deadline-picker" onSubmit={e=>{e.preventDefault();void save(date,time)}}>
    <div className="os-deadline-presets">
     {([['today','Сегодня'],['tomorrow','Завтра'],['week','На неделе'],['month','В этом месяце']] as const).map(([key,label])=><button type="button" key={key} onClick={()=>setDate(deadlinePreset(today,key))}>{label}</button>)}
    </div>
    <label>Дата<input aria-label="Дата дедлайна" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Время (необязательно)<input aria-label="Время дедлайна" type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
    {error&&<span role="alert" className="os-inline-error">{error}</span>}
    <div className="os-deadline-actions"><button type="button" onClick={()=>void save('','')} disabled={busy||!opts.deadline}>Убрать срок</button><button type="button" onClick={()=>setExpanded(false)}>Отмена</button><button type="submit" disabled={busy||!date}>Сохранить</button></div>
   </form>}
  </div>
 </div>;
}
