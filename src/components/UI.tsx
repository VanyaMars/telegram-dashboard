import React,{useEffect,useState} from 'react';
import {Icon} from './Icons';
import {useApp} from '../AppContext';
import type {GoalPoint} from '../types';
import {goalProgress} from '../lib/date';
import {useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';

export function Card({children,className='',onClick}:{children:React.ReactNode;className?:string;onClick?:()=>void}){
  const reduced=useReducedMotion();
  const featured=/(hero-result|week-overview|priority-card|today-summary|quick-plan-card|mvp-kpi|goal-mini|goal-full|focus-card)/.test(className);
  if(!featured)return <div className={'glass-card '+className} onClick={onClick}>{children}</div>;
  const lift=/(hero-result|goal-mini|mvp-kpi)/.test(className);
  return <m.div className={'glass-card motion-card '+className} onClick={onClick}
    initial={reduced?false:{opacity:0,y:14}}
    animate={{opacity:1,y:0}}
    whileHover={!reduced&&lift?{y:-3}:undefined}
    transition={{duration:reduced?0:0.34,ease:'easeOut'}}>{children}</m.div>;
}
export function Pill({children,accent='lavender'}:{children:React.ReactNode;accent?:string}){
  return <span className={'pill pill-'+accent}>{children}</span>;
}
export function ProgressBar({value,max=100,secondary=0}:{value:number;max?:number;secondary?:number}){
  const reduced=useReducedMotion();
  const a=max>0?Math.max(0,Math.min(max,value))/max*100:0;
  const b=max>0?Math.max(0,Math.min(max-value,secondary))/max*100:0;
  return <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0,Math.min(max,value+secondary))}>
    <m.span className="progress-fill primary motion-progress-fill" initial={reduced?false:{width:'0%'}} animate={{width:`${a}%`}} transition={{duration:reduced?0:0.64,ease:'easeOut'}}/>{secondary>0&&<m.span className="progress-fill secondary motion-progress-fill" initial={reduced?false:{width:'0%'}} animate={{width:`${b}%`}} transition={{duration:reduced?0:0.64,ease:'easeOut'}}/>}</div>;
}
export function Sparkline({values=[],color='#8B84ED',height=72}:{values?:number[];color?:string;height?:number}){
  const rows=(values.length?values:[0,0]);const w=300,h=height;const max=Math.max(...rows),min=Math.min(...rows),range=max-min||1;
  const pts=rows.map((y,i)=>`${(i/(rows.length-1||1))*w},${h-12-(y-min)/range*(h-26)}`).join(' ');
  return <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="График изменения показателя">
    <defs><linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity=".24"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <path d={`M0 ${h} L${pts.replaceAll(' ', ' L')} L${w} ${h} Z`} fill="url(#sparkGrad)"/>
    <polyline points={pts} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/>
    {rows.length>0&&<circle cx={w} cy={h-12-(rows[rows.length-1]-min)/range*(h-26)} r="4" fill={color}/>}
  </svg>;
}
export function GoalMini({title,current,target,start,unit,history,open}:{title:string;current:number;target:number;start:number;unit:string;history:GoalPoint[];open:()=>void}){
  const p=goalProgress({start_value:start,target_value:target,current_value:current});
  return <Card className="goal-mini" onClick={open}>
    <div className="item-title-row"><div><span className="tiny-label">АМБИЦИОЗНАЯ ЦЕЛЬ</span><h3>{title}</h3></div><Icon name="arrow-up-right" size={17}/></div>
    <div className="goal-num"><strong>{current.toLocaleString('ru-RU')} {unit}</strong><span>из {target.toLocaleString('ru-RU')} {unit}</span></div>
    <ProgressBar value={p}/><div className="goal-mini-bottom"><span>{p}% пути от старта</span><span>{history.length} изм.</span></div>
  </Card>;
}
export function Empty({icon='inbox',title,description,action}:{icon?:string;title:string;description?:string;action?:React.ReactNode}){
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={23}/></div><strong>{title}</strong>{description&&<p>{description}</p>}{action}</div>;
}
export function SectionHead({title,caption,action}:{title:string;caption?:string;action?:React.ReactNode}){
  return <div className="section-head"><div><h2>{title}</h2>{caption&&<p>{caption}</p>}</div>{action}</div>;
}
export function Dialog({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode}){
  const reduced=useReducedMotion();
  useEffect(()=>{if(!open)return;const cb=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',cb);return()=>document.removeEventListener('keydown',cb)},[open,onClose]);
  if(!open)return null;
  return <div className="modal-backdrop" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <m.div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title} initial={reduced?false:{opacity:0,y:12,scale:0.985}} animate={{opacity:1,y:0,scale:1}} transition={{duration:reduced?0:0.22,ease:'easeOut'}}><div className="modal-top"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="x"/></button></div>{children}</m.div>
  </div>;
}
export function StatusToast(){const{message,recentDeleted,undoDelete}=useApp();return message?<div className="toast" role="status"><Icon name="check-circle" size={16}/>{message}{recentDeleted&&message==='Задача удалена'&&<button className="toast-undo" onClick={()=>void undoDelete()}>Отменить</button>}</div>:null;}
export function WeekBars({days,current}:{days:string[];current:Record<string,number>}){
  const reduced=useReducedMotion();
  const vals=days.map(d=>current[d]||0);const max=Math.max(1,...vals);
  return <div className="week-bars" role="img" aria-label="Выполненные задачи за неделю">{days.map((d,i)=><div className="bar-col" key={d} title={`${d}: ${vals[i]} задач`}><span className="bar-num">{vals[i]||''}</span><div className="bar-slot"><m.div className="bar" initial={reduced?false:{height:'2%'}} animate={{height:`${Math.max(vals[i]?6:2,vals[i]/max*100)}%`}} transition={{duration:reduced?0:0.6,delay:reduced?0:i*.045,ease:'easeOut'}}/></div><small>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</small></div>)}</div>;
}
