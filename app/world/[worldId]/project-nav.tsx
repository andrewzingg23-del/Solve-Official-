import Link from 'next/link';
import { Icon } from '@/app/product/icons';
export function ProjectNav({worldId,conversation=false}:{worldId:string;conversation?:boolean}) {
 const url = `/world/${worldId}`;
 return <nav aria-label="Project sections" className="solve-room-sections"><Link href={`${url}/room`} aria-current={conversation ? 'page' : undefined}><Icon name="chat" width={17} height={17}/>Conversation</Link><Link href={`${url}#documents-heading`}><Icon name="document" width={17} height={17}/>Documents</Link><Link href={`${url}#people-heading`}><Icon name="community" width={17} height={17}/>People &amp; access</Link><a href={`/api/worlds/${worldId}/backup`}>Download backup</a><Link href="/worlds/restore">Restore backup</Link></nav>;
}
