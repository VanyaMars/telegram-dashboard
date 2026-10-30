import React,{useEffect,useState} from 'react';
import {useApp} from './AppContext';
import {Icon} from './components/Icons';
import {Dialog,StatusToast} from './components/UI';
import {MotionRoute} from './components/OSMotion';
import {isQAMode} from './qa/sandbox';
import {APP_BUILD_LABEL} from './lib/version';
import * as m from 'motion/react-m';
import {useReducedMotion} from 'motion/react';
import {motionTokens} from './components/motionTokens';
import {TaskEditor} from './components/Tasks';
import {HomePage,TodayPage,GoalsPage,GoalEditor,AnalyticsPage} from './pages/CorePages';
import {CalendarPage,TomorrowPage,FinancePage,SportPage,FocusPage,ChallengesPage,RepeatsPage,ReviewPage,DisciplinePage,CategoriesPage,SettingsPage,HelpPage,EntityEditor} from './pages/ExtraPages';
import type {Tab} from './types';
import {telegram} from './lib/telegram';
import {BufferWorkspacePage} from './pages/BufferWorkspace';
import {MvpAnalyticsPage} from './pages/MvpAnalytics';
import {PlanningPage} from './pages/PlanningPage';
import {HabitsPage} from './pages/HabitsPage';
import './styles.css';
import './premium.css';
import './shell.css';
const primary:Array<{id:Tab;label:string;icon:string}>=[{id:'home',label:'Главное',icon:'home'},{id:'today',label:'Сегодня',icon:'calendar-check'},{id:'goals',label:'Цели',icon:'target'},{id:'analytics',label:'Аналитика',icon:'chart'}];
const workspaceNav:{id:Tab;label:string;icon:string}={id:'buffer',label:'Буфер задач',icon:'inbox'};
const incomeNav:{id:Tab;label:string;icon:string}={id:'income',label:'Доходы',icon:'wallet'};
const mobilePrimary=[primary[1],workspaceNav,primary[2]];
const secondary:Array<{id:Tab;label:string;icon:string}>=[{id:'calendar',label:'Календарь',icon:'calendar'},{id:'tomorrow',label:'Планирование',icon:'calendar-check'},{id:'focus',label:'Фокус-таймер',icon:'timer'},{id:'challenges',label:'Привычки',icon:'check-circle'},{id:'repeats',label:'Повторения',icon:'repeat'}];
const appNames=Object.fromEntries([...primary,workspaceNav,incomeNav,...secondary,{id:'settings',label:'Настройки'},{id:'categories',label:'Категории'},{id:'help',label:'Помощь'}].map(x=>[x.id,x.label]));
function useRouteHash(){
 const [hash,setHash]=useState(()=>window.location.hash);
 useEffect(()=>{const onChange=()=>setHash(window.location.hash);window.addEventListener('hashchange',onChange);return()=>window.removeEventListener('hashchange',onChange)},[]);
 return hash;
}
function NavItem({id,label,icon,routeHash}:{id:Tab;label:string;icon:string;routeHash?:string}){
 const {tab,open}=useApp();const reduced=useReducedMotion();
 const hash=routeHash??window.location.hash;
 const isPage=hash==='#/workspace'||hash.startsWith('#/page/');
 const active=id==='buffer'?(tab==='buffer'||isPage):tab===id;
 return <button className={'nav-link '+(active?'selected':'')} onClick={()=>open(id)}
  aria-current={active?'page':undefined}>
  {active&&<m.span layoutId="os-sidebar-selection" className="premium-nav-selection"
    aria-hidden="true" initial={false} transition={reduced?{duration:0}:motionTokens.selection}/>}
  <Icon name={icon} size={19}/><span>{label}</span>
  {active&&<span className="active-nav-dot" aria-hidden="true"/>}
 </button>;
}
function Sidebar(){
 const {sidebar,setSidebar}=useApp(),hash=useRouteHash();
 return <>
  <div className={'sidebar-scrim '+(sidebar?'visible':'')} onClick={()=>setSidebar(false)} aria-hidden="true"/>
  <aside className={'app-sidebar '+(sidebar?'is-open':'')} aria-label="Боковая навигация">
   <div className="brand"><div className="brand-logo"><Icon name="sparkles" size={23}/></div><div><strong>Personal OS</strong><small>Твоя система прогресса</small></div><button className="mobile-close icon-btn" onClick={()=>setSidebar(false)} aria-label="Закрыть меню"><Icon name="x"/></button></div>
   <nav className="sidebar-scroll">
    <span className="sidebar-section-label">ОСНОВНОЕ</span>
    {primary.map(n=><NavItem key={n.id} {...n} routeHash={hash}/>)}
    <NavItem {...workspaceNav} routeHash={hash}/>
    <NavItem {...incomeNav} routeHash={hash}/>
    <span className="sidebar-section-label">ИНСТРУМЕНТЫ</span>
    {secondary.map(n=><NavItem key={n.id} {...n} routeHash={hash}/>)}
    <span className="sidebar-section-label">НАСТРОЙКА</span>
    <NavItem id="settings" label="Настройки" icon="settings" routeHash={hash}/>
    <NavItem id="help" label="Помощь" icon="help" routeHash={hash}/>
   </nav>
   <div className="sidebar-bottom"><div className="sidebar-footer-logo">{isQAMode()?<><Icon name="check-circle" size={16}/> Данные только в браузере</>:<><Icon name="cloud-check" size={16}/> Синхронизация с облаком</>}</div><span className="version">{APP_BUILD_LABEL}</span></div>
  </aside>
 </>;
}
function Header(){const{tab,setSidebar,status,refresh,setHelp,demo}=useApp();
  const mobileLabel=appNames[tab]||'Personal OS';
  const qa=isQAMode();
  const cloud=qa?'refresh':status==='saved'?'cloud-check':status==='error'?'cloud-off':'cloud';
  return <header className="topbar"><div className="topbar-left"><button className="icon-btn hamburger" onClick={()=>setSidebar(true)} aria-label="Открыть меню"><Icon name="menu" size={23}/></button><span className="mobile-title">{mobileLabel}</span></div>
    <div className="topbar-right">{isQAMode()?<span className="demo-tag">QA · ЛОКАЛЬНО</span>:demo&&<span className="demo-tag">ДЕМО</span>}<button className={'icon-btn cloud-button '+(qa?'local':status)} onClick={()=>void refresh()} title={qa?'Обновить локальные тестовые данные':status==='saved'?'Синхронизировано':status==='saving'?'Сохраняем':'Обновить облако'} aria-label={qa?'Обновить локальные тестовые данные':'Обновить облачные данные'}><Icon name={cloud} size={21}/></button>
      <button className="icon-btn" onClick={()=>setHelp(true)} aria-label="Открыть справку"><Icon name="help" size={21}/></button></div>
  </header>;
}
function BottomNav(){return <nav className="bottom-nav" aria-label="Основная навигация">{mobilePrimary.map(n=><BottomItem key={n.id} {...n}/>) }<MoreBottomItem/></nav>}
function BottomItem({id,label,icon}:{id:Tab;label:string;icon:string}){
  const{tab,open}=useApp();const reduced=useReducedMotion();const hash=useRouteHash();
  const inPages=hash==='#/workspace'||hash.startsWith('#/page/');
  const active=id==='buffer'?(tab==='buffer'||inPages):tab===id;
 return <button className={active?'current':''} onClick={()=>open(id)} aria-label={label} aria-current={active?'page':undefined}>
  {active&&<m.span className="motion-bottom-pill" layoutId="os-bottom-active" aria-hidden="true"
   initial={false} transition={reduced?{duration:0}:motionTokens.selection}/>}
  <Icon name={icon} size={22}/><span>{label}</span>
 </button>;
}
function MoreBottomItem(){
  const {tab,sidebar,setSidebar}=useApp();const reduced=useReducedMotion();
  const active=!(['today','buffer','goals'] as Tab[]).includes(tab);
 return <button className={active?'current':''} type="button" onClick={()=>setSidebar(true)}
  aria-label="Ещё" aria-expanded={sidebar}>
  {active&&<m.span className="motion-bottom-pill" layoutId="os-bottom-active"
   aria-hidden="true" initial={false} transition={reduced?{duration:0}:motionTokens.selection}/>}
  <Icon name="menu" size={22}/><span>Ещё</span>
 </button>;
}
function Route(){const{tab}=useApp();switch(tab){case 'workspace':return <BufferWorkspacePage/>;case 'home':return <HomePage/>;case 'today':return <TodayPage/>;case 'buffer':return <BufferWorkspacePage/>;case 'goals':return <GoalsPage/>;case 'analytics':return <MvpAnalyticsPage/>;case 'income':return <MvpAnalyticsPage focusIncome/>;case 'calendar':return <CalendarPage/>;case 'tomorrow':return <PlanningPage/>;case 'finance':return <FinancePage/>;case 'sport':return <SportPage/>;case 'focus':return <FocusPage/>;case 'challenges':return <HabitsPage/>;case 'repeats':return <RepeatsPage/>;case 'review':return <ReviewPage/>;case 'discipline':return <HabitsPage/>;case 'categories':return <CategoriesPage/>;case 'settings':return <SettingsPage/>;default:return <HelpPage/>;}}
function ActiveModal(){const{editor,setEditor}=useApp();if(!editor)return null;
  const labels={task:editor.item?'Изменить задачу':'Новая задача',goal:editor.item?'Изменить цель':'Новая цель',finance:'Финансовая запись',workout:'Тренировка',weight:'Замер веса',exercise:'Упражнение',repeat:'Повторение',challenge:'Личный вызов'};
  return <Dialog open onClose={()=>setEditor(null)} title={labels[editor.type]}>
    <div key={editor.item?.id||editor.type}>{editor.type==='task'?<TaskEditor/>:editor.type==='goal'?<GoalEditor/>:<EntityEditor/>}</div>
  </Dialog>;
}
function HelpSheet(){const{help,setHelp,open}=useApp();return <Dialog open={help} onClose={()=>setHelp(false)} title="Справка"><div className="help-sheet">
  <p>Personal OS помогает действовать: выбери главную задачу, отмечай сделанное и следи за результатами.</p>
  <div className="help-tip"><Icon name="grip"/><span>Зажми ручку задачи и перетащи её в нужное место.</span></div>
  <div className="help-tip"><Icon name={isQAMode()?'check-circle':'cloud-check'}/><span>{isQAMode()?'QA Sandbox хранит тестовые данные только в этом браузере.':'Облако вверху показывает состояние синхронизации с Supabase.'}</span></div>
  <div className="help-tip"><Icon name="calendar"/><span>«Сегодня» определяется по часовому поясу твоего профиля.</span></div>
  <button className="btn accent full" onClick={()=>{setHelp(false);open('help')}}>Полная справка</button>
  </div></Dialog>}
export default function App(){const{ready,error,refresh,tab}=useApp();
  useEffect(()=>{const app=telegram();const back=()=>{const modal=document.querySelector('.modal-backdrop');if(modal){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return;}window.history.back()};
    app?.BackButton?.onClick?.(back);return()=>{app?.BackButton?.offClick?.(back)}},[]);
  return <div className="app-shell"><Sidebar/><div className="app-center"><Header/>
    {!ready?<div className="full-loading"><div className="loading-orb"><Icon name="sparkles" size={29}/></div><strong>Personal OS</strong><span>Загружаем твой прогресс…</span></div>
      :error?<div className="full-loading error-view"><div className="loading-orb"><Icon name="cloud-off" size={28}/></div><strong>Не удалось подключиться</strong><p>{error}</p><button className="btn accent" onClick={()=>void refresh()}><Icon name="refresh"/> Повторить</button></div>
      :<main className="app-content"><MotionRoute screen={tab}><Route/></MotionRoute></main>}
    <footer className="mobile-footer-version">{isQAMode()?'QA · Локальные данные · ':''}{APP_BUILD_LABEL}</footer><BottomNav/>
  </div><ActiveModal/><HelpSheet/><StatusToast/></div>;
}
