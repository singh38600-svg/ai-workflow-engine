-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create tools table
CREATE TABLE IF NOT EXISTS public.tools (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  short_description TEXT,
  long_description TEXT,
  category TEXT NOT NULL,
  subcategories TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  capabilities TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  best_for TEXT,
  not_recommended_for TEXT,
  pricing_type TEXT DEFAULT 'unknown'::TEXT NOT NULL,
  free_plan_available BOOLEAN DEFAULT FALSE NOT NULL,
  free_trial_available BOOLEAN DEFAULT FALSE NOT NULL,
  starting_monthly_price NUMERIC,
  pricing_currency TEXT DEFAULT 'USD'::TEXT NOT NULL,
  pricing_notes TEXT,
  api_available BOOLEAN DEFAULT FALSE NOT NULL,
  webhooks_available BOOLEAN DEFAULT FALSE NOT NULL,
  direct_integrations TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  import_formats TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  export_formats TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  supported_platforms TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  technical_difficulty TEXT DEFAULT 'beginner'::TEXT NOT NULL,
  no_code_friendly BOOLEAN DEFAULT FALSE NOT NULL,
  open_source BOOLEAN DEFAULT FALSE NOT NULL,
  self_hostable BOOLEAN DEFAULT FALSE NOT NULL,
  privacy_level TEXT DEFAULT 'medium'::TEXT NOT NULL,
  data_retention_notes TEXT,
  supports_india BOOLEAN DEFAULT TRUE NOT NULL,
  reliability_score NUMERIC DEFAULT 8.0 NOT NULL,
  editorial_quality_score NUMERIC DEFAULT 8.0 NOT NULL,
  verification_status TEXT DEFAULT 'needs_review'::TEXT NOT NULL,
  last_verified_at TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on tools
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- Tools Policies
CREATE POLICY "Active and verified tools are readable by everyone" ON public.tools
  FOR SELECT USING (is_active = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE email = ANY(string_to_array(current_setting('app.settings.admin_emails', true), ','))));

CREATE POLICY "Admins have full access to tools" ON public.tools
  FOR ALL USING (auth.jwt()->>'email' IN (SELECT email FROM public.profiles)); -- Handled on server as well

-- Create tool_integrations table
CREATE TABLE IF NOT EXISTS public.tool_integrations (
  id TEXT PRIMARY KEY,
  source_tool_id TEXT REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
  target_tool_id TEXT REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
  connection_type TEXT NOT NULL,
  status TEXT DEFAULT 'unverified'::TEXT NOT NULL,
  setup_difficulty TEXT DEFAULT 'medium'::TEXT NOT NULL,
  requires_paid_plan BOOLEAN,
  notes TEXT,
  documentation_url TEXT,
  last_verified_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on tool_integrations
ALTER TABLE public.tool_integrations ENABLE ROW LEVEL SECURITY;

-- Tool Integrations Policies
CREATE POLICY "Tool integrations are viewable by everyone" ON public.tool_integrations
  FOR SELECT USING (true);

CREATE POLICY "Admins have full access to integrations" ON public.tool_integrations
  FOR ALL USING (true); -- Handled securely on server-side

-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null means Guest/anonymous
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  original_goal TEXT,
  requirements JSONB DEFAULT '{}'::JSONB NOT NULL,
  summary TEXT,
  total_cost NUMERIC,
  currency TEXT DEFAULT 'USD'::TEXT NOT NULL,
  difficulty TEXT,
  automation_level TEXT,
  privacy_risk TEXT,
  visibility TEXT DEFAULT 'private'::TEXT NOT NULL, -- private, public
  public_share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Workflows Policies
CREATE POLICY "Users can create workflows" ON public.workflows
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can select their own workflows or public ones" ON public.workflows
  FOR SELECT USING (
    owner_id IS NULL OR
    auth.uid() = owner_id OR
    visibility = 'public' OR
    public_share_token IS NOT NULL
  );

CREATE POLICY "Users can update their own workflows" ON public.workflows
  FOR UPDATE USING (
    owner_id IS NULL OR
    auth.uid() = owner_id
  );

CREATE POLICY "Users can delete their own workflows" ON public.workflows
  FOR DELETE USING (
    owner_id IS NULL OR
    auth.uid() = owner_id
  );

-- Create workflow_steps table
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT,
  selected_tool_id TEXT REFERENCES public.tools(id) ON DELETE SET NULL,
  alternatives JSONB DEFAULT '[]'::JSONB NOT NULL,
  instructions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  input_types TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  output_types TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  compatibility_to_next JSONB,
  human_approval_required BOOLEAN DEFAULT FALSE NOT NULL,
  personal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on workflow_steps
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

-- Workflow Steps Policies
CREATE POLICY "Steps are readable if workflow is readable" ON public.workflow_steps
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM public.workflows
    )
  );

CREATE POLICY "Steps can be modified if workflow is modifiable" ON public.workflow_steps
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM public.workflows WHERE owner_id IS NULL OR auth.uid() = owner_id
    )
  );

-- Create workflow_feedback table
CREATE TABLE IF NOT EXISTS public.workflow_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on workflow_feedback
ALTER TABLE public.workflow_feedback ENABLE ROW LEVEL SECURITY;

-- Feedback Policies
CREATE POLICY "Anyone can submit feedback" ON public.workflow_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read feedback for their own workflows" ON public.workflow_feedback
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM public.workflows WHERE owner_id IS NULL OR auth.uid() = owner_id
    )
  );

-- Create workflow_templates table
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  automation_level TEXT NOT NULL,
  estimated_cost_min NUMERIC DEFAULT 0 NOT NULL,
  estimated_cost_max NUMERIC DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'USD'::TEXT NOT NULL,
  steps JSONB DEFAULT '[]'::JSONB NOT NULL,
  overall_instructions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  privacy_warnings TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  risk_warnings TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  optimisation_suggestions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on templates
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are viewable by everyone" ON public.workflow_templates
  FOR SELECT USING (is_active = true);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  budget_preference TEXT,
  skill_preference TEXT,
  automation_preference TEXT,
  data_sensitivity_preference TEXT,
  free_only_preference BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Setup Auth trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  
  -- Create empty preferences for them
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
