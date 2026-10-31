import React,{useEffect,useState} from 'react';
import {Icon} from './Icons';
import {request} from '../lib/api';

export const PROPERTY_ICON_CHOICES=['folder','flag','calendar','target','list','chart','clock','wallet','briefcase','check-square','idea','book-open','heart-pulse','zap','star','settings','palette','inbox','timer','users','tag','hash','type','check','filter'] as const;
export const PROPERTY_ICON_DEFAULTS:Record<string,string>={category:'folder',priority:'flag',day:'calendar',goal:'target',notes:'list',progress:'chart',duration:'clock',number:'hash',text:'type',checkbox:'check-square',date:'calendar',select:'list'};
export type PropertyAppearance={name:string;icon:string};
export const DEFAULT_NATIVE_PROPERTIES:Record<string,PropertyAppearance>={
 category:{name:'Категория',icon:'folder'},priority:{name:'Приоритет',icon:'flag'},day:{name:'Дата',icon:'calendar'},goal:{name:'Связь с целью',icon:'target'},notes:{name:'Заметки',icon:'list'},progress:{name:'Прогресс',icon:'chart'}
};
export const isPropertyIcon=(s:string)=>PROPERTY_ICON_CHOICES.some(x=>x===s);

export function TaskPropertyAppearance({fieldKey,name,icon,choices,fieldType,onChange}:{
 fieldKey:string;name:string;icon:string;choices?:string[];fieldType?:string;
 onChange:(name:string,icon:string,choices?:string[],fieldType?:string)=>void;
}){
 const [open,setOpen]=useState(false),[draftType,setDraftType]=useState(fieldType||''),[draftName,setDraftName]=useState(name),[draftIcon,setDraftIcon]=useState(icon),[draftChoices,setDraftChoices]=useState((choices||[]).join(', ')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!open){setDraftName(name);setDraftIcon(icon);setDraftType(fieldType||'');setDraftChoices((choices||[]).join(', '))}},[name,icon,open,fieldType,choices?.join(',')]);
 const save=async()=>{
  if(!draftName.trim()||busy)return;
  setBusy(true);setError('');
  const selected=choices===undefined?undefined:[...new Set(draftChoices.split(',').map(x=>x.trim()).filter(Boolean))];
  try{await request('os8','task_field_appearance',{key:fieldKey,name:draftName.trim(),icon:draftIcon,choices:selected,fieldType:draftType||undefined});onChange(draftName.trim(),draftIcon,selected,draftType||undefined);setOpen(false)}
  catch(e:any){setError(e.message||'Не удалось сохранить настройки свойства')}
  finally{setBusy(false)}
 };
 return <div className="os-property-appearance">
  <button type="button" className="os-property-name-button" aria-label={'Настроить свойство '+name} aria-expanded={open} onClick={()=>{setError('');setOpen(x=>!x)}}>
   <Icon name={icon} size={16}/><span>{name}</span>
  </button>
  {open&&<div className="os-property-settings" role="group" aria-label={'Настройки свойства '+name}>
   <div className="os-property-settings-header"><strong>Настроить свойство</strong><button type="button" aria-label="Закрыть настройки свойства" onClick={()=>setOpen(false)}>×</button></div>
   <label>Название<input maxLength={80} autoFocus value={draftName} onChange={e=>setDraftName(e.target.value)}/></label>
   {fieldType&&<label>Тип свойства<select value={draftType} onChange={e=>setDraftType(e.target.value)}><option value="duration">Время работы</option><option value="number">Число</option><option value="text">Текст</option><option value="checkbox">Флажок</option><option value="date">Дата</option><option value="select">Выбор</option></select></label>}
   <div className="os-property-icons" role="group" aria-label="Иконка свойства">
    {PROPERTY_ICON_CHOICES.map(k=><button type="button" key={k} title={k} aria-label={'Иконка '+k} aria-pressed={draftIcon===k} className={draftIcon===k?'selected':''} onClick={()=>setDraftIcon(k)}><Icon name={k} size={17}/></button>)}
   </div>
   {draftType==='select'&&<label>Варианты (через запятую)<input value={draftChoices} onChange={e=>setDraftChoices(e.target.value)} maxLength={1800}/></label>}
   {error&&<p className="os-inline-error" role="alert">{error}</p>}
   <div className="os-property-settings-actions"><button type="button" className="os-btn os-btn-primary" disabled={busy||!draftName.trim()} onClick={()=>void save()}>{busy?'Сохраняется…':'Готово'}</button><button type="button" className="os-btn" onClick={()=>setOpen(false)} disabled={busy}>Отмена</button></div>
  </div>}
 </div>;
}
