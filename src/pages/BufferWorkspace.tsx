import React,{useEffect,useState} from 'react';
import {BufferPage} from './CorePages';
import {WorkspacePage} from './Workspace';

/** Buffer is the only directory. Task pages are editors, never a separate Pages section. */
export function BufferWorkspacePage(){
 const [taskPage,setTaskPage]=useState(()=>window.location.hash.startsWith('#/page/'));
 useEffect(()=>{
  const route=()=>{
   if(window.location.hash==='#/workspace'){
    window.history.replaceState(null,'',window.location.pathname+window.location.search+'#/tab/buffer');
   }
   setTaskPage(window.location.hash.startsWith('#/page/'));
  };
  route();window.addEventListener('hashchange',route);
  return()=>window.removeEventListener('hashchange',route);
 },[]);
 return <div className="unified-buffer">
  {taskPage?<WorkspacePage embedded/>:<BufferPage/>}
 </div>;
}
