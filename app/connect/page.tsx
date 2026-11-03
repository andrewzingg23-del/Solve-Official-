import Link from 'next/link';
import { headers } from 'next/headers';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { connectionStatus } from '@/lib/ai/provider';
import { RecoverableForm } from '@/app/product/recoverable-form';
import { CopyField } from '@/app/bot/copy-field';
import { connectProvider, removeProvider } from './actions';

export default async function ConnectPage() {
  const user = await getUser();
  const kernel = user ? await getKernel() : null;
  const actor = kernel ? await kernel.whoami().catch(()=>null) : null;
  const status = kernel && actor ? await connectionStatus(kernel).catch(()=>null) : null;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  const connectorUrl = `${h.get('x-forwarded-proto') || 'https'}://${host}/mcp`;
  return <main className="solve-page">
    <header className="solve-page-heading"><span className="solve-kicker">Your intelligence. Your workspace.</span><h1>Bring your AI.</h1><p>Connect an assistant you already use, or a model with your own API key. SOLVE keeps your shared work, permissions and progress together.</p></header>
    {status?.active ? <div className="solve-notice">Connected{status.model ? ` · ${status.model}` : ` · ${status.assistants.map(a=>a.name).join(', ')}`}<br/><Link href="/" className="solve-text-link">Open your workspace →</Link></div> : <p className="solve-muted mb-6">Connect to start new work. Existing projects remain available to read and export.</p>}
    {!user || user.is_anonymous ? <section className="solve-panel mb-6"><h2>First, make this workspace yours.</h2><p className="my-3">Sign in with your email so you can return from another device. You and your collaborator each use your own account and AI connection.</p><Link href="/login?next=%2Fconnect" className="solve-button">Sign in or create an account</Link>{user?.is_anonymous ? <p className="solve-muted mt-3">Signing into an account opens that account’s projects. Existing guest projects are not automatically transferred; export anything you want to keep first.</p> : null}</section> : null}
    <div className="solve-two-columns">
      <section className="solve-panel"><span className="solve-kicker">Connect an assistant</span><h2 className="my-3">Keep using your assistant.</h2><p className="solve-muted mb-4">Add this remote MCP connector in an assistant that supports OAuth. Authorize it, then ask it to call <code>whoami</code> on SOLVE to verify the connection.</p><CopyField value={connectorUrl} name="MCP connector URL"/><p className="solve-muted my-4">Work from that assistant and see its saved contributions here. This connection does not let SOLVE send prompts into your assistant or import its history automatically.</p><Link href="/bot?section=connections" className="solve-text-link">Setup instructions and permissions →</Link><Link href="/connect" className="solve-text-link">Refresh connection status →</Link>{status?.assistants.map(a=><p key={a.name}>{a.name} · verified connector request · {a.mode==='remember'?'reads and adds':'read only'}</p>)}</section>
      <section className="solve-panel"><span className="solve-kicker">Bring a model key</span><h2 className="my-3">Use AI inside SOLVE.</h2><p className="solve-muted mb-4">The first supported provider is OpenRouter. Choose a model from its catalog. Requests use your account and may incur provider charges; SOLVE never switches to a shared key.</p>
      {user && !user.is_anonymous && actor ? <><RecoverableForm action={connectProvider} ownerActorId={actor.actor_id} className="solve-form" successMessage="Key verified and connection saved. Model availability is checked when you use it."><label htmlFor="provider-key">OpenRouter API key</label><input id="provider-key" name="apiKey" type="password" autoComplete="off" required maxLength={512}/><label htmlFor="provider-model">Model ID</label><input id="provider-model" name="model" placeholder="provider/model-name" defaultValue={status?.model??''} required maxLength={160}/><p className="solve-muted">Only your requests can use this key. Shared project context is sent to your selected provider when you ask AI to help. Keys are encrypted on the server and never included in shared documents.</p><button className="solve-button">Verify and connect</button></RecoverableForm>{status?.model ? <RecoverableForm action={removeProvider} ownerActorId={actor.actor_id} successMessage="Provider disconnected. Your saved work is retained."><button className="solve-text-link mt-4">Disconnect model</button></RecoverableForm> : null}</> : <p className="solve-muted">Sign in above to securely save your key.</p>}
      </section>
    </div>
  </main>;
}
