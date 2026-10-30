import React,{useEffect,useRef,useState} from 'react';
import {animate,useReducedMotion} from 'motion/react';
import {motionTokens} from './motionTokens';

/** Paint the real snapshot immediately; animate only genuine value changes. */
export function MotionNumber({value}:{value:number}){
 const reduced=useReducedMotion();
 const target=Number.isFinite(value)?Math.round(value):0;
 const latest=useRef(target);
 const [display,setDisplay]=useState(target);
 useEffect(()=>{
  if(reduced||latest.current===target){latest.current=target;setDisplay(target);return;}
  const controls=animate(latest.current,target,{
   ...motionTokens.progress,
   onUpdate:v=>{latest.current=v;setDisplay(Math.round(v));},
   onComplete:()=>{latest.current=target;setDisplay(target);}
  });
  return ()=>controls.stop();
 },[target,reduced]);
 return <>{display}</>;
}
