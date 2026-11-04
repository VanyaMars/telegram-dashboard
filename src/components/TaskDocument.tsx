import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {EditorContent,useEditor,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {AllSelection,Selection} from '@tiptap/pm/state';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Details,DetailsContent,DetailsSummary} from '@tiptap/extension-details';
import {Icon} from './Icons';
import {TaskBlockMenu,type TaskInsertKind,isTaskTool} from './TaskBlockMenu';
import type {WBlock} from '../lib/workspace';

type Change={doc:Record<string,any>;text:string;revision:number};
export function TaskDocument({block,save,onInsertBlock}:{block:WBlock;save:(content:Record<string,unknown>)=>Promise<any>;onInsertBlock?:(type:'pipeline'|'image'|'database'|'page_link')=>void}){
 const draftKey='os-document:'+block.page_id+':'+block.id;
 const initial=()=>{try{const draft=localStorage.getItem(draftKey);if(draft)return JSON.parse(draft)}catch{}return block.content.document||{type:'doc',content:[block.type==='checklist'?{type:'taskList',content:[{type:'taskItem',attrs:{checked:!!block.content.checked},content:[{type:'paragraph',content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}]}:{type:block.type==='heading'?'heading':'paragraph',attrs:block.type==='heading'?{level:2}:undefined,content:block.content.text?[{type:'text',text:block.content.text}]:[]}]}};
 const [status,setStatus]=useState(''),[menu,setMenu]=useState(false),[focused,setFocused]=useState(false),[anchor,setAnchor]=useState({top:0,left:0,width:288});
 const [empty,setEmpty]=useState(false),[link,setLink]=useState<string|null>(null);
 const saveRef=useRef(save);saveRef.current=save;
 const revision=useRef(0),pending=useRef<Change|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),queue=useRef(Promise.resolve());
 const editorRef=useRef<Editor|null>(null),frame=useRef<number>();
 const flush=()=>{if(timer.current)clearTimeout(timer.current);const change=pending.current;if(!change)return;pending.current=null;setStatus('Сохраняется…');queue.current=queue.current.catch(()=>{}).then(async()=>{try{
  await saveRef.current({...block.content,document:change.doc,text:change.text});
  if(change.revision===revision.current){try{if(localStorage.getItem(draftKey)===JSON.stringify(change.doc))localStorage.removeItem(draftKey)}catch{}setStatus('')}
 }catch{if(change.revision===revision.current){pending.current=change;setStatus('Не сохранено · повторить')}}})};
 const flushRef=useRef(flush);flushRef.current=flush;
 const position=(reveal=false)=>{if(frame.current)cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{
  const ed=editorRef.current;if(!ed||ed.isDestroyed)return;
  try{let caret=ed.view.coordsAtPos(ed.state.selection.head);const viewport=window.visualViewport;
   const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);const top=(viewport?.offsetTop||0)+100;
   // Reserve room for the contextual controls above the on-screen keyboard/navigation.
   const nav=document.querySelector('.bottom-nav')?.getBoundingClientRect();const usableBottom=nav&&nav.height&&nav.top>top?Math.min(bottom,nav.top):bottom;
   if(reveal&&ed.isFocused){const delta=caret.bottom>usableBottom-76?caret.bottom-(usableBottom-76):caret.top<top?caret.top-top:0;if(delta){window.scrollBy({top:delta,behavior:'instant'});caret=ed.view.coordsAtPos(ed.state.selection.head)}}
   const bounds=ed.view.dom.getBoundingClientRect();const viewWidth=viewport?.width||window.innerWidth;
   const left=Math.max(8,Math.min(bounds.left-34,viewWidth-48));const width=Math.min(280,viewWidth-left-12);
   setAnchor({top:caret.top,left,width});setEmpty(ed.isEmpty);
  }catch{}
 })};
 // Keep ProseMirror configuration stable while caret position and save state rerender React.
 const extensions=useMemo(()=>[StarterKit.configure({link:{openOnClick:false,protocols:['https','http','mailto']}}),TaskList,TaskItem.configure({nested:true,HTMLAttributes:{'data-type':'taskItem'},a11y:{checkboxLabel:node=>'Выполнено: '+(node.textContent||'пункт чеклиста')}}),Details.configure({persist:true}),DetailsSummary,DetailsContent],[]);
 const [initialDocument]=useState(initial);
 const editorProps=useMemo<Editor['options']['editorProps']>(()=>({attributes:{class:'task-document','aria-label':'Содержимое задачи','aria-multiline':'true',spellcheck:'true'},handleKeyDown:(view,e)=>{
   // Collapse Select All in the editor state immediately. Native selectionchange can
   // arrive after a fast Enter, leaving the keymap with a stale AllSelection.
   if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.isComposing&&view.state.selection instanceof AllSelection){view.dispatch(view.state.tr.setSelection(e.key==='ArrowRight'?Selection.atEnd(view.state.doc):Selection.atStart(view.state.doc)));e.preventDefault();return true}
   if(e.key==='Escape'){setMenu(false);setLink(null);return false}if(e.key==='/'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&view.state.selection.$from.parentOffset===0){setMenu(true);position(true);e.preventDefault();return true}return false}}),[]);
 const editor=useEditor({extensions,content:initialDocument,editorProps,
  onCreate:({editor})=>{editorRef.current=editor;setEmpty(editor.isEmpty)},
  onFocus:()=>{setFocused(true);position(true)},onSelectionUpdate:()=>position(true),
  onUpdate:({editor})=>{const doc=editor.getJSON();pending.current={doc,text:editor.getText(),revision:++revision.current};try{localStorage.setItem(draftKey,JSON.stringify(doc))}catch{}setStatus('Черновик');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>flushRef.current(),700);position(true)},
  onBlur:({event})=>{flushRef.current();const target=event.relatedTarget as Element|null;if(!target?.closest?.('[data-editor-owner="'+block.id+'"]')){setFocused(false);setMenu(false);setLink(null)}}
 });
 editorRef.current=editor;
 useEffect(()=>{const leave=()=>flushRef.current();const visibility=()=>{if(document.visibilityState==='hidden')leave()};window.addEventListener('pagehide',leave);window.addEventListener('online',leave);document.addEventListener('visibilitychange',visibility);return()=>{leave();if(frame.current)cancelAnimationFrame(frame.current);window.removeEventListener('pagehide',leave);window.removeEventListener('online',leave);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(!focused)return;const track=()=>position(),reveal=()=>position(true);window.addEventListener('scroll',track,true);window.addEventListener('resize',reveal);window.visualViewport?.addEventListener('resize',reveal);window.visualViewport?.addEventListener('scroll',track);return()=>{window.removeEventListener('scroll',track,true);window.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('scroll',track)}},[focused]);
 useEffect(()=>{if(!editor||revision.current)return;try{if(localStorage.getItem(draftKey)){pending.current={doc:editor.getJSON(),text:editor.getText(),revision:++revision.current};flushRef.current()}}catch{}},[editor]);
 if(!editor)return null;
 const command=(fn:()=>unknown)=>{fn();setMenu(false);position()};
 const choose=(kind:TaskInsertKind)=>{
  if(isTaskTool(kind)){
   if(!onInsertBlock){setMenu(false);return}
   flushRef.current();setMenu(false);
   void queue.current.then(()=>{if(!pending.current)onInsertBlock(kind as 'pipeline'|'image'|'database'|'page_link')});
   return;
  }
  const chain=editor.chain().focus();
  const actions:Record<string,()=>unknown>={
   paragraph:()=>chain.setParagraph().run(),
   heading:()=>chain.toggleHeading({level:2}).run(),
   bulletList:()=>chain.toggleBulletList().run(),
   orderedList:()=>chain.toggleOrderedList().run(),
   taskList:()=>chain.toggleTaskList().run(),
   details:()=>chain.setDetails().run(),
   blockquote:()=>chain.toggleBlockquote().run(),
   horizontalRule:()=>chain.setHorizontalRule().run()
  };
  command(actions[kind]);
 };
 const viewportBottom=(window.visualViewport?.height||window.innerHeight)+(window.visualViewport?.offsetTop||0);
 const controls=focused&&anchor.top>0&&anchor.top<viewportBottom-12&&<div data-editor-owner={block.id} className="editor-controls editor-gutter-controls" style={{position:'fixed',top:Math.max(12,anchor.top),left:anchor.left,width:anchor.width}} onMouseDown={e=>{if(!(e.target instanceof HTMLInputElement))e.preventDefault()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setMenu(false);setLink(null);editor.commands.focus()}}}>
  <button className="editor-gutter-plus" type="button" aria-label="Добавить блок в текущей строке" title="Добавить блок" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><Icon name="plus" size={19}/></button>
  {menu&&<div className="editor-block-menu editor-gutter-menu" style={{maxHeight:Math.max(120,Math.min(420,viewportBottom-anchor.top-50))}}>
    <TaskBlockMenu onSelect={choose}/>
    <div className="editor-format-actions" role="group" aria-label="Форматирование">
     <button type="button" aria-label="Жирный" onClick={()=>command(()=>editor.chain().focus().toggleBold().run())}><b>B</b> Жирный</button>
     <button type="button" aria-label="Курсив" onClick={()=>command(()=>editor.chain().focus().toggleItalic().run())}><i>I</i> Курсив</button>
     <button type="button" aria-label="Ссылка" onClick={()=>{setMenu(false);setLink(editor.getAttributes('link').href||'')}}><Icon name="arrow-up-right" size={17}/> Ссылка</button>
    </div>
   </div>}
  {link!==null&&<form className="editor-link-form" onSubmit={e=>{e.preventDefault();if(/^(https?:\\/\\/|mailto:)/i.test(link)){editor.chain().focus().setLink({href:link}).run();setLink(null)}}}><input autoFocus aria-label="Адрес ссылки" placeholder="https://…" value={link} onChange={e=>setLink(e.target.value)}/><button type="submit" disabled={!/^(https?:\\/\\/|mailto:)/i.test(link)}>Добавить</button></form>}
 </div>;
 return <div className={'task-document-wrap '+(empty?'is-empty ':'')+(focused?'is-editing':'')} onClick={e=>{if(e.target===e.currentTarget)editor.commands.focus('end')}}>
  {empty&&<span className="task-document-placeholder" aria-hidden="true">Напиши текст или нажми / для выбора блока</span>}
  <EditorContent editor={editor}/>
  {status.startsWith('Не сохранено')&&<button className="task-save-status" type="button" onClick={flush} role="alert">{status}</button>}
  {focused&&<span className="editor-save-hint" role="status">{status||'Сохранено'}</span>}
  {controls&&createPortal(controls,document.body)}
 </div>;
}
