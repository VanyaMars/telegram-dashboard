import React,{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {Category,CloudStatus,DayMetrics,Goal,GoalPoint,OS6Data,Tab,Task,TaskPriority} from './types';
import {request} from './lib/api';
import {initData,setupTelegram,haptic} from './lib/telegram';
import {isQAMode} from './qa/sandbox';
import {dateInZone,initialTimezone,mondayOf,metricRange,dateAdd} from './lib/date';
import {tabFromHash,hashForTab,loadSelectedDay,rememberSelectedDay} from './lib/navigation';
import {demoToday,demoTasks,demoGoals,demoCategories,demoOS6,demoGoalHistory} from './lib/demo';

type Editor={type:'task'|'goal'|'finance'|'workout'|'weight'|'exercise'|'repeat'|'challenge';item?:any;day?:string|null;priority?:TaskPriority} | null;
type AppContextValue={
  demo:boolean;ready:boolean;error:string;status:CloudStatus;tz:string;today:string;day:string;setDay:(d:string)=>void;
  tab:Tab;open:(t:Tab)=>void;sidebar:boolean;setSidebar:(v:boolean)=>void;help:boolean;setHelp:(v:boolean)=>void;
  tasks:Task[];buffer:Task[];goals:Goal[];goalHistory:GoalPoint[];categories:Category[];os6:OS6Data;
  metrics:Record<string,DayMetrics>;previousMetrics:Record<string,DayMetrics>;legacyRows:any[];
  editor:Editor;setEditor:(e:Editor)=>void;message:string;notify:(m:string)=>void;recentDeleted:Task|null;undoDelete:()=>Promise<void>;
  openTaskPage:(task:Task)=>Promise<void>;refresh:()=>Promise<void>;saveTask:(form:any)=>Promise<void>;toggleTask:(task:Task)=>Promise<void>;deleteTask:(task:Task)=>Promise<void>;
  reorder:(id:string,section:'important'|'extra'|'buffer',beforeId?:string|null)=>Promise<void>;
  saveGoal:(form:any)=>Promise<void>;deleteGoal:(goal:Goal)=>Promise<void>;
  saveCategory:(form:any)=>Promise<void>;deleteCategory:(cat:Category)=>Promise<void>;
  mutate:(fn:'os6'|'os61'|'dashboard',action:string,data?:Record<string,unknown>)=>Promise<any>;
  calendarTasks:Task[];getCalendar:(start:string,end:string)=>Promise<void>;
};
const Context=createContext<AppContextValue|null>(null);
const emptyOS6:OS6Data={...demoOS6,links:[],finance:[],workouts:[],weight:[],repeats:[],challenges:[],challengeDays:[],reviews:[],focus:[],exercises:[],kpiHistory:[]};
const sorted=(items:Task[])=>[...items].sort((a,b)=>(Number(a.os61_position??9999999)-Number(b.os61_position??9999999))||String(a.created_at||'').localeCompare(String(b.created_at||'')));
const blankMetrics={tasks:0,sales:0,sport:0,important:0,extras:0,done_important:0,done_extras:0};
function metricsForTasks(tasks:Task[],day:string):DayMetrics{
  const rows=tasks.filter(t=>t.day===day);
  return {...blankMetrics,tasks:rows.filter(t=>t.completed).length,important:rows.filter(t=>t.priority==='important').length,
    extras:rows.filter(t=>t.priority==='extra').length,done_important:rows.filter(t=>t.priority==='important'&&t.completed).length,
    done_extras:rows.filter(t=>t.priority==='extra'&&t.completed).length};
}
export function AppProvider({children}:{children:React.ReactNode}){
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  const [tz,setTZ]=useState(initialTimezone());const [today,setToday]=useState(()=>dateInZone(new Date(),initialTimezone()));
  const [day,setDay]=useState(()=>loadSelectedDay(today));const dayRef=useRef(day);dayRef.current=day;
  useEffect(()=>{rememberSelectedDay(day)},[day]);
  const [tab,setTab]=useState<Tab>(()=>tabFromHash(location.hash));const [sidebar,setSidebar]=useState(false);const [help,setHelp]=useState(false);
  const [ready,setReady]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState<CloudStatus>('connecting');
  const [tasks,setTasks]=useState<Task[]>([]);const [buffer,setBuffer]=useState<Task[]>([]);
  const [goals,setGoals]=useState<Goal[]>([]);const [goalHistory,setGoalHistory]=useState<GoalPoint[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);const [os6,setOS6]=useState<OS6Data>(emptyOS6);
  const [metrics,setMetrics]=useState<Record<string,DayMetrics>>({});const [previousMetrics,setPrevMetrics]=useState<Record<string,DayMetrics>>({});
  const [legacyRows,setLegacyRows]=useState<any[]>([]);const [calendarTasks,setCalendarTasks]=useState<Task[]>([]);
  const [editor,setEditor]=useState<Editor>(null);const [message,setMessage]=useState('');const [recentDeleted,setRecentDeleted]=useState<Task|null>(null);
  const togglesInFlight=useRef(new Set<string>());
  const notify=(m:string)=>{setMessage(m);};
  const open=(t:Tab)=>{const nextTab=t==='workspace'?'buffer':t;const hash=hashForTab(t);if(window.location.hash!==hash)window.location.hash=hash;setTab(nextTab);setSidebar(false);setEditor(null);window.scrollTo({top:0,behavior:'smooth'});};
  useEffect(()=>{const handle=()=>setTab(tabFromHash(window.location.hash));window.addEventListener('hashchange',handle);return()=>window.removeEventListener('hashchange',handle)},[]);
  const readDays=useCallback(async(d:string)=>{
    if(demo){setTasks(sorted(demoTasks.filter(t=>t.day===d)));setBuffer(sorted(demoTasks.filter(t=>t.day===null)));return;}
    const data=await request<{daily:Task[];buffer:Task[]}>('dashboard','tasks_list',{day:d});
    setTasks(sorted(data.daily||[]));setBuffer(sorted(data.buffer||[]));
  },[demo]);
  const reload=useCallback(async(d:string,timezone:string)=>{
    if(demo){
      setTasks(sorted(demoTasks.filter(t=>t.day===d)));setBuffer(sorted(demoTasks.filter(t=>t.day===null)));setCategories(demoCategories);
      setGoals(demoGoals);setGoalHistory(demoGoalHistory);setOS6(demoOS6);
      const m=mondayOf(d);const dayMap:Record<string,DayMetrics>={};for(let i=0;i<7;i++){const date=dateAdd(m,i);dayMap[date]=metricsForTasks(demoTasks,date);}
      setMetrics(dayMap);setPrevMetrics({});setLegacyRows([]);setStatus('demo');setReady(true);setError('');return;
    }
    setStatus('connecting');
    try{
      // dashboard creates the profile before os6_settings uses its foreign key.
      await request('dashboard','read',{week:mondayOf(d)});
      const firstOS6=await request<OS6Data>('os6','bootstrap');
      const initialized=await request<{tz:string;today:string;categories:Category[]}>('os61','bootstrap',{deviceTimezone:initialTimezone()});
      const actualTZ=initialized.tz;const actualToday=initialized.today;
      setTZ(actualTZ);setToday(actualToday);setCategories(initialized.categories||[]);setOS6({...firstOS6,settings:{...firstOS6.settings,tz:actualTZ}});
      setDay(prev=>prev===today?actualToday:prev);
      const actualDay=dayRef.current===today?actualToday:dayRef.current;
      const monday=mondayOf(actualToday),{start,end}=metricRange(monday);
      const [list,goalData,legacy,weekMetrics]=await Promise.all([
        request<{daily:Task[];buffer:Task[]}>('dashboard','tasks_list',{day:actualDay}),
        request<{goals:Goal[];history:GoalPoint[]}>('dashboard','goals_list'),
        request<{days:any[]}>('dashboard','read',{week:monday}),
        request<{days:Record<string,DayMetrics>}>('os6','metrics',{start,end})
      ]);
      setTasks(sorted(list.daily||[]));setBuffer(sorted(list.buffer||[]));setGoals(goalData.goals||[]);
      setGoalHistory(goalData.history||[]);setLegacyRows(legacy.days||[]);
      setMetrics(weekMetrics.days||{});setPrevMetrics(weekMetrics.days||{});
      setStatus('saved');setReady(true);setError('');
    }catch(e:any){setError(e.message||'Не удалось подключиться');setStatus('error');setReady(true);}
  },[demo,today]);
  useEffect(()=>{setupTelegram();if(!demo&&!isQAMode()&&!initData()){setStatus('error');setReady(true);setError('Открой приложение через бота ProDesk в Telegram.');return;}
    void reload(today,tz);
    // Initial user authentication is done only at the verified server.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{const tick=()=>{
    const next=dateInZone(new Date(),tz);
    if(next!==today){setToday(next);setDay(d=>d===today?next:d);if(ready)void reload(dayRef.current===today?next:dayRef.current,tz);}
  };const timer=setInterval(tick,20000);
  const visible=()=>{if(!document.hidden&&ready)void reload(dayRef.current,tz);};
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
  },[tz,today,ready,reload]);
  // Every selected date, including a return to today, must load the matching tasks.
  useEffect(()=>{if(!ready||status==='error')return;void readDays(day);
  // Avoid stale 'today' comparisons that made the Home screen show yesterday's tasks.
  },[day,ready,readDays]);
  useEffect(()=>{if(!message)return;const t=setTimeout(()=>{setMessage('');setRecentDeleted(null);},recentDeleted&&message==='Задача удалена'?8000:5500);return()=>clearTimeout(t)},[message,recentDeleted]);
  const refresh=async()=>{await reload(dayRef.current,tz);};
  const openTaskPage=async(task:Task)=>{
    if(demo){notify('Открой Mini App через Telegram для редактирования страниц задач');return;}
    try{setStatus('saving');const r=await request<{pageId:string}>('os8','task_page_ensure',{taskId:task.id});
      setTab('buffer');setSidebar(false);window.location.hash='#/page/'+r.pageId;setStatus('saved');
    }catch(e:any){setStatus('error');notify(e.message||'Не удалось открыть страницу задачи');}
  }; 
  const mutate=async(fn:'os6'|'os61'|'dashboard',action:string,data:Record<string,unknown>={})=>{
    if(demo){notify('Это демонстрация. Для сохранения открой Mini App через Telegram.');return {ok:true};}
    setStatus('saving');try{const r=await request(fn,action,data);await reload(dayRef.current,tz);setStatus('saved');return r;}
    catch(e:any){setStatus('error');notify(e.message||'Не удалось сохранить');throw e;}
  };
  const saveTask=async(form:any)=>{
    if(demo){const mock:Task={id:form.id||`demo-${Date.now()}`,title:form.title,notes:form.notes||'',sphere:form.sphere,day:form.day||null,priority:form.priority||'extra',completed:false};
      if(mock.day){setTasks(ts=>sorted([...ts.filter(t=>t.id!==mock.id),mock]));}else setBuffer(ts=>sorted([...ts.filter(t=>t.id!==mock.id),mock]));setEditor(null);notify('Добавлено в демонстрацию');return;}
    setStatus('saving');
    try{
      const name=categories.find(c=>c.id===form.categoryId)?.name||form.sphere||'Без категории';
      const task={title:form.title.trim(),notes:form.notes||'',sphere:name,day:form.day||null,priority:form.priority||'extra'};
      // Moving/editing a task without an explicit goal selection must preserve its existing ambitious-goal link.
      const linkedGoalId=form.goalId===undefined?(os6.links.find(link=>link.task_id===form.id)?.goal_id||null):(form.goalId||null);
      const result=await request<{id:string}>('os6','task_save_and_link',{id:form.id||null,task,goal_id:linkedGoalId});
      if(form.categoryId!==undefined)await request('os61','task_category_set',{id:result.id,categoryId:form.categoryId||null});
      setEditor(null);haptic();await reload(dayRef.current,tz);notify('Задача сохранена');
    }catch(e:any){setStatus('error');notify(e.message||'Ошибка сохранения');throw e;}
  };
  const toggleTask=async(task:Task)=>{
    if(togglesInFlight.current.has(task.id))return;
    togglesInFlight.current.add(task.id);
    const next={...task,completed:!task.completed};
    setTasks(x=>x.map(t=>t.id===task.id?next:t));
    let committed=false;
    try{
      if(demo){haptic();return;}
      await request('dashboard','task_toggle',{id:task.id,completed:next.completed});
      committed=true;haptic();
      await reload(dayRef.current,tz);
    }catch(e:any){
      if(!committed)setTasks(x=>x.map(t=>t.id===task.id?task:t));
      notify((committed?'Задача сохранена, но не удалось обновить список: ':'Не удалось обновить задачу: ')+(e?.message||'Ошибка связи'));
    }finally{togglesInFlight.current.delete(task.id);}
  };
  const deleteTask=async(task:Task)=>{
    if(!demo){await request('dashboard','task_delete',{id:task.id});await reload(dayRef.current,tz);}
    else {setTasks(x=>x.filter(t=>t.id!==task.id));setBuffer(x=>x.filter(t=>t.id!==task.id));}
    setRecentDeleted(task);notify('Задача удалена');
  };
  const undoDelete=async()=>{
    const task=recentDeleted;if(!task)return;
    try{
      if(!demo){await request('dashboard','task_restore',{id:task.id,task:{title:task.title,notes:task.notes,sphere:task.sphere,day:task.day,priority:task.priority},completed:task.completed});
        if(task.os61_category_id)await request('os61','task_category_set',{id:task.id,categoryId:task.os61_category_id});
        await reload(dayRef.current,tz);
      }else{if(task.day)setTasks(x=>sorted([...x,task]));else setBuffer(x=>sorted([...x,task]));}
      setRecentDeleted(null);notify('Задача восстановлена');
    }catch(e:any){notify('Не удалось восстановить: '+e.message);}
  };
  const reorder=async(id:string,section:'important'|'extra'|'buffer',beforeId:string|null=null)=>{
    const all=sorted([...tasks,...buffer]),moving=all.find(t=>t.id===id);if(!moving)return;
    const nextDay=section==='buffer'?null:dayRef.current;const nextPriority=section==='buffer'?'extra':section;
    const rest=all.filter(t=>t.id!==id);
    const zone=rest.filter(t=>t.day===nextDay&&(nextDay===null||t.priority===nextPriority));
    const targetIdx=beforeId?zone.findIndex(t=>t.id===beforeId):-1;
    const insertAt=targetIdx>=0?targetIdx:zone.length;
    zone.splice(insertAt,0,{...moving,day:nextDay,priority:nextPriority,completed:moving.day===nextDay?moving.completed:false});
    const orderById=new Map(zone.map((t,i)=>[t.id,(i+1)*1024]));
    const next=rest.filter(t=>!orderById.has(t.id)).concat(zone.map(t=>({...t,os61_position:orderById.get(t.id)})));
    const oldTasks=tasks,oldBuffer=buffer;
    setTasks(sorted(next.filter(t=>t.day===dayRef.current)));setBuffer(sorted(next.filter(t=>t.day===null)));
    if(demo){haptic();return;}
    const sections=[{d:moving.day,p:moving.priority},{d:nextDay,p:nextPriority}];
    const affected=next.filter(t=>sections.some(s=>t.day===s.d&&(s.d===null||t.priority===s.p)));
    const rows=affected.map(t=>({id:t.id,day:t.day,priority:t.priority,position:Number(t.os61_position||1024)}));
    try{setStatus('saving');await request('os61','task_reorder',{items:rows});haptic();await reload(dayRef.current,tz);}
    catch(e:any){setTasks(oldTasks);setBuffer(oldBuffer);setStatus('error');notify('Перестановка не сохранена: '+e.message);}
  };
  const saveGoal=async(form:any)=>{if(demo){notify('Демо: изменение цели');setEditor(null);return;}
    await mutate('dashboard','goal_save',{id:form.id||null,goal:{title:form.title,notes:form.notes||'',sphere:form.sphere||'Личное',start_value:Number(form.start_value),current_value:Number(form.current_value),target_value:Number(form.target_value),unit:form.unit||'',deadline:form.deadline||null}});setEditor(null);notify('Цель обновлена');};
  const deleteGoal=async(goal:Goal)=>{if(!window.confirm('Удалить цель вместе с историей?'))return;if(demo){setGoals(x=>x.filter(g=>g.id!==goal.id));return;}await mutate('dashboard','goal_delete',{id:goal.id});};
  const saveCategory=async(form:any)=>{if(demo){const c={...form,id:form.id||`cat-${Date.now()}`,sort_order:categories.length*100};setCategories(x=>[...x.filter(y=>y.id!==c.id),c]);notify('Категория сохранена (демо)');return;}
    await mutate('os61','category_save',form);notify('Категория сохранена');};
  const deleteCategory=async(cat:Category)=>{if(!window.confirm(`Удалить «${cat.name}»? Задачи останутся в «Без категории».`))return;
    if(demo){setCategories(x=>x.filter(c=>c.id!==cat.id));return;}await mutate('os61','category_delete',{id:cat.id});notify('Категория удалена, задачи сохранены');};
  const getCalendar=async(start:string,end:string)=>{
    if(demo){setCalendarTasks(demoTasks.filter(t=>t.day&&t.day>=start&&t.day<=end));return;}
    try{const r=await request<{tasks:Task[]}>('os6','calendar',{start,end});setCalendarTasks(r.tasks||[]);}catch(e:any){notify(e.message);}
  };
  const value:AppContextValue={demo,ready,error,status,tz,today,day,setDay,tab,open,sidebar,setSidebar,help,setHelp,
    tasks,buffer,goals,goalHistory,categories,os6,metrics,previousMetrics,legacyRows,editor,setEditor,message,notify,recentDeleted,undoDelete,
    openTaskPage,refresh,saveTask,toggleTask,deleteTask,reorder,saveGoal,deleteGoal,saveCategory,deleteCategory,mutate,calendarTasks,getCalendar};
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useApp=()=>{const v=useContext(Context);if(!v)throw Error('No AppProvider');return v;};
