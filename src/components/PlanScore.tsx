import React from 'react';
import {planDisplay} from '../lib/planScore';
export function PlanScore({important,doneImportant,extra,doneExtra}:{important:number;doneImportant:number;extra:number;doneExtra:number}){
 const {score,mainPercent,phase}=planDisplay(important,doneImportant,extra,doneExtra);
 return <div className={'plan-score plan-score--'+phase}>
  <div className="plan-score-value" aria-label={`Прогресс дня ${score} процентов`}>{score}<span>%</span></div>
  <div className="plan-score-track" role="progressbar" aria-valuenow={mainPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Выполнение важных задач"><span style={{width:`${mainPercent}%`}}/></div>
  <div className="plan-score-caption">{phase==='pro'?'Все дополнительные задачи выполнены':phase==='boost'?'Основной план закрыт · сверх плана':mainPercent===100?'Основной план закрыт':'Прогресс важных задач'} · {doneImportant}/{important} важных · {doneExtra}/{extra} доп.</div>
 </div>;
}
