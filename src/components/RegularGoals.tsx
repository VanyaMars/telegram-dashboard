import React,{useEffect,useState} from 'react';
import {request} from '../lib/api';
import {useApp} from '../AppContext';
import {Card,Dialog,Empty,ProgressBar} from './UI';
import {Icon} from './Icons';
import {dateAdd,mondayOf} from '../lib/date';
export type RegularGoal={id:string;title:string;description:string;period:'open'|'week'|'month'|'deadline';starts_on:string|null;ends_on:string|null;progress:number;completed:boolean};
const periodNames={open:'Бессрочная',week:'Недельная',month:'Месячная',deadline:'Со сроком'};
export function useRegularGoals(){
 const {demo}=useApp();const[goals,setGoals]=useState<RegularGoal[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=async()=>{if(demo){setLoading(false);return}try{const res=await request<{goals:RegularGoal[]}>('os8','goals_list');setGoals(res.goals||[]);setError('')}catch(e:any){setError(e.message||'Не удалось загрузить цели')}finally{setLoading(false)}};
 useEffect(()=>{void reload();const f=()=>{void reload()};window.addEventListener('os8:goals-changed',f);return()=>window.removeEventListener('os8:goals-changed',f)},[demo]);
 return {goals,loading,error,reload};
}
function initialDate(now:string,period:RegularGoal['period']){
 if(period==='week')return {starts_on:mondayOf(now),ends_on:dateAdd(mondayOf(now),6)};
 if(period==='month'){const [y,m]=now.split('-').map(Number);return {starts_on:`${y}-${String(m).padStart(2,'0')}-01`,ends_on:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)}};
 return {starts_on:null,ends_on:null};
}
export function RegularGoalEditor({item,onClose,onSaved}:{item?:RegularGoal|null;onClose:()=>void;onSaved:()=>void}){
 const{today,demo}=useApp();const[title,setTitle]=useState(item?.title||'');const[description,setDescription]=useState(item?.description||'');const[period,setPeriod]=useState<RegularGoal['period']>(item?.period||'open');
 const[starts,setStarts]=useState(item?.starts_on||'');const[ends,setEnds]=useState(item?.ends_on||'');const[progress,setProgress]=useState(item?.progress??0);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const changePeriod=(p:RegularGoal['period'])=>{setPeriod(p);const dates=initialDate(today,p);setStarts(dates.starts_on||'');setEnds(dates.ends_on||'');};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(demo)return;setBusy(true);setError('');try{await request('os8','goal_save',{id:item?.id||null,title,description,period,starts_on:starts||null,ends_on:ends||null,progress});onSaved();onClose();}catch(err:any){setError(err.message)}finally{setBusy(false)}};
 const remove=async()=>{if(!item||!window.confirm('Удалить эту цель?'))return;setBusy(true);try{await request('os8','goal_delete',{id:item.id});onSaved();onClose();}catch(err:any){setError(err.message)}finally{setBusy(false)}};
 return <Dialog open onClose={onClose} title={item?'Редактировать цель':'Новая обычная цель'}><form className="editor-form" onSubmit={save}>
  <label>Название<input autoFocus required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, улучшить портфолио"/></label>
  <label>Период<select value={period} onChange={e=>changePeriod(e.target.value as RegularGoal['period'])}>{Object.entries(periodNames).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
  {period!=='open'&&<div className="form-grid"><label>Начало<input type="date" required value={starts} onChange={e=>setStarts(e.target.value)}/></label><label>Окончание<input type="date" required value={ends} onChange={e=>setEnds(e.target.value)}/></label></div>}
  <label>Прогресс — {progress}%<input type="range" min="0" max="100" step="5" value={progress} onChange={e=>setProgress(Number(e.target.value))}/></label>
  <label>Описание<textarea rows={3} maxLength={6000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  {error&&<div className="os-error-banner" role="alert">{error}</div>}
  <div className="form-actions">{item&&<button type="button" className="btn danger-btn" disabled={busy} onClick={()=>void remove()}>Удалить</button>}<button className="btn accent" disabled={busy||demo||!title.trim()||((period!=='open')&&(!starts||!ends||ends<starts))} type="submit">Сохранить</button></div>
 </form></Dialog>;
}
export function RegularGoals({compact=false}:{compact?:boolean}){
 const{open}=useApp();const{goals,loading,error,reload}=useRegularGoals();const[editing,setEditing]=useState<RegularGoal|null|undefined>(undefined);
 const changed=()=>{window.dispatchEvent(new Event('os8:goals-changed'));};
 return <div className="regular-goals"><div className="card-title-row"><div><h2>Обычные цели</h2><p className="tiny-note">Бессрочные и с периодом</p></div>{!compact&&<button className="btn small accent" onClick={()=>setEditing(null)}><Icon name="plus" size={16}/> Цель</button>}</div>
   {error&&<p className="os-error-banner">{error} <button onClick={()=>void reload()}>Повторить</button></p>}
   {loading?<p className="tiny-note">Загружаем цели…</p>:goals.length===0?<Empty title="Пока нет обычных целей" description="Создай первую цель с собственным сроком" action={!compact?<button className="btn accent" onClick={()=>setEditing(null)}>Добавить цель</button>:undefined}/>:<div className="regular-goals-grid">{(compact?goals.slice(0,3):goals).map(g=><button key={g.id} className="regular-goal-card" onClick={()=>{if(!compact)setEditing(g);else open('goals')}}>
    <div className="regular-goal-heading"><strong>{g.title}</strong><b>{g.progress}%</b></div><span className="tiny-note">{periodNames[g.period]}{g.ends_on?` · до ${g.ends_on}`:''}</span><ProgressBar value={g.progress}/>
   </button>)}</div>}
   {editing!==undefined&&<RegularGoalEditor item={editing} onClose={()=>setEditing(undefined)} onSaved={changed}/>}
 </div>;
}
