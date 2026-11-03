// Server-side credential operations. Never serialize Provider to a client component.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { Kernel } from '@/lib/kernel/client';
import { seal, unseal } from '@/lib/bot/seal';
import { readConnections, linksScope } from '@/lib/bot/memory';

export const CONNECT_REQUIRED = 'Connect your own AI in Connections before starting new work.';
export const PROVIDER_REQUIRED = 'Connect your own OpenRouter key to use AI here, or continue from your connected assistant.';
export const providerScope = (owner: string) => `actor:${owner}/ai:provider`;
export type Provider = { apiKey: string; model: string };
const LINKED = 'ai.provider.connected', UNLINKED = 'ai.provider.disconnected';
function encryptionKey(owner: string) {
  const secret = process.env.SOLVE_PROVIDER_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('Secure provider storage is not configured on this deployment.');
  return createHmac('sha256',secret).update(`solve-provider-v1:${owner}`).digest();
}
async function latest(kernel: Kernel, owner: string) {
  return (await kernel.readEvents(providerScope(owner),{newestFirst:true,limit:100})).find(e=>e.type===LINKED || e.type===UNLINKED) ?? null;
}
export async function readProvider(kernel: Kernel): Promise<Provider | null> {
  const owner = (await kernel.whoami()).actor_id;
  const event = await latest(kernel,owner);
  if (!event || event.type !== LINKED) return null;
  const key = (await kernel.unsealKeys([event.id]))[0]?.key;
  if (!key) return null;
  const wrapped = await unseal(event.payload.sealed,key) as { iv: string; tag: string; data: string } | null;
  if (!wrapped) return null;
  const cipher = createDecipheriv('aes-256-gcm',encryptionKey(owner),Buffer.from(wrapped.iv,'base64'));
  cipher.setAuthTag(Buffer.from(wrapped.tag,'base64'));
  const value = JSON.parse(Buffer.concat([cipher.update(Buffer.from(wrapped.data,'base64')),cipher.final()]).toString()) as Provider;
  return typeof value.apiKey === 'string' && typeof value.model === 'string' ? value : null;
}
export async function saveProvider(kernel: Kernel, provider: Provider) {
  if (!provider.apiKey || provider.apiKey.length > 512 || /\s/.test(provider.apiKey) || !/^[a-zA-Z0-9_./:-]{1,160}$/.test(provider.model)) throw new Error('Enter a valid key and model ID.');
  const owner = (await kernel.whoami()).actor_id;
  const previous = await latest(kernel,owner);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',encryptionKey(owner),iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(provider)),cipher.final()]);
  const {sealed,key} = await seal({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
  const id = await kernel.recordEvent({type:LINKED,scope:providerScope(owner),payload:{sealed,provider:'openrouter',model:provider.model}});
  await kernel.sealKey(id,key);
  if (previous?.type===LINKED) await kernel.destroyKey(previous.id,'Provider key replaced');
}
export async function disconnectProvider(kernel: Kernel) {
  const owner = (await kernel.whoami()).actor_id;
  // Destroy every retained credential key; partial earlier rotations must not remain decryptable.
  const events = await kernel.readEvents(providerScope(owner),{newestFirst:true,limit:1000});
  for (const e of events.filter(e=>e.type===LINKED)) await kernel.destroyKey(e.id,'Provider disconnected');
  await kernel.recordEvent({type:UNLINKED,scope:providerScope(owner),payload:{}});
}
export async function connectionStatus(kernel: Kernel) {
  const owner = (await kernel.whoami()).actor_id;
  const [provider,connections,checks] = await Promise.all([readProvider(kernel),readConnections(kernel,owner),kernel.readEvents(linksScope(owner),{newestFirst:true,limit:500})]);
  const assistants = connections.filter(c=>checks.some(e=>e.type==='bot.connection.checked' && e.payload.client_id===c.clientId && e.occurred_at>=c.since));
  return {active:Boolean(provider)||assistants.length>0,model:provider?.model??null,assistants:assistants.map(c=>({name:c.clientName,mode:c.mode}))};
}
export async function requireConnection(kernel: Kernel) {
  if (!(await connectionStatus(kernel)).active) throw new Error(CONNECT_REQUIRED);
}
