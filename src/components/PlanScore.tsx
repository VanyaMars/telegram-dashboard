import React from 'react';
import {planDisplay} from '../lib/planScore';
import {useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
import {MotionNumber} from './MotionNumber';
/** A full-width 100% bar, with 100–200% represented by color, not extra width. */
export function PlanScore({important,doneImportant,extra,doneExtra}:{important:number;doneImportant:number;extra:number;doneExtra:number}){
 const {score,mainPercent,phase}=planDisplay(important,doneImportant,extra,doneExtra);
 const reduced=useReducedMotion();
 return <div className={'plan-score plan-score--'+phase}>
  <div className="plan-score-value" aria-label={`Прогресс дня ${score} процентов`}><MotionNumber value={score}/><span>%</span></div>
  <div className="plan-score-track" role="progressbar" aria-valuenow={mainPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Главные задачи"><m.span className="motion-progress-fill" initial={reduced?false:{width:'0%'}} animate={{width:`${mainPercent}%`}} transition={{duration:reduced?0:0.72,ease:'easeOut'}}/></div>
 </div>;
}
