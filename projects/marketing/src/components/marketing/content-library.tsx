'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import type {ContentQueueItem} from '@/data/content';
import {ContentTile} from './ui';
import {Icon} from './icon';
const tabs=[['ALL','All content'],['NEEDS_REVIEW','In review'],['APPROVED','Approved'],['PUBLISHED','Published'],['REJECTED','Needs changes']] as const;
export function ContentLibrary({items}:{items:ContentQueueItem[]}){
 const params=useSearchParams();const initial=params.get('status')||'ALL';
 const [status,setStatus]=useState(tabs.some(([key])=>key===initial)?initial:'ALL'),[brand,setBrand]=useState('ALL'),[query,setQuery]=useState('');
 const brands=[...new Map(items.map(item=>[item.brandId,item.brandName])).entries()];
 const filtered=items.filter(i=>(status==='ALL'||i.status===status)&&(brand==='ALL'||i.brandId===brand)&&`${i.title} ${i.body} ${i.brandName}`.toLowerCase().includes(query.toLowerCase()));
 return <><div className="studio-filter-bar"><div className="studio-tabs" role="group" aria-label="Filter content status">{tabs.map(([value,label])=><button key={value} onClick={()=>setStatus(value)} aria-pressed={status===value}>{label}<span>{value==='ALL'?items.length:items.filter(item=>item.status===value).length}</span></button>)}</div><div className="studio-search-filters"><label className="studio-search"><Icon name="search" size={17}/><input type="search" aria-label="Search content" placeholder="Find your next post…" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Filter content by brand" value={brand} onChange={event=>setBrand(event.target.value)}><option value="ALL">All brands</option>{brands.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div></div><div className="library-caption"><span>{filtered.length} {filtered.length===1?'piece':'pieces'} of content</span><span>Latest first</span></div>{filtered.length?<div className="content-tile-grid">{filtered.map(item=><ContentTile item={item} key={item.id}/>)}</div>:<div className="studio-empty"><span className="empty-art"><Icon name="content" size={30}/></span><h2>{items.length?'Nothing here just yet.':'Make room for your next great idea.'}</h2><p>{items.length?'Try another brand, status, or search to find your content.':'Bring a thought to life. Start with your own words or a little help from the AI assistant.'}</p>{items.length?<button className="button button-secondary" onClick={()=>{setStatus('ALL');setBrand('ALL');setQuery('');}}>Clear filters</button>:<Link className="button" href="/content/new">Create content <Icon name="plus" size={16}/></Link>}</div>}</>;
}
