'use client';
import { useState } from 'react';
export function CopyHandoff({text}:{text:string}){
 const [status,setStatus]=useState('');
 return <div className="solve-dev-handoff"><label>Approved instructions for Codex<textarea readOnly value={text} rows={8}/></label><button type="button" className="solve-room-button" onClick={async()=>{try{await navigator.clipboard.writeText(text);setStatus('Copied. Paste these instructions into Codex to start the reviewed work.');}catch{setStatus('Copy is unavailable. Select the instructions above and copy them.');}}}>Copy Codex handoff</button>{status?<p role="status">{status}</p>:null}</div>;
}
