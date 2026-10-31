import React,{useEffect,useState} from 'react';
import {request} from '../lib/api';

export type TaskField={id:string;name:string;field_type:'duration'|'number'|'text'|'checkbox'|'date'|'select';options?:{choices?:string[]}};
const types:Record<TaskField['field_type'],string>={duration:'Время работы',number:'Число',text:'Текст',checkbox:'Флажок',date:'Дата',select:'Выбор'};
const formatMinutes=(n:number)=>n>=60?`${Math.floor(n/60)} ч ${n%60} мин`:`${n} мин`;

export function TaskCustomProperties({taskId,pipelineProperties=[]}:{taskId:string;pipelineProperties?:Array<{blockId:string;label:string;percent:number;done:number;total:number}>}){
 const [fields,setFields]=useState<TaskField[]>([]),[values,setValues]=useState<Record<string,string>>({}),[error,setError]=useState(''),[status,setStatus]=useState('');
 const [adding,setAdding]=useState(false),[name,setName]=useState(''),[type,setType]=useState<TaskField['field_type']>('duration'),[choices,setChoices]=useState('');
 const [busy,setBusy]=useState(false);
 const load=async()=>{
  const [f,v]=await Promise.all([request<{fields:TaskField[]}>('os8','task_property_fields'),request<{values:Record<string,string>}>('os8','task_property_values',{taskId})]);
  setFields(f.fields||[]);setValues(v.values||{});
 };
 useEffect(()=>{let live=true;Promise.all([request<{fields:TaskField[]}>('os8','task_property_fields'),request<{values:Record<string,string>}>('os8','task_property_values',{taskId})]).then(([f,v])=>{if(live){setFields(f.fields||[]);setValues(v.values||{})}}).catch(e=>{if(live)setError(e.message||'Свойства недоступны')});return()=>{live=false}},[taskId]);
 const save=async(field:TaskField,value:string)=>{
  setBusy(true);setError('');setStatus('');
  try{await request('os8','task_property_set',{taskId,propertyId:field.id,value});setValues(v=>({...v,[field.id]:value}));setStatus('Свойство сохранено');window.dispatchEvent(new Event('os11:properties-changed'))}
  catch(e:any){setError(e.message||'Не удалось сохранить свойство')}
  finally{setBusy(false)}
 };
 const create=async(e:React.MouseEvent<HTMLButtonElement>)=>{
  e.preventDefault();setBusy(true);setError('');
  try{await request('os8','task_property_define',{name,fieldType:type,choices:choices.split(',').map(x=>x.trim()).filter(Boolean)});await load();setName('');setChoices('');setAdding(false)}
  catch(e:any){setError(e.message||'Не удалось создать свойство')}finally{setBusy(false)}
 };
 return <div className="os-custom-properties os-custom-properties--embedded" aria-label="Дополнительные свойства задачи">
  <div className="os-custom-properties-head"><strong>Свойства задачи</strong><button type="button" className="os-btn" onClick={()=>setAdding(x=>!x)}>+ Add property</button></div>
  {error&&<p role="alert" className="os-inline-error">{error}</p>}
  {status&&<p role="status" className="os-inline-hint">{status}</p>}
  {pipelineProperties.map(p=><div className="os-custom-property-row os-computed-progress" key={p.blockId}>
   <span className="os-property-name">{p.label}</span><div className="os-computed-progress-value">
    <div className="os-computed-progress-track" role="progressbar" aria-label={p.label} aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:p.percent+'%'}}/></div>
    <strong>{p.percent}%</strong><small>{p.done} из {p.total} действий · автоматически</small>
   </div>
  </div>)}
  {fields.map(f=><div className="os-custom-property-row" key={f.id}>
   <label htmlFor={'property-'+f.id}>{f.name}</label>
   {f.field_type==='checkbox'?<input id={'property-'+f.id} type="checkbox" disabled={busy} checked={values[f.id]==='true'} onChange={e=>void save(f,String(e.target.checked))}/>
   :f.field_type==='select'?<select id={'property-'+f.id} disabled={busy} value={values[f.id]||''} onChange={e=>void save(f,e.target.value)}><option value="">—</option>{(f.options?.choices||[]).map(x=><option key={x} value={x}>{x}</option>)}</select>
   :<input id={'property-'+f.id} key={f.id+'-'+(values[f.id]||'')} defaultValue={values[f.id]||''} disabled={busy} type={f.field_type==='duration'||f.field_type==='number'?'number':f.field_type==='date'?'date':'text'} min={f.field_type==='duration'?0:undefined} step={f.field_type==='duration'?1:'any'} placeholder={f.field_type==='duration'?'Минуты':'—'} onBlur={e=>{if(e.target.value!==(values[f.id]||''))void save(f,e.target.value)}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>}
   {f.field_type==='duration'&&<small>{formatMinutes(Number(values[f.id]||0))}</small>}
  </div>)}
  {adding&&<div className="os-custom-property-add">
   <label>Название<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Время работы"/></label>
   <label>Тип<select value={type} onChange={e=>setType(e.target.value as TaskField['field_type'])}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   {type==='select'&&<label>Варианты через запятую<input value={choices} onChange={e=>setChoices(e.target.value)}/></label>}
   <button type="button" className="os-btn os-btn-primary" onClick={e=>void create(e)} disabled={busy||!name.trim()}>Создать свойство</button>
  </div>}
 </div>;
}
