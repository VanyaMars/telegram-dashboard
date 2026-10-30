import React from 'react';
import {AnimatePresence,LazyMotion,MotionConfig,domMax,useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';
import {motionTokens} from './motionTokens';

/** One Motion provider, respecting the device's reduced-motion setting. */
export function OSMotionProvider({children}:{children:React.ReactNode}){
 return <MotionConfig reducedMotion="user"><LazyMotion features={domMax} strict>{children}</LazyMotion></MotionConfig>;
}

/**
 * Never block navigation on an outgoing route; no transformed ancestor
 * around sticky editors, overlays or fixed Telegram WebView controls.
 */
export function MotionRoute({screen,children}:{screen:string;children:React.ReactNode}){
 const reduced=useReducedMotion();
 return <AnimatePresence initial={false} mode="sync">
  <m.div key={screen} className="motion-route"
   initial={reduced?false:{opacity:0.9}}
   animate={{opacity:1}}
   exit={{opacity:0,transition:{duration:0}}}
   transition={reduced?{duration:0}:motionTokens.route}>
   {children}
  </m.div>
 </AnimatePresence>;
}
