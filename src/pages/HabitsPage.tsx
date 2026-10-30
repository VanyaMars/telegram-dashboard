import React,{useState} from 'react';
import {useApp} from '../AppContext';
import {Card,Empty,SectionHead} from '../components/UI';
import {Icon} from '../components/Icons';
import {dateAdd,shortDay,progress} from '../lib/date';
import {useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
export function HabitsPage(){
 const {today,os6,setEditor,mutate}=useApp();const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const reduced=useReducedMotion();
 const dates=Array.from({length:7},(_,i)=>dateAdd(today,i-6));
 const rows=os6.challenges;
 const toggle=async(id:string,day:string,done:boolean)=>{setBusy(id+day);setError('');try{await mutate('os61','challenge_day',{id,day,done})}catch(e:any){setError(e.message||'Не удалось сохранить')}finally{setBusy('')}};
 return <div className="page-stack habit-page"><div className="page-heading"><div><p className="eyebrow">МАЛЕНЬКИЕ ДЕЙСТВИЯ</p><h1>Привычки</h1><p>Отмечай выполненное. Пропущенный день — не провал.</p></div><button className="btn accent" onClick={()=>setEditor({type:'challenge'})}><Icon name="plus"/> Привычка</button></div>
 {error&&<p role="alert" className="os-inline-error">{error}</p>}
 <Card><SectionHead title="Последние 7 дней"/><div className="habit-table"><div className="habit-head"><span>Привычка</span>{dates.map(d=><small key={d} title={d}>{shortDay(d)}</small>)}</div>
 {rows.map(h=>{const marked=os6.challengeDays.filter(x=>x.challenge_id===h.id);const count=marked.length;return <div className="habit-row" key={h.id}><button className="habit-title" onClick={()=>setEditor({type:'challenge',item:h})}><strong>{h.title}</strong><small>{count} / {h.target_days}</small></button>{dates.map(d=>{const checked=marked.some(x=>x.day===d),enabled=d>=h.starts_on&&d<=h.ends_on&&d<=today;return <m.button key={d} whileTap={!reduced?{scale:0.82}:undefined} transition={{type:'spring',stiffness:520,damping:30}} disabled={!enabled||busy===h.id+d} className={'habit-day '+(checked?'is-done':'')} aria-label={h.title+': '+d+(checked?' выполнено':' не выполнено')} aria-pressed={checked} onClick={()=>void toggle(h.id,d,!checked)}><m.span key={checked?'checked':'empty'} initial={reduced?false:{opacity:0,scale:0.66}} animate={{opacity:1,scale:1}} transition={{duration:reduced?0:0.2}}>{checked?'✓':'·'}</m.span></m.button>})}</div>})}
 {!rows.length&&<Empty title="Создай первую привычку" description="Начни с одного простого действия, которое хочешь повторять"/>}</div></Card>
 <Card><SectionHead title="Прогресс привычек"/>{rows.map(h=>{const count=os6.challengeDays.filter(x=>x.challenge_id===h.id).length;return <div className="habit-progress" key={h.id}><span>{h.title}</span><strong>{count} / {h.target_days}</strong><div className="progress-track"><div className="progress-fill primary" style={{width:progress(count,h.target_days)+'%'}}/></div></div>})}</Card></div>;
}
