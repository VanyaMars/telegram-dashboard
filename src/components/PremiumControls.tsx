import React from 'react';
import {useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
import {motionTokens} from './motionTokens';

type Tone='primary'|'secondary'|'quiet';
type PremiumActionProps={
 children:React.ReactNode;
 onClick:()=>void;
 tone?:Tone;
 disabled?:boolean;
 pending?:boolean;
 pendingText?:string;
 className?:string;
 ariaLabel?:string;
};

/** One reusable touch/keyboard action with restrained physical feedback. */
export function PremiumAction({children,onClick,tone='primary',disabled=false,pending=false,pendingText='Выполняю…',className='',ariaLabel}:PremiumActionProps){
 const reduced=useReducedMotion();
 return <m.button type="button" className={`btn premium-action premium-action--${tone} ${className}`}
  onClick={onClick} disabled={disabled||pending} aria-label={ariaLabel}
  aria-busy={pending||undefined} whileTap={reduced?undefined:{scale:0.975}}
  transition={reduced?{duration:0}:motionTokens.press}>
  {pending?pendingText:children}
 </m.button>;
}
