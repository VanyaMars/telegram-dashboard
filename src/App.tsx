import React,{useEffect} from 'react';
import {useApp} from './AppContext';
import {Icon} from './components/Icons';
import {Dialog,StatusToast} from './components/UI';
import {TaskEditor} from './components/Tasks';
import {HomePage,TodayPage,BufferPage,GoalsPage,GoalEditor,AnalyticsPage} from './pages/CorePages';
import {CalendarPage,TomorrowPage,FinancePage,SportPage,FocusPage,ChallengesPage,RepeatsPage,ReviewPage,DisciplinePage,CategoriesPage,SettingsPage,HelpPage,EntityEditor} from './pages/ExtraPages';
import type {Tab} from './types';
import {telegram} from './lib/telegram';
import {WorkspacePage} from './pages/Workspace';
import './styles.css';
const primary:Array<{id:Tab;label:string;icon:string}>=[{id:'home',label:'Главное',icon:'home'},{id:'today',label:'Сегодня',icon:'calendar-check'},{id:'goals',label:'Цели',icon:'target'},{id:'analytics',label:'Аналитика',icon:'chart'}];
const workspaceNav:{id:Tab;label:string;icon:string}={id:'workspace',label:'Страницы',icon:'folder'};
const secondary:Array<{id:Tab;label:string;icon:string}>=[{id:'buffer',label:'Буфер задач',icon:'inbox'},{id:'calendar',label:'Календарь',icon:'calendar'},{id:'tomorrow',label:'Завтра',icon:'calendar-check'},{id:'finance',label:'Финансы',icon:'wallet'},{id:'sport',label:'Спорт',icon:'dumbbell'},{id:'focus',label:'Фокус-таймер',icon:'timer'},{id:'challenges',label:'Вызовы',icon:'trophy'},{id:'repeats',label:'Повторения',icon:'repeat'},{id:'discipline',label:'Дисциплина',icon:'trend'},{id:'review',label:'Обзор недели',icon:'book-open'}];
const appNames=Object.fromEntries([...primary,workspaceNav,...secondary,{id:'settings',label:'Настройки'},{id:'categories',label:'Категории'},{id:'help',label:'Помощь'}].map(x=>[x.id,x.label]));
function NavItem({id,label,icon}:{id:Tab;label:string;icon:string}){
  const {tab,open}=useApp();return <button className={'nav-link '+(tab===id?'selected':'')} onClick={()=>open(id)} aria-current={tab===id?'page':undefined}>
    <Icon name={icon} size={19}/><span>{label}</span>{tab===id&&<span className="active-nav-dot"/>}
  </button>;
}
function Sidebar(){const{sidebar,setSidebar}=useApp();return <>
  <div className={'sidebar-scrim '+(sidebar?'visible':'')} onClick={()=>setSidebar(false)} aria-hidden="true"/>
  <aside className={'app-sidebar '+(sidebar?'is-open':'')} aria-label="Боковая навигация">
    <div className="brand"><div className="brand-logo"><Icon name="sparkles" size={23}/></div><div><strong>Personal OS</strong><small>Твоя система прогресса</small></div><button className="mobile-close icon-btn" onClick={()=>setSidebar(false)} aria-label="Закрыть меню"><Icon name="x"/></button></div>
    <nav className="sidebar-scroll"><span className="sidebar-section-label">ОСНОВНОЕ</span>{primary.map(n=><NavItem key={n.id} {...n}/>)}<NavItem {...workspaceNav}/>
      <span className="sidebar-section-label">ИНСТРУМЕНТЫ</span>{secondary.map(n=><NavItem key={n.id} {...n}/>)}
      <span className="sidebar-section-label">НАСТРОЙКА</span>
      <NavItem id="categories" label="Категории" icon="folder"/><NavItem id="settings" label="Настройки" icon="settings"/><NavItem id="help" label="Помощь" icon="help"/>
    </nav>
    <div className="sidebar-bottom"><div className="sidebar-footer-logo"><Icon name="cloud-check" size={16}/> Синхронизация с облаком</div><span className="version">Personal OS · v6.2</span></div>
  </aside></>;
}
function Header(){const{tab,setSidebar,status,refresh,setHelp,demo}=useApp();
  const cloud=status==='saved'?'cloud-check':status==='error'?'cloud-off':'cloud';
  return <header className="topbar"><div className="topbar-left"><button className="icon-btn hamburger" onClick={()=>setSidebar(true)} aria-label="Открыть меню"><Icon name="menu" size={23}/></button><span className="mobile-title">{appNames[tab]||'Personal OS'}</span></div>
    <div className="topbar-right">{demo&&<span className="demo-tag">ДЕМО</span>}<button className={'icon-btn cloud-button '+status} onClick={()=>void refresh()} title={status==='saved'?'Синхронизировано':status==='saving'?'Сохраняем':'Обновить облако'} aria-label="Обновить облачные данные"><Icon name={cloud} size={21}/></button>
      <button className="icon-btn" onClick={()=>setHelp(true)} aria-label="Открыть справку"><Icon name="help" size={21}/></button></div>
  </header>;
}
function BottomNav(){return <nav className="bottom-nav" aria-label="Основная навигация">{primary.map(n=><BottomItem key={n.id} {...n}/>)}</nav>}
function BottomItem({id,label,icon}:{id:Tab;label:string;icon:string}){const{tab,open}=useApp();return <button className={tab===id?'current':''} onClick={()=>open(id)} aria-label={label} aria-current={tab===id?'page':undefined}><Icon name={icon} size={22}/><span>{label}</span></button>}
function Route(){const{tab}=useApp();switch(tab){case 'workspace':return <WorkspacePage/>;case 'home':return <HomePage/>;case 'today':return <TodayPage/>;case 'buffer':return <BufferPage/>;case 'goals':return <GoalsPage/>;case 'analytics':return <AnalyticsPage/>;case 'calendar':return <CalendarPage/>;case 'tomorrow':return <TomorrowPage/>;case 'finance':return <FinancePage/>;case 'sport':return <SportPage/>;case 'focus':return <FocusPage/>;case 'challenges':return <ChallengesPage/>;case 'repeats':return <RepeatsPage/>;case 'review':return <ReviewPage/>;case 'discipline':return <DisciplinePage/>;case 'categories':return <CategoriesPage/>;case 'settings':return <SettingsPage/>;default:return <HelpPage/>;}}
function ActiveModal(){const{editor,setEditor}=useApp();if(!editor)return null;
  const labels={task:editor.item?'Изменить задачу':'Новая задача',goal:editor.item?'Изменить цель':'Новая цель',finance:'Финансовая запись',workout:'Тренировка',weight:'Замер веса',exercise:'Упражнение',repeat:'Повторение',challenge:'Личный вызов'};
  return <Dialog open onClose={()=>setEditor(null)} title={labels[editor.type]}>
    <div key={editor.item?.id||editor.type}>{editor.type==='task'?<TaskEditor/>:editor.type==='goal'?<GoalEditor/>:<EntityEditor/>}</div>
  </Dialog>;
}
function HelpSheet(){const{help,setHelp,open}=useApp();return <Dialog open={help} onClose={()=>setHelp(false)} title="Справка"><div className="help-sheet">
  <p>Personal OS помогает действовать: выбери главную задачу, отмечай сделанное и следи за результатами.</p>
  <div className="help-tip"><Icon name="grip"/><span>Зажми ручку задачи и перетащи её в нужное место.</span></div>
  <div className="help-tip"><Icon name="cloud-check"/><span>Облако вверху показывает состояние синхронизации с Supabase.</span></div>
  <div className="help-tip"><Icon name="calendar"/><span>«Сегодня» определяется по часовому поясу твоего профиля.</span></div>
  <button className="btn accent full" onClick={()=>{setHelp(false);open('help')}}>Полная справка</button>
  </div></Dialog>}
export default function App(){const{ready,error,refresh}=useApp();
  useEffect(()=>{const app=telegram();const back=()=>{const modal=document.querySelector('.modal-backdrop');if(modal){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return;}window.history.back()};
    app?.BackButton?.onClick?.(back);return()=>{app?.BackButton?.offClick?.(back)}},[]);
  return <div className="app-shell"><Sidebar/><div className="app-center"><Header/>
    {!ready?<div className="full-loading"><div className="loading-orb"><Icon name="sparkles" size={29}/></div><strong>Personal OS</strong><span>Загружаем твой прогресс…</span></div>
      :error?<div className="full-loading error-view"><div className="loading-orb"><Icon name="cloud-off" size={28}/></div><strong>Не удалось подключиться</strong><p>{error}</p><button className="btn accent" onClick={()=>void refresh()}><Icon name="refresh"/> Повторить</button></div>
      :<main className="app-content"><Route/></main>}
    <footer className="mobile-footer-version">Personal OS · v6.2</footer><BottomNav/>
  </div><ActiveModal/><HelpSheet/><StatusToast/></div>;
}
