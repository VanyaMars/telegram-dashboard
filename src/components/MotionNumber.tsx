import React,{useEffect,useRef,useState} from 'react';
import {animate,useReducedMotion} from 'motion/react';

/** Animate numeric KPI changes without changing their source of truth. */
export function MotionNumber({value}:{value:number}){
 const reduced=useReducedMotion();
 const target=Number.isFinite(value)?Math.round(value):0;
 const latest=useRef(reduced?target:0);
 const [display,setDisplay]=useState(latest.current);
 useEffect(()=>{
  if(reduced){latest.current=target;setDisplay(target);return;}
  const controls=animate(latest.current,target,{
   duration:0.65,ease:'easeOut',
   onUpdate:v=>{latest.current=v;setDisplay(Math.round(v));}
  });
  return ()=>controls.stop();
 },[target,reduced]);
 return <>{display}</>;
}
