import React from 'react';
import {goalProgress} from '../lib/date';

/** Truthful current/target presentation, including downward goals (e.g. weight). */
export const formatGoalValue=(value:number,unit='')=>
 `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(value)}${unit.trim()?' '+unit.trim():''}`;

type GoalValuesProps={current:number;target:number;unit:string;start?:number;compact?:boolean};
export function GoalValues({current,target,unit,start,compact=false}:GoalValuesProps){
 const decreasing=start!==undefined&&target<start;
 return <div className={'goal-values '+(compact?'goal-values--compact':'')} aria-label="Текущее и целевое значения">
  <div><span>Сейчас</span><strong>{formatGoalValue(current,unit)}</strong></div>
  <div><span>Целевое значение</span><strong>{formatGoalValue(target,unit)}</strong></div>
  {start!==undefined&&!compact&&<small className="goal-values-origin">Старт: {formatGoalValue(start,unit)} · {decreasing?'Снижение':'Рост'}</small>}
 </div>;
}
export function GoalSnapshot({start,current,target,unit}:{start:number;current:number;target:number;unit:string}){
 const percent=goalProgress({start_value:start,current_value:current,target_value:target});
 const attained=target!==start&&(target>start?current>=target:current<=target);
 return <div className="goal-snapshot">
  <GoalValues current={current} target={target} start={start} unit={unit}/>
  <p className="goal-snapshot-progress">{attained?'Цель достигнута':percent+'% пути от старта'}</p>
 </div>;
}
