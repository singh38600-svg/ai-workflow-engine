-- Grant USAGE on the public schema to service_role
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant standard permissions on existing workflow-related tables to service_role
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.workflows
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.workflow_steps
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.workflow_feedback
TO service_role;

-- Grant usage and select on all sequences in schema public to service_role
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;

-- Set default privileges so that any tables created in the public schema in the future grant permissions to service_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Set default privileges so that any sequences created in the public schema in the future grant usage and select to service_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO service_role;
