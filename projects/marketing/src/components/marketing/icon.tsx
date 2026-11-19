import type {CSSProperties} from 'react';
export type IconName = 'home'|'calendar'|'content'|'brands'|'spark'|'brief'|'chart'|'settings'|'arrow'|'plus'|'check'|'clock'|'search'|'chevron'|'external';
const paths:Record<IconName,React.ReactNode>={
 home:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2m-8 3h2"/></>,
 content:<><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h4"/></>,
 brands:<><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
 spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/></>,
 brief:<><path d="M8 5V3h8v2M4 8h16v12H4zM4 12h16M10 10v4h4v-4"/></>,
 chart:<><path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/></>,
 settings:<><path d="m9 3-1 3-3 1 1 4-2 3 3 3 3-1 3 2 3-2 3-1v-4l2-3-3-3-3 1-2-3H9Z"/><circle cx="12" cy="11" r="3"/></>,
 arrow:<path d="M4 12h15m-6-6 6 6-6 6"/>,plus:<path d="M12 5v14M5 12h14"/>,check:<path d="m5 12 4 4L19 6"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,chevron:<path d="m9 5 7 7-7 7"/>,external:<><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></>,
};
export function Icon({name,size=19,style}:{name:IconName;size?:number;style?:CSSProperties}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>}
