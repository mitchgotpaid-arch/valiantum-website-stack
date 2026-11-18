import Link from 'next/link';
import type {PublishingDestination} from '@/data/publishing';
export function PublishingSettings({brandId,destinations}: {brandId:string;destinations:PublishingDestination[];metaConfigured:boolean;metaOutcome?:string}){
 const count=destinations.filter(item=>item.connectionStatus==='CONNECTED').length;
 return <div className="publishing-settings"><div className="publishing-summary"><div><span className="eyebrow">ALL PLATFORMS, ONE PLACE</span><strong>Connect the right accounts to this brand.</strong><p>Facebook, Instagram, X, TikTok, Pinterest, LinkedIn, YouTube, Threads, Reddit, Mastodon and Bluesky have a dedicated Connections workspace.</p></div><span className="badge">{count} legacy connections</span></div><Link className="button" href={`/connections?brand=${brandId}`}>Manage brand connections →</Link></div>;
}
