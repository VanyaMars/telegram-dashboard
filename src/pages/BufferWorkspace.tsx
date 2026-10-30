import React,{useEffect,useState} from 'react';
import {BufferPage} from './CorePages';
import {WorkspacePage} from './Workspace';
/** The task buffer is the entry point; advanced standalone pages remain accessible in an optional section. */
export function BufferWorkspacePage(){
 const [editingPage,setEditingPage]=useState(window.location.hash.startsWith('#/page/'));
 useEffect(()=>{const sync=()=>setEditingPage(window.location.hash.startsWith('#/page/'));window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
 return <div className="unified-buffer">{editingPage?<WorkspacePage embedded/>:<><BufferPage/><details className="mvp-advanced-pages"><summary>Дополнительные страницы и базы</summary><WorkspacePage embedded/></details></>}</div>;
}
