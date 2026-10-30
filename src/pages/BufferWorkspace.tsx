import React,{useEffect,useState} from 'react';
import {BufferPage} from './CorePages';
import {WorkspacePage} from './Workspace';
/** Unified entry: a task is the source of truth, its page stores extra blocks and Pipeline. */
export function BufferWorkspacePage(){
 const [editingPage,setEditingPage]=useState(window.location.hash.startsWith('#/page/'));
 useEffect(()=>{const sync=()=>setEditingPage(window.location.hash.startsWith('#/page/'));window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
 return <div className="unified-buffer">{!editingPage&&<BufferPage/>}<WorkspacePage embedded/></div>;
}
