import React,{useEffect,useState} from 'react';
import {useApp} from '../AppContext';
import {request} from '../lib/api';
import {Icon} from './Icons';
import {Dialog} from './UI';
import {TaskPropertyAppearance,type PropertyAppearance} from './TaskPropertyAppearance';
import type {Task} from '../types';
type Priority={id:string;name:string;options:{group:'important'|'extra';color:string}};
export function TaskPriorityField({task,onSaved,appearance,onAppearanceChange,onRemove}:{task:Task;onSaved:()=>Promise<void>;appearance:PropertyAppearance;onAppearanceChange:(name:string,icon:string)=>void;onRemove:()=>void}){
 const [priorities,setPriorities]=useState<Priority[]>([]),[adding,setAdding]=useState(false),[name,setName]=useState(''),[group,setGroup]=useState<'important'|'extra'>('extra'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;request<{priorities:Priority[]}>('os8','priorities_list').then(r=>{if(active)setPriorities(r.priorities||[])}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[task.id]);
 const choose=async(value:string)=>{
  if(value==='new'){setAdding(true);return}
  if(busy)return;setBusy(true);setError('');
  try{
   const custom=priorities.find(p=>p.id===value);
   await request('os8','task_native_patch',{taskId:task.id,key:'priority',value:custom?.options.group||value});
   await request('os8','task_options_set',{taskId:task.id,patch:{customPriority:custom?.id||null}});
   await onSaved();
  }catch(e:any){setError(e.message||'Не удалось обновить приоритет')}finally{setBusy(false)}
 };
 const create=async(e:React.FormEvent)=>{e.preventDefault();if(!name.trim()||busy)return;setBusy(true);setError('');
  try{
   const result=await request<{priorities:Priority[]}>('os8','priority_create',{name:name.trim(),group,color:'#007aff'});
   const created=(result.priorities||[]).find(p=>!priorities.some(old=>old.id===p.id));
   if(!created)throw Error('Созданный приоритет не найден');
   setPriorities(result.priorities);
   await request('os8','task_native_patch',{taskId:task.id,key:'priority',value:created.options.group});
   await request('os8','task_options_set',{taskId:task.id,patch:{customPriority:created.id}});
   await onSaved();setAdding(false);setName('');
  }catch(err:any){setError(err.message||'Не удалось создать приоритет')}finally{setBusy(false)}
 };
 return <div className="os-property-row os-priority-property">
  <TaskPropertyAppearance fieldKey="priority" {...appearance} onChange={onAppearanceChange} onRemove={onRemove}/>
  <select aria-label="Приоритет задачи" value={task.task_options?.customPriority||task.priority} onChange={e=>void choose(e.target.value)} disabled={busy}>
   <option value="important">Важная</option><option value="extra">Обычная</option>
   {priorities.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="new">Добавить приоритет…</option>
  </select>
  {error&&<span role="alert" className="os-inline-error">{error}</span>}
  <Dialog open={adding} title="Новый приоритет" onClose={()=>setAdding(false)}>
   <form className="task-priority-form" onSubmit={e=>void create(e)}>
    <label>Название<input autoFocus aria-label="Название приоритета" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Группа плана<select aria-label="Группа плана" value={group} onChange={e=>setGroup(e.target.value as 'important'|'extra')}><option value="extra">Обычные задачи</option><option value="important">Важные задачи</option></select></label>
    <p>Группа определяет, где задача появится в плане дня.</p><button className="btn accent" disabled={!name.trim()||busy}>Создать</button>
   </form>
  </Dialog>
 </div>;
}
