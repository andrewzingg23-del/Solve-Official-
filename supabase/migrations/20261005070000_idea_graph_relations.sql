-- Typed Idea Graph edges are first-class kernel relations. They remain subject
-- to the existing relation.write grant, append-only event history and scope.
alter table kernel.relations drop constraint if exists relations_kind_check;
alter table kernel.relations add constraint relations_kind_check check (kind in (
  'owns', 'controls', 'member_of', 'located_in', 'supplies', 'requires', 'blocks', 'produces',
  'verifies', 'represents', 'assists', 'offers', 'needs', 'part_of', 'challenges', 'replaces',
  'escalates_to', 'pays',
  'idea_derived_from', 'idea_supports', 'idea_contradicts', 'idea_supersedes',
  'idea_implemented_by', 'idea_tested_by', 'idea_evidenced_by', 'idea_blocked_by'
));

comment on constraint relations_kind_check on kernel.relations is
  'Canonical World relations, including typed Idea Graph lineage edges.';

-- Prevent concurrent writers from creating duplicate active semantic links.
create unique index kernel_idea_relations_active_once
  on kernel.relations (kind, from_ref, to_ref, scope)
  where kind in (
    'idea_derived_from', 'idea_supports', 'idea_contradicts', 'idea_supersedes',
    'idea_implemented_by', 'idea_tested_by', 'idea_evidenced_by', 'idea_blocked_by'
  );
