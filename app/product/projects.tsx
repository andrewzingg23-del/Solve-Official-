"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";

export type ProjectCard = { worldId: string; title: string; summary: string; updatedAt: string };
export function Projects({ projects }: { projects: ProjectCard[] }) {
  const [search, setSearch] = useState("");
  const visible = projects.filter(project => `${project.title} ${project.summary}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="solve-projects" aria-labelledby="projects-heading">
    <div className="solve-section-heading"><h2 id="projects-heading">Your Worlds <span>{projects.length}</span></h2>{projects.length > 0 ? <input type="search" aria-label="Find a project" placeholder="Find a World…" value={search} onChange={event => setSearch(event.target.value)} className="solve-search" /> : null}</div>
    {projects.length === 0 ? <div className="solve-empty"><Icon name="projects" width={30} height={30} /><h3>Your first World starts here.</h3><p>Describe an idea above to create your first private World.</p><Link href="/worlds/new" className="solve-text-link">Start a World <Icon name="arrow" width={15} /></Link></div> : visible.length === 0 ? <div className="solve-empty"><p>No Worlds match “{search}”.</p><button onClick={() => setSearch("")} className="solve-text-link">Clear search</button></div> : <div className="solve-project-grid">{visible.map(project => <Link key={project.worldId} href={`/world/${project.worldId}/room`} className="solve-project-card"><div className="solve-project-card-top"><span className="solve-project-icon"><Icon name="projects" /></span><Icon name="arrow" width={17} /></div><h3>{project.title}</h3><p>{project.summary || "Open your World."}</p><footer><span><Icon name="lock" width={12} />Private World</span><time dateTime={project.updatedAt}>Updated {new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</time></footer></Link>)}</div>}
  </section>;
}
