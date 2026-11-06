import React from 'react';
import {House,Menu,Cloud,CloudOff,FileText,HelpCircle,Check,CheckCircle2,MoreHorizontal,Plus,
  ChevronRight,ChevronLeft,ChevronDown,ChevronUp,X,GripVertical,Inbox,Target,BarChart3,CalendarDays,
  CalendarCheck2,Wallet,Dumbbell,Timer,Repeat2,Trophy,Settings,BookOpen,Briefcase,HeartPulse,Sparkles,
  Folder,Users,Car,ShoppingBag,Palette,GraduationCap,Clock,ArrowUpRight,ArrowDownRight,ArrowLeftRight,
  Search,Filter,Edit3,Trash2,MoveRight,ArrowUp,ArrowDown,Save,AlertCircle,RefreshCw,CheckCircle,
  RotateCcw,Bell,Info,ArrowRight,Focus,TrendingUp,TrendingDown,CircleHelp,Sun,ShieldCheck,
  ListChecks,LayoutDashboard,Calendar,Lightbulb,Zap,Lock,Play,Pause,Square,CheckSquare,
  Tag,Hash,Type,Flag,Star,Clock3,type LucideIcon} from 'lucide-react';
const icons:Record<string,LucideIcon>={home:House,menu:Menu,cloud:Cloud,'cloud-check':Cloud,'cloud-off':CloudOff,'file-text':FileText,
  help:HelpCircle,check:Check,'check-circle':CheckCircle2,more:MoreHorizontal,plus:Plus,right:ChevronRight,
  left:ChevronLeft,down:ChevronDown,up:ChevronUp,x:X,grip:GripVertical,inbox:Inbox,target:Target,
  chart:BarChart3,calendar:CalendarDays,'calendar-check':CalendarCheck2,wallet:Wallet,dumbbell:Dumbbell,
  timer:Timer,repeat:Repeat2,trophy:Trophy,settings:Settings,'book-open':BookOpen,briefcase:Briefcase,
  'heart-pulse':HeartPulse,sparkles:Sparkles,folder:Folder,users:Users,car:Car,
  'shopping-bag':ShoppingBag,palette:Palette,'graduation-cap':GraduationCap,clock:Clock,
  'arrow-up-right':ArrowUpRight,'arrow-down-right':ArrowDownRight,'arrow-left-right':ArrowLeftRight,
  search:Search,filter:Filter,edit:Edit3,trash:Trash2,'move-right':MoveRight,'arrow-up':ArrowUp,
  'arrow-down':ArrowDown,save:Save,alert:AlertCircle,refresh:RefreshCw,'check-fill':CheckCircle,
  undo:RotateCcw,bell:Bell,info:Info,'arrow-right':ArrowRight,focus:Focus,trend:TrendingUp,
  'trend-down':TrendingDown,'circle-help':CircleHelp,sun:Sun,shield:ShieldCheck,
  list:ListChecks,dashboard:LayoutDashboard,'calendar-small':Calendar,idea:Lightbulb,zap:Zap,lock:Lock,
  play:Play,pause:Pause,stop:Square,'check-square':CheckSquare,tag:Tag,hash:Hash,type:Type,flag:Flag,star:Star,'clock-3':Clock3};
export const Icon=({name,size=19,className,strokeWidth=1.85}:{name:string;size?:number;className?:string;strokeWidth?:number})=>{
  if(name==='cloud-check')return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
   <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 16.25"/><path d="m8 16 2.5 2.5 5-5"/>
  </svg>;
  const Comp=icons[name]||Folder;return <Comp size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true"/>;
};
