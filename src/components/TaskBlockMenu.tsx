import React from 'react';
import {Icon} from './Icons';

export type TaskInsertKind='paragraph'|'heading'|'bulletList'|'orderedList'|'taskList'|'details'|'blockquote'|'horizontalRule'|'pipeline'|'image'|'database'|'page_link';

export const TASK_INSERT_ITEMS:ReadonlyArray<{kind:TaskInsertKind;label:string;icon:string;group:'text'|'tools'}>=[
 {kind:'paragraph',label:'Текст',icon:'type',group:'text'},
 {kind:'heading',label:'Заголовок',icon:'hash',group:'text'},
 {kind:'bulletList',label:'Список',icon:'list',group:'text'},
 {kind:'orderedList',label:'Нумерация',icon:'list',group:'text'},
 {kind:'taskList',label:'Чеклист',icon:'check-square',group:'text'},
 {kind:'details',label:'Раскрывающийся список',icon:'down',group:'text'},
 {kind:'blockquote',label:'Цитата',icon:'book-open',group:'text'},
 {kind:'horizontalRule',label:'Разделитель',icon:'more',group:'text'},
 {kind:'pipeline',label:'Pipeline',icon:'list',group:'tools'},
 {kind:'image',label:'Изображение',icon:'plus',group:'tools'},
 {kind:'database',label:'База данных',icon:'dashboard',group:'tools'},
 {kind:'page_link',label:'Ссылка на страницу',icon:'plus',group:'tools'}
];
export const isTaskTool=(kind:TaskInsertKind)=>['pipeline','image','database','page_link'].includes(kind);

/** The same block definitions power the editor gutter and end-of-document insertion. */
export function taskInsertDocument(kind:TaskInsertKind):Record<string,unknown>{
 const paragraph={type:'paragraph'};
 const node=kind==='heading'?{type:'heading',attrs:{level:2}}:
 kind==='bulletList'?{type:'bulletList',content:[{type:'listItem',content:[paragraph]}]}:
 kind==='orderedList'?{type:'orderedList',content:[{type:'listItem',content:[paragraph]}]}:
 kind==='taskList'?{type:'taskList',content:[{type:'taskItem',attrs:{checked:false},content:[paragraph]}]}:
 kind==='details'?{type:'details',attrs:{open:true},content:[{type:'detailsSummary',content:[{type:'text',text:'Заголовок'}]},{type:'detailsContent',content:[paragraph]}]}:
 kind==='blockquote'?{type:'blockquote',content:[paragraph]}:
 kind==='horizontalRule'?{type:'horizontalRule'}:paragraph;
 return {type:'doc',content:[node]};
}
export function TaskBlockMenu({onSelect,footer,id}:{onSelect:(kind:TaskInsertKind)=>void;footer?:React.ReactNode;id?:string}){
 return <div id={id} className="task-block-menu" role="group" aria-label="Выбор блока">
  {TASK_INSERT_ITEMS.map((item,index)=><React.Fragment key={item.kind}>
   {index===8&&<div className="task-block-menu-heading">Инструменты задачи</div>}
   <button type="button" onClick={()=>onSelect(item.kind)}><Icon name={item.icon} size={18}/><span>{item.label}</span></button>
  </React.Fragment>)}
  {footer&&<div className="task-block-menu-footer">{footer}</div>}
 </div>;
}
