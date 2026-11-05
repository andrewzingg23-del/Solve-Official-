import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { ProjectComposer } from '@/app/product/project-composer';
export default async function NewProject(){ const user=await getUser();return <main className="solve-page sov-create-page"><Link href="/projects" className="solve-text-link">← Projects</Link><header className="solve-page-heading"><span className="sov-eyebrow">BEGIN WITH WHAT MATTERS</span><h1>What would you like to build?</h1><p>A name, an intention, and a place to make progress.</p></header><ProjectComposer owner={user?.id??null} worldId={randomUUID()}/><p className="sov-subtle">Private by default. Your Project uses SOV’s existing ownership and revision history.</p></main>;}
