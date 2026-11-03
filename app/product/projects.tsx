"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";

export type ProjectCard = { worldId: string; title: string; summary: string; updatedAt: string; status?: string; nextStep?: string | null };
export function Projects({ projects }: { projects: ProjectCard[] }) {
  const [search, setSearch] = useState("");
  const visible = projects.filter(project => `${project.title} ${project.summary}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="solve-projects" aria-labelledby="projects-heading">
    <div className="solve-section-heading"><h2 id="projects-heading">Your projects <span>{projects.length}</span></h2>{projects.length > 0 ? <input type="search" aria-label="Find a project" placeholder="Find a project…" value={search} onChange={event => setSearch(event.target.value)} className="solve-search" /> : null}</div>
    {projects.length === 0 ? <div className="solve-empty"><Icon name="projects" width={30} height={30} /><h3>Your first project starts here.</h3><p>A shared place for your idea, the people behind it, and the AIs helping you get there.</p><Link href="/worlds/new" className="solve-text-link">Start a project <Icon name="arrow" width={15} /></Link></div> : visible.length === 0 ? <div className="solve-empty"><p>No projects match “{search}”.</p><button onClick={() => setSearch("")} className="solve-text-link">Clear search</button></div> : <div className="solve-project-grid">{visible.map(project => <Link key={project.worldId} href={`/world/${project.worldId}/work`} className="solve-project-card"><div className="solve-project-card-top"><span className="solve-project-icon"><Icon name="projects" /></span><Icon name="arrow" width={17} /></div><h3>{project.title}</h3><p>{project.summary || "Open your shared workspace."}</p><p>{project.status ?? "Saved project"}{project.nextStep ? ` · Next: ${project.nextStep}` : ""}</p><footer><span><Icon name="lock" width={12} />Private project</span><time dateTime={project.updatedAt}>Saved {new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</time></footer></Link>)}</div>}
  </section>;
}
