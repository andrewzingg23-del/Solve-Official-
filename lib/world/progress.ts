import type { CreativeArtifact } from './creative';
export function stepFromArtifact(artifact: CreativeArtifact) {
  const match = artifact.title === 'Next step' && /^- \[([ x])\] ([^\n]+)$/.exec(artifact.body);
  return match ? { ...artifact, text: match[2], done: match[1] === 'x' } : null;
}
export function projectProgress(artifacts: CreativeArtifact[]) {
  const shared = artifacts.filter(a => a.visibility !== 'private');
  const steps = shared.map(stepFromArtifact).filter(s => s !== null);
  const completed = steps.filter(s => s.done).length;
  return { steps, completed, nextStep: steps.find(s => !s.done)?.text ?? null,
    status: steps.length ? `${completed} of ${steps.length} next steps complete` : shared.length ? `${shared.length} saved document${shared.length === 1 ? '' : 's'}` : 'Ready for a first step',
    updatedAt: shared.map(a => a.updatedAt).sort().at(-1) ?? null };
}
// Human history shows durable work. Presence, polling and AI leases are technical state.
export function meaningfulActivity(type: string) {
  return /^kernel\.(entity\.(created|updated)|evidence\.attached|grant\.(issued|revoked)|task\.(created|ready|claimed|in_progress|completed)|room\.(message|decision)|scope\.claimed|world\.(invitation|member))/.test(type) || /^(creative\.|world\.conversation\.)/.test(type);
}
export const PROJECT_STARTERS = [
  {label:'Make a first plan',text:'Help me turn this project goal into three concrete next steps. Ask for any missing essentials first. Do not claim the plan is saved; I will choose and save the next steps.'},
  {label:'Clarify requirements',text:'Help me define who this project serves, the smallest useful outcome, and how we will know it works.'},
  {label:'Estimate costs',text:'Help me identify costs and assumptions for this project. Separate known costs from estimates and suggest what to verify next.'},
  {label:'Plan an experiment',text:'Help me design a small test of this idea, with a measurable outcome and a concrete next action.'},
];

// Scan canonical event pages so transient heartbeat traffic cannot push real work out of history.
export async function readMeaningfulActivity(kernel: import('../kernel/client').Kernel, scope: string, limit = 12) {
  const endSeq = (await kernel.readEvents(scope, { newestFirst: true, limit: 1 }))[0]?.seq ?? 0;
  let afterSeq = 0;
  let recent: Awaited<ReturnType<typeof kernel.readEvents>> = [];
  for (;;) {
    const page = await kernel.readEvents(scope, { afterSeq, limit: 500 });
    recent = [...recent, ...page.filter(event => event.seq <= endSeq && meaningfulActivity(event.type))].slice(-limit);
    const last = page.at(-1);
    if (page.length < 500 || !last || last.seq <= afterSeq || last.seq >= endSeq) break;
    afterSeq = last.seq;
  }
  return recent.reverse();
}

export async function createStarterPlan(kernel: import('../kernel/client').Kernel, worldId: string) {
  const { loadCreativeWorld, createCreativeArtifact } = await import('./creative');
  const { world, artifacts } = await loadCreativeWorld(kernel, worldId);
  const goal = (artifacts.find(a => a.title === 'Goal' && a.visibility !== 'private')?.body || world.summary).trim();
  const context = goal && !goal.startsWith('A private World.') ? goal.replace(/\s+/g,' ').slice(0,150) : world.title;
  const steps = [
    `Define a measurable successful outcome for: ${context}`,
    `Choose the smallest test of this goal and write down its time and cost: ${context}`,
    `Run the chosen test, record what happened, and decide the next action: ${context}`,
  ];
  // One initial plan per project. Stable request keys survive refresh, retry, partial completion,
  // and another browser submitting the same starter plan. Each action remains an editable document.
  for (let index = 0; index < steps.length; index++) {
    await createCreativeArtifact(kernel, {scope:world.scope,worldEntityId:world.entityId,
      requestId:`starter-plan:${world.worldId}:${index}`,title:'Next step',body:`- [ ] ${steps[index]}`,
      position:{x:30+index*20,y:50}});
  }
}
