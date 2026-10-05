// How a kernel event reads in a World's history and its room.
export function eventTitle(type: string) {
  switch (type) {
    case "kernel.scope.claimed": return "World created";
    case "kernel.entity.created": return "Artifact created";
    case "kernel.entity.updated": return "Artifact updated";
    case "kernel.relation.created": return "Connection recorded";
    case "kernel.evidence.attached": return "Saved with proof";
    case "kernel.grant.issued": return "Access granted";
    case "kernel.grant.revoked": return "Access removed";
    case "kernel.task.created": return "Route step planned";
    case "kernel.task.ready": return "Route step ready";
    case "kernel.task.claimed": return "Route step started";
    case "kernel.task.in_progress": return "Route step in progress";
    case "kernel.task.completed": return "Task done";
    default: return type.replace(/^kernel\./, "").replaceAll(".", " ");
  }
}
