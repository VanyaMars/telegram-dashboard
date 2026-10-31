import React,{useEffect,useState} from 'react';
import {request} from '../lib/api';

type Field={id:string;name:string;field_type:'duration'|'number'};
type Rollup={property_id:string;label:string;target:number|null;total:number};
type Result={fields:Field[];rollups:Rollup[];linkedTasks:number};
const shown=(value:number,duration:boolean)=>duration?`${Math.floor(value/60)} ч ${value%60} мин`:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
export function GoalTaskRollups({kind,goalId}:{kind:'regular'|'strategic';goalId:string}){
 const [data,setData]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState(false);
 const [propertyId,setPropertyId]=useState(''),[label,setLabel]=useState('Время работы'),[target,setTarget]=useState('');
 const load=async()=>{const v=await request<Result>('os8','goal_rollup_get',{kind,goalId});setData(v);};
 useEffect(()=>{let live=true;request<Result>('os8','goal_rollup_get',{kind,goalId}).then(v=>{if(live)setData(v)}).catch(e=>{if(live)setError(e.message||'Расчёты недоступны')});
  const reload=()=>{void load().catch(()=>setError('Не удалось обновить показатели'))};window.addEventListener('os11:properties-changed',reload);
  return()=>{live=false;window.removeEventListener('os11:properties-changed',reload)}},[kind,goalId]);
 const save=async(remove=false,id=propertyId)=>{
  setBusy(true);setError('');
  try{await request('os8','goal_rollup_save',{kind,goalId,propertyId:id,label,target:target||null,remove});await load();setAdding(false);setPropertyId('');setTarget('')}
  catch(e:any){setError(e.message||'Не удалось сохранить показатель')}finally{setBusy(false)}
 };
 const available=(data?.fields||[]).filter(f=>!(data?.rollups||[]).some(r=>r.property_id===f.id));
 return <section className="os-goal-rollups" aria-label="Автоматические показатели по задачам">
  <div className="os-goal-rollups-heading"><div><strong>Автоматические показатели</strong><p>Сумма свойств всех связанных задач, включая задачи из Буфера</p></div><button className="btn outline" onClick={()=>setAdding(x=>!x)} type="button">+ Показатель</button></div>
  {error&&<p role="alert" className="os-inline-error">{error}</p>}
  {(data?.rollups||[]).map(r=>{const f=data?.fields.find(x=>x.id===r.property_id),duration=f?.field_type==='duration';return <div className="os-goal-rollup-row" key={r.property_id}>
   <div><small>{r.label}</small><strong>{shown(r.total,duration)}</strong>{r.target!=null&&<span>из {shown(r.target,duration)}</span>}</div>
   {r.target!=null&&<progress max={r.target} value={Math.min(r.total,r.target)} aria-label={'Прогресс: '+r.label}/>}
   <button type="button" disabled={busy} aria-label={'Удалить показатель '+r.label} onClick={()=>void save(true,r.property_id)}>×</button>
  </div>})}
  {data&&!data.rollups.length&&<p className="tiny-note">Здесь появятся суммы времени, количества действий и других числовых свойств задач.</p>}
  {adding&&<form className="os-goal-rollup-add" onSubmit={e=>{e.preventDefault();void save()}}>
   <label>Свойство задач<select required value={propertyId} onChange={e=>{setPropertyId(e.target.value);const f=available.find(x=>x.id===e.target.value);if(f)setLabel(f.name)}}><option value="">Выбери свойство</option>{available.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
   <label>Название показателя<input required maxLength={80} value={label} onChange={e=>setLabel(e.target.value)}/></label>
   <label>Целевое значение (для времени — в минутах)<input type="number" min="1" step="any" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Например, 1200"/></label>
   <button type="submit" className="btn accent" disabled={busy||!propertyId||!label.trim()}>Сохранить</button>
   {!available.length&&<p className="tiny-note">Сначала добавь числовое свойство или «Время работы» на странице любой задачи.</p>}
  </form>}
 </section>;
}
