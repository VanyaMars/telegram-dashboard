import React,{useEffect,useMemo,useState} from 'react';
import {useApp} from '../AppContext';
import {useRegularGoals,goalEvidence,regularGoalValues} from '../components/RegularGoals';
import {Icon} from '../components/Icons';
import {Card,ProgressBar,SectionHead} from '../components/UI';
import {MotionNumber} from '../components/MotionNumber';
import {GoalValues} from '../components/GoalValues';
import {getIncomeSummary,IncomeSummary} from '../lib/earnings';
import {dateAdd,monthStart,goalProgress,prettyDay,progress,shortDay} from '../lib/date';
import {request} from '../lib/api';
import type {DayMetrics} from '../types';

const number=(v:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
const currencySymbol=(c:string)=>({RUB:'₽',USD:'$',EUR:'€'} as Record<string,string>)[c]||c;
type WindowSize=7|30|90;
const keys:[WindowSize,string][]=[[7,'7 дней'],[30,'Месяц'],[90,'90 дней']];
export function MvpAnalyticsPage(){
 const {today,goals,os6,metrics,open,demo,buffer,tasks,categories}=useApp();const {goals:regularGoals,goalStats}=useRegularGoals();
 const [period,setPeriod]=useState<WindowSize>(30),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [days,setDays]=useState<Record<string,DayMetrics>>(metrics),[income,setIncome]=useState<IncomeSummary>({totals:{},daily:{},count:0});
 const [goalLinks,setGoalLinks]=useState<Record<string,{total:number;done:number}>>({});

 const start=period===30?monthStart(today):dateAdd(today,-period+1);const dates=useMemo(()=>{const count=period===30?Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1:period;return Array.from({length:count},(_,i)=>dateAdd(start,i))},[start,period,today]);
 useEffect(()=>{let active=true;const read=async()=>{if(demo){setDays(metrics);return}setLoading(true);setError('');
   try{const results=await Promise.allSettled([request<{days:Record<string,DayMetrics>}>('os6','metrics',{start,end:today}),getIncomeSummary(start,today),request<{stats:Record<string,{total:number;done:number}>}>('os9','regular_goal_stats')]);
    if(!active)return;
    if(results[0].status==='fulfilled')setDays(results[0].value.days||{});
    if(results[1].status==='fulfilled')setIncome(results[1].value);
    if(results[2].status==='fulfilled')setGoalLinks(results[2].value.stats||{});
    const failed=results.map((r,i)=>r.status==='rejected'?(i===0?'os6.metrics':i===1?'os9.income_summary':'os9.regular_goal_stats'):null).filter(Boolean);
    if(failed.length)setError('Не удалось загрузить: '+failed.join(', ')+'. Проверь Logs этих функций в Supabase.');
   }catch(e:any){if(active)setError(e.message||'Не удалось загрузить статистику')}
   finally{if(active)setLoading(false)}};
  void read();const refresh=()=>{void read()};window.addEventListener('os9:income-changed',refresh);
  return()=>{active=false;window.removeEventListener('os9:income-changed',refresh)};
 },[start,today,demo]);
 const completed=dates.reduce((sum,d)=>sum+(days[d]?.tasks||0),0);
 const goalAvg=regularGoals.length?Math.round(regularGoals.reduce((v,g)=>v+goalEvidence(g,goalStats).progress,0)/regularGoals.length):0;
 const ambitiousAvg=goals.length?Math.round(goals.reduce((v,g)=>v+goalProgress(g),0)/goals.length):0;
 const daysPlanned=dates.filter(d=>Number(days[d]?.important||0)>0);
 const mainDone=daysPlanned.filter(d=>Number(days[d]?.done_important||0)>=Number(days[d]?.important||0)).length;
 const challenges=os6.challenges.map(c=>({id:c.id,title:c.title,target:c.target_days,days:os6.challengeDays.filter(d=>d.challenge_id===c.id).length}));
 const focusSessions=os6.focus.filter(f=>f.state==='finished'&&f.finished_at&&f.finished_at.slice(0,10)>=start&&f.finished_at.slice(0,10)<=today);const focusTotal=focusSessions.reduce((n,f)=>n+Math.max(0,Math.round(f.accumulated_seconds/60)),0);
 const focusByTask=Object.entries(focusSessions.reduce((a,f)=>{const k=f.task_id||'none';a[k]=(a[k]||0)+Math.max(0,Math.round(f.accumulated_seconds/60));return a},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
  const focusTaskNames=new Map([...tasks,...buffer].map(task=>[task.id,task.title]));
  const focusTitle=(taskId:string)=>taskId==='none'?'Без привязки':focusTaskNames.get(taskId)||focusSessions.find(session=>session.task_id===taskId)?.title?.trim()||'Удалённая задача';
 const earnedEntries=Object.entries(income.totals).sort(([a],[b])=>a.localeCompare(b));
 const backlog=categories.map(c=>({id:c.id,name:c.name,color:c.color,count:buffer.filter(t=>t.os61_category_id===c.id||t.sphere===c.name).length})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
 const untagged=buffer.length-backlog.reduce((v,c)=>v+c.count,0);
 return <div className="page-stack mvp-analytics">
  <div className="page-heading"><div><p className="eyebrow">ПРОГРЕСС И РЕЗУЛЬТАТ</p><h1>Аналитика</h1><p>Цели, действия, дисциплина и подтверждённый доход</p></div><div className="mvp-period" role="group" aria-label="Период аналитики">{keys.map(([n,label])=><button key={n} className={period===n?'selected':''} onClick={()=>setPeriod(n)} aria-pressed={period===n}>{label}</button>)}</div></div>
  {error&&<Card><p role="alert" className="os-inline-error">{error}. Проверь Edge Function os9 и её журналы: Data API / Secrets / Verify JWT. Задачи и цели доступны независимо.</p></Card>}
  <div className="mvp-kpi-grid">
   <Card className="mvp-kpi"><span>Обычные цели</span><strong><MotionNumber value={goalAvg}/>%</strong><ProgressBar value={goalAvg}/><small>{regularGoals.length} целей · текущий прогресс</small><button onClick={()=>open('goals')}>Смотреть цели <Icon name="right" size={15}/></button></Card>
   <Card className="mvp-kpi"><span>Амбициозные цели</span><strong><MotionNumber value={ambitiousAvg}/>%</strong><ProgressBar value={ambitiousAvg}/><small>{goals.length} целей · текущий прогресс</small><button onClick={()=>open('goals')}>Смотреть цели <Icon name="right" size={15}/></button></Card>
   <Card className="mvp-kpi"><span>Выполненные задачи</span><strong><MotionNumber value={completed}/></strong><small>{period===30?'С начала месяца':`За выбранные ${period} дней`}</small><button onClick={()=>open('today')}>К задачам <Icon name="right" size={15}/></button></Card>
   <Card className="mvp-kpi"><span>Дисциплина</span><strong><MotionNumber value={mainDone}/><small> / {daysPlanned.length}</small></strong><ProgressBar value={progress(mainDone,daysPlanned.length)}/><small>Дней с закрытым главным планом (из дней с планом)</small><button onClick={()=>open('discipline')}>История <Icon name="right" size={15}/></button></Card>
  </div>
  <div className="mvp-analysis-columns">
   <Card><SectionHead title="Динамика действий" caption={loading?'Обновляем…':`${shortDay(start)} — ${shortDay(today)}`}/><div className="mvp-heatmap" role="list" aria-label="Выполненные задачи по дням">{dates.map(d=>{const done=days[d]?.tasks||0;return <div key={d} role="listitem" className="mvp-heat-cell" style={{background:done>0?`rgba(130,119,234,${Math.min(.2+done*.16,.94)})`:'#F1EFFC'}} title={`${prettyDay(d)}: ${done} выполнено`} aria-label={`${shortDay(d)}: ${done} задач`}/>} )}</div><p className="mvp-muted">Каждая клетка — один день. Чем ярче цвет, тем больше выполненных задач.</p></Card>
   <Card><SectionHead title="Полученный доход" caption="Из рабочих задач-страниц"/>
    {earnedEntries.length?earnedEntries.map(([currency,amount])=><div className="mvp-income-row" key={currency}><span>{currency}</span><strong>{number(amount)} {currencySymbol(currency)}</strong></div>):<p className="mvp-muted">Нет подтверждённого дохода за период. В рабочей задаче укажи сумму и отметь «Деньги получены».</p>}
    <p className="mvp-muted">Доход учитывается по дате получения. Разные валюты не складываются без конвертации.</p>
   </Card>
  </div>
  <Card><div className="card-title-row"><div><span className="eyebrow">БУФЕР ЗАДАЧ</span><h2>Что ждёт планирования</h2></div><button className="btn text" onClick={()=>open('buffer')}>Открыть буфер <Icon name="right" size={16}/></button></div>
   <div className="mvp-backlog-total"><strong>{buffer.length}</strong><span>записей без запланированной даты</span></div>
   <div className="mvp-backlog-groups">{backlog.map(c=><div key={c.id}><span><i style={{background:c.color}}/>{c.name}</span><strong>{c.count}</strong></div>)}{untagged>0&&<div><span>Без категории</span><strong>{untagged}</strong></div>}</div>
   <p className="mvp-muted">Буфер — место для захвата идей, не показатель неуспеха. Переноси в день только задачи, которые действительно собираешься делать.</p>
  </Card>
  <Card><div className="card-title-row"><div><span className="eyebrow">ЛИЧНЫЕ ВЫЗОВЫ</span><h2>Прогресс вызовов</h2></div><button className="btn text" onClick={()=>open('challenges')}>Все вызовы <Icon name="right" size={16}/></button></div>
   {!challenges.length?<p className="mvp-muted">Пока нет активных вызовов. Можно начать с небольшого ежедневного действия.</p>:<div className="mvp-challenge-grid">{challenges.map(c=><div key={c.id} className="mvp-challenge"><div><strong>{c.title}</strong><span>{c.days}/{c.target} дней</span></div><ProgressBar value={progress(c.days,c.target)}/></div>)}</div>}
  </Card>
  <Card><SectionHead title="Фокус по задачам" caption={`${focusTotal} минут завершённых сессий за выбранный период`}/><div className="mvp-focus-layout"><div className="mvp-focus-ring" style={{background:`conic-gradient(#8b84ed ${focusTotal?Math.min(100,focusByTask[0]?.[1]/focusTotal*100):0}%, #e9e9f5 0)`}}><div><strong><MotionNumber value={focusTotal}/></strong><small>мин</small></div></div><div className="mvp-focus-tasks">{focusByTask.slice(0,6).map(([taskId,mins])=><div key={taskId}><span>{focusTitle(taskId)}</span><strong>{mins} мин</strong></div>)}{!focusTotal&&<p className="mvp-muted">Начни фокус-сессию на странице задачи, чтобы отслеживать время.</p>}</div></div></Card>
  <Card><SectionHead title="Цели и связь с действиями"/><p className="mvp-muted">Если у обычной цели есть связанные задачи, её процент рассчитывается автоматически. Для остальных сохраняется ручной прогресс. Историю из одного значения не строим.</p><div className="mvp-goals-list">{regularGoals.slice(0,5).map(g=>{const measure=regularGoalValues(g,goalStats);return <div key={g.id}>
 <span>{g.title}{goalLinks[g.id]?.total?` · ${goalLinks[g.id].done}/${goalLinks[g.id].total} связанных задач`:''}</span>
 <strong>{goalEvidence(g,goalStats).progress}%</strong>
 <GoalValues current={measure.current} target={measure.target} unit={measure.unit} compact/>
 <ProgressBar value={goalEvidence(g,goalStats).progress}/><small>{measure.source}</small>
 </div>})}</div><button className="btn text" onClick={()=>open('goals')}>Управлять целями <Icon name="right" size={16}/></button></Card>
 </div>;
}
