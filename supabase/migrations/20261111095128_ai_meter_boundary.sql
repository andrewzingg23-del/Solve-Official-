-- Follow-up to #98; preserve its original migration and close PostgreSQL's
-- default PUBLIC execute grant on the internal validation helper.
revoke all on function kernel.require_meter_window(integer) from public, anon, authenticated, service_role;
