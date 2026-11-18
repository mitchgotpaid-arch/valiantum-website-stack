'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Icon,type IconName} from './icon';
const primary:[string,string,IconName][]=[['Overview','/','home'],['Content studio','/content','content'],['Calendar','/calendar','calendar'],['Brands','/brands','brands']];
const tools:[string,string,IconName][]=[['Brand Knowledge','/knowledge','brands'],['AI assistant','/agent','spark'],['Project briefs','/projects','brief'],['Campaigns','/campaigns','chart'],['Analytics','/analytics','chart'],['Settings','/settings','settings']];
export function MarketingNavigation(){
 const path=(usePathname()||'/').replace(/^\/marketing(?=\/|$)/,'')||'/';
 return <><div className="nav-caption">WORKSPACE</div><nav className="nav nav-primary" aria-label="Marketing workspace">{primary.map(([label,href,icon])=><Link href={href} key={href} aria-current={(href==='/'?path==='/':path.startsWith(href))?'page':undefined}><Icon name={icon}/><span>{label}</span></Link>)}</nav><section className="nav-more"><div className="nav-caption">TOOLS &amp; INSIGHTS</div><nav className="nav nav-tools" aria-label="Marketing tools">{tools.map(([label,href,icon])=><Link href={href} key={href} aria-current={path.startsWith(href)?'page':undefined}><Icon name={icon}/><span>{label}</span></Link>)}</nav></section></>;
}
