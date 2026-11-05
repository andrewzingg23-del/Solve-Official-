"use client";
import { useState, useTransition } from 'react';
import { requestAccountClaim } from './claim-actions';
export function ClaimForm({userId}:{userId:string}){
 const [email,setEmail]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(false);const [pending,startTransition]=useTransition();
 return <form className="solve-form solve-panel" onSubmit={e=>{e.preventDefault();startTransition(async()=>{try{const result=await requestAccountClaim(userId,email);setError(!result.ok);setNotice(result.ok?'Check your email and confirm the address in this browser. Then return to Control to check your identity. Until confirmation, keep this guest session.':result.error);}catch{setError(true);setNotice('Connection interrupted. Keep this session and retry.');}});}}><label htmlFor="claim-email">Recovery email</label><input id="claim-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/><button className="solve-button" disabled={pending}>{pending?'Sending…':'Keep my SOV ID'}</button>{notice&&<p role={error?'alert':'status'}>{notice}</p>}<p className="sov-subtle">Linking this address preserves the identity that owns your guest Projects. An existing account is a separate sign-in; no automatic merge occurs.</p></form>;
}
