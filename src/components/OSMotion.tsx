import React from 'react';
import {AnimatePresence,LazyMotion,MotionConfig,domMax,useReducedMotion} from 'motion/react';
import * as m from 'motion/react-m';

/**
 * Shared animation policy for Personal OS.
 * - One lightweight motion system for all screens
 * - Respects the device's reduced-motion accessibility preference
 * - domMax enables shared-layout animation for navigation indicators
 */
export function OSMotionProvider({children}:{children:React.ReactNode}){
 return <MotionConfig reducedMotion="user"><LazyMotion features={domMax} strict>{children}</LazyMotion></MotionConfig>;
}

/**
 * The selected screen is keyed independently from app data.
 * Re-rendering tasks/analytics never restarts the page transition.
 */
export function MotionRoute({screen,children}:{screen:string;children:React.ReactNode}){
 const reduce=useReducedMotion();
 return <AnimatePresence initial={false} mode="wait">
  <m.div key={screen} className="motion-route"
   initial={reduce?false:{opacity:0}}
   animate={{opacity:1}}
   exit={reduce?{opacity:1}:{opacity:0}}
   transition={{duration:reduce?0:0.22,ease:'easeOut'}}>
   {children}
  </m.div>
 </AnimatePresence>;
}

