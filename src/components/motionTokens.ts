/**
 * Calm Precision — Personal OS 6.8. Central Motion for React values.
 * No infinite motion, no new animation dependency.
 */
export const motionTokens={
 press:{type:'spring',stiffness:520,damping:38,mass:0.75},
 selection:{type:'spring',stiffness:430,damping:36,mass:0.82},
 card:{duration:0.28,ease:'easeOut'},
 route:{duration:0.18,ease:'easeOut'},
 feedback:{duration:0.18,ease:'easeOut'},
 progress:{duration:0.48,ease:'easeOut'}
} as const;
