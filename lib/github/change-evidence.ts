import { sameRepo, type RepoRef } from './repo';
export type ChangeEvidence={number:number;title:string;url:string;sha:string;mergeCommit:string|null;merged:boolean;state:'open'|'closed';checks:'passed'|'failed'|'pending'|'unavailable';checkNames:string[];readAt:string};
export function parseImplementationPull(raw:string,repo:RepoRef):number|null{
 try{const u=new URL(raw);const m=/^\/([^/]+)\/([^/]+)\/pull\/([1-9][0-9]*)\/?$/.exec(u.pathname);if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.search||u.hash||!m||!sameRepo({owner:m[1],repo:m[2],trunk:null},repo))return null;const n=Number(m[3]);return Number.isSafeInteger(n)?n:null;}catch{return null;}
}
const sha=(value:unknown):string|null=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)?value:null;
const safeText=(value:unknown)=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').slice(0,200):'';
export async function readChangeEvidence(repo:RepoRef,pullNumber:number,options:{token?:string|null;fetcher?:typeof fetch}={}):Promise<ChangeEvidence|null>{
 if(!Number.isSafeInteger(pullNumber)||pullNumber<1||!/^[\w.-]{1,100}$/.test(repo.owner)||!/^[\w.-]{1,100}$/.test(repo.repo))return null;
 const root=`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
 const headers:Record<string,string>={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'solve-development-workspace'};
 if(options.token)headers.Authorization=`Bearer ${options.token}`;
 const get=async(path:string)=>{const r=await (options.fetcher??fetch)(root+path,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('GitHub evidence unavailable');return r.json();};
 try{
  const pull=await get(`/pulls/${pullNumber}`);
  if(pull.number!==pullNumber||parseImplementationPull(pull.html_url,repo)!==pullNumber||!sha(pull.head?.sha)||typeof pull.base?.repo?.full_name!=='string'||pull.base.repo.full_name.toLowerCase()!==`${repo.owner}/${repo.repo}`.toLowerCase()||(repo.trunk&&pull.base?.ref!==repo.trunk))return null;
  const commit=sha(pull.head.sha)!;
  const checks=await Promise.allSettled([get(`/commits/${commit}/check-runs?per_page=100`),get(`/commits/${commit}/status?per_page=100`)]);
  let state:ChangeEvidence['checks']='unavailable';const names:string[]=[];
  if(checks.every(r=>r.status==='fulfilled') && checks[0].status==='fulfilled' && checks[1].status==='fulfilled' && Number.isSafeInteger(checks[0].value.total_count) && Number.isSafeInteger(checks[1].value.total_count) && checks[0].value.total_count<=100 && checks[1].value.total_count<=100){
   const runs=checks[0].status==='fulfilled'&&Array.isArray(checks[0].value.check_runs)?checks[0].value.check_runs:[];
   const statuses=checks[1].status==='fulfilled'&&Array.isArray(checks[1].value.statuses)?checks[1].value.statuses:[];
   for(const c of runs)names.push(`${safeText(c.name)}: ${safeText(c.status==='completed'?c.conclusion:c.status)}`);
   for(const c of statuses)names.push(`${safeText(c.context)}: ${safeText(c.state)}`);
   if(runs.some((c:{status:string;conclusion:string})=>c.status==='completed'&&['failure','timed_out','cancelled','action_required','stale','startup_failure'].includes(c.conclusion))||statuses.some((c:{state:string})=>['failure','error'].includes(c.state)))state='failed';
   else if((runs.length||statuses.length)&&runs.every((c:{status:string;conclusion:string})=>c.status==='completed'&&['success','skipped','neutral'].includes(c.conclusion))&&statuses.every((c:{state:string})=>c.state==='success')&&(runs.some((c:{conclusion:string})=>c.conclusion==='success')||statuses.length))state='passed';
   else if(runs.length||statuses.length)state='pending';
  }
  return {number:pullNumber,title:safeText(pull.title),url:`https://github.com/${repo.owner}/${repo.repo}/pull/${pullNumber}`,sha:commit,mergeCommit:sha(pull.merge_commit_sha),merged:pull.merged===true,state:pull.state==='closed'?'closed':'open',checks:state,checkNames:names.slice(0,30),readAt:new Date().toISOString()};
 }catch{return null;}
}
