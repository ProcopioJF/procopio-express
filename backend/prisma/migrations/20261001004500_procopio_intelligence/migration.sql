ALTER TABLE "User"
ADD COLUMN "supabase_auth_id" UUID UNIQUE
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "Company"
ADD COLUMN "intelligence_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
ADD COLUMN "is_seed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.company_patterns (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT company_patterns_pkey PRIMARY KEY (id),
    CONSTRAINT company_patterns_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public."Company"("id") ON DELETE CASCADE,
    CONSTRAINT company_patterns_period_check CHECK (period_end >= period_start),
    CONSTRAINT company_patterns_company_pattern_period_key
        UNIQUE (company_id, pattern_key, period_start, period_end)
);

CREATE TABLE public.insights (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('baixa', 'media', 'alta')),
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'lido', 'descartado')),
    sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    cache_key TEXT,
    expires_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT insights_pkey PRIMARY KEY (id),
    CONSTRAINT insights_id_company_id_key UNIQUE (id, company_id),
    CONSTRAINT insights_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public."Company"("id") ON DELETE CASCADE,
    CONSTRAINT insights_company_cache_key_key UNIQUE (company_id, cache_key)
);

CREATE TABLE public.company_memory (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    summary TEXT,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT company_memory_pkey PRIMARY KEY (id),
    CONSTRAINT company_memory_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public."Company"("id") ON DELETE CASCADE,
    CONSTRAINT company_memory_company_id_key UNIQUE (company_id)
);

CREATE TABLE public.ai_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    insight_id UUID,
    rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    comment TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT ai_feedback_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public."Company"("id") ON DELETE CASCADE,
    CONSTRAINT ai_feedback_insight_company_fkey
        FOREIGN KEY (insight_id, company_id)
        REFERENCES public.insights (id, company_id) ON DELETE CASCADE
);

CREATE TABLE public.ai_usage_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    model TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 1 CHECK (message_count > 0),
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id),
    CONSTRAINT ai_usage_log_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public."Company"("id") ON DELETE CASCADE
);

CREATE INDEX company_patterns_company_period_idx
    ON public.company_patterns (company_id, period_end);
CREATE INDEX insights_company_status_generated_idx
    ON public.insights (company_id, status, generated_at DESC);
CREATE INDEX ai_feedback_company_created_idx
    ON public.ai_feedback (company_id, created_at DESC);
CREATE INDEX ai_usage_log_company_created_idx
    ON public.ai_usage_log (company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.intelligence_company_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT u."companyId"
    FROM public."User" AS u
    JOIN public."Role" AS r ON r.id = u."roleId"
    WHERE u.supabase_auth_id = auth.uid()
      AND r.name::text = 'COMPANY'
      AND u."companyId" IS NOT NULL
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.intelligence_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."User" AS u
        JOIN public."Role" AS r ON r.id = u."roleId"
        WHERE u.supabase_auth_id = auth.uid()
          AND r.name::text = 'ADMIN'
    )
$$;

REVOKE ALL ON FUNCTION public.intelligence_company_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.intelligence_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intelligence_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intelligence_is_admin() TO authenticated, service_role;

ALTER TABLE public.company_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_patterns, public.insights, public.company_memory,
    public.ai_feedback, public.ai_usage_log FROM PUBLIC, anon, authenticated;

CREATE POLICY company_patterns_select_own
    ON public.company_patterns FOR SELECT TO authenticated
    USING (company_id = public.intelligence_company_id());
CREATE POLICY company_patterns_admin_select_all
    ON public.company_patterns FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());

CREATE POLICY insights_select_own
    ON public.insights FOR SELECT TO authenticated
    USING (company_id = public.intelligence_company_id());
CREATE POLICY insights_admin_select_all
    ON public.insights FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());
CREATE POLICY insights_update_own_status
    ON public.insights FOR UPDATE TO authenticated
    USING (company_id = public.intelligence_company_id())
    WITH CHECK (company_id = public.intelligence_company_id());

CREATE POLICY company_memory_select_own
    ON public.company_memory FOR SELECT TO authenticated
    USING (company_id = public.intelligence_company_id());
CREATE POLICY company_memory_admin_select_all
    ON public.company_memory FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());
CREATE POLICY company_memory_insert_own
    ON public.company_memory FOR INSERT TO authenticated
    WITH CHECK (company_id = public.intelligence_company_id());
CREATE POLICY company_memory_update_own
    ON public.company_memory FOR UPDATE TO authenticated
    USING (company_id = public.intelligence_company_id())
    WITH CHECK (company_id = public.intelligence_company_id());

CREATE POLICY ai_feedback_select_own
    ON public.ai_feedback FOR SELECT TO authenticated
    USING (company_id = public.intelligence_company_id());
CREATE POLICY ai_feedback_admin_select_all
    ON public.ai_feedback FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());
CREATE POLICY ai_feedback_insert_own
    ON public.ai_feedback FOR INSERT TO authenticated
    WITH CHECK (company_id = public.intelligence_company_id());

CREATE POLICY ai_usage_log_select_own
    ON public.ai_usage_log FOR SELECT TO authenticated
    USING (company_id = public.intelligence_company_id());
CREATE POLICY ai_usage_log_admin_select_all
    ON public.ai_usage_log FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());

GRANT SELECT ON public.company_patterns, public.insights, public.company_memory,
    public.ai_feedback, public.ai_usage_log TO authenticated;
GRANT UPDATE (status) ON public.insights TO authenticated;
GRANT INSERT (company_id, preferences), UPDATE (preferences)
    ON public.company_memory TO authenticated;
GRANT INSERT (company_id, insight_id, rating, comment)
    ON public.ai_feedback TO authenticated;

ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."Order" FROM anon, authenticated;
CREATE POLICY intelligence_orders_select_own_company
    ON public."Order" FOR SELECT TO authenticated
    USING ("companyId" = public.intelligence_company_id());
CREATE POLICY intelligence_orders_admin_select_all
    ON public."Order" FOR SELECT TO authenticated
    USING (public.intelligence_is_admin());
GRANT SELECT ON public."Order" TO authenticated;
