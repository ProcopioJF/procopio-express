CREATE OR REPLACE VIEW public.intelligence_order_facts
WITH (security_invoker = true)
AS
SELECT
    o."companyId" AS company_id,
    o."createdAt" AS created_at,
    o.status::text AS status,
    o.price,
    COALESCE(
        NULLIF(BTRIM(o."pickupNeighborhood"), ''),
        NULLIF(BTRIM(o."pickupAddress" ->> 'bairro'), ''),
        'Não informado'
    ) AS pickup_neighborhood,
    COALESCE(
        NULLIF(BTRIM(o."deliveryNeighborhood"), ''),
        NULLIF(BTRIM(o."deliveryAddress" ->> 'bairro'), ''),
        'Não informado'
    ) AS delivery_neighborhood,
    COALESCE(
        NULLIF(BTRIM(o."pickupCity"), ''),
        NULLIF(BTRIM(o."pickupAddress" ->> 'cidade'), ''),
        'Não informada'
    ) AS pickup_city,
    COALESCE(
        NULLIF(BTRIM(o."deliveryCity"), ''),
        NULLIF(BTRIM(o."deliveryAddress" ->> 'cidade'), ''),
        'Não informada'
    ) AS delivery_city,
    o."is_seed" AS is_seed
FROM public."Order" AS o
WHERE o."companyId" IS NOT NULL;

CREATE OR REPLACE VIEW public.intelligence_monthly_metrics
WITH (security_invoker = true)
AS
SELECT
    f.company_id,
    DATE_TRUNC('month', f.created_at AT TIME ZONE 'UTC')::date AS month_start,
    f.is_seed,
    COUNT(*)::integer AS order_count,
    COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer AS completed_count,
    COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count,
    COALESCE(
        SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')),
        0
    )::numeric(12, 2) AS completed_revenue,
    AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2)
        AS average_completed_order_value
FROM public.intelligence_order_facts AS f
GROUP BY f.company_id, month_start, f.is_seed;

CREATE OR REPLACE VIEW public.intelligence_route_metrics
WITH (security_invoker = true)
AS
SELECT
    f.company_id,
    f.pickup_city,
    f.pickup_neighborhood,
    f.delivery_city,
    f.delivery_neighborhood,
    f.is_seed,
    COUNT(*)::integer AS order_count,
    COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer AS completed_count,
    COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count,
    COALESCE(
        SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')),
        0
    )::numeric(12, 2) AS completed_revenue,
    AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2)
        AS average_completed_order_value
FROM public.intelligence_order_facts AS f
GROUP BY
    f.company_id,
    f.pickup_city,
    f.pickup_neighborhood,
    f.delivery_city,
    f.delivery_neighborhood,
    f.is_seed;

CREATE OR REPLACE VIEW public.intelligence_demand_time_metrics
WITH (security_invoker = true)
AS
SELECT
    f.company_id,
    EXTRACT(ISODOW FROM f.created_at AT TIME ZONE 'UTC')::integer AS weekday,
    EXTRACT(HOUR FROM f.created_at AT TIME ZONE 'UTC')::integer AS hour_utc,
    f.is_seed,
    COUNT(*)::integer AS order_count,
    COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count
FROM public.intelligence_order_facts AS f
GROUP BY f.company_id, weekday, hour_utc, f.is_seed;

REVOKE ALL ON public.intelligence_order_facts,
    public.intelligence_monthly_metrics,
    public.intelligence_route_metrics,
    public.intelligence_demand_time_metrics
FROM PUBLIC, anon;
GRANT SELECT ON public.intelligence_order_facts,
    public.intelligence_monthly_metrics,
    public.intelligence_route_metrics,
    public.intelligence_demand_time_metrics
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intelligence_get_company_metrics(
    p_period_start date DEFAULT (CURRENT_DATE - 180),
    p_period_end date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id text;
    v_sample_size integer;
    v_order_count integer;
    v_completed_count integer;
    v_cancelled_count integer;
    v_revenue numeric(12, 2);
    v_average_order_value numeric(12, 2);
    v_monthly jsonb;
    v_routes jsonb;
    v_weekdays jsonb;
    v_hours jsonb;
BEGIN
    IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Período inválido.';
    END IF;

    v_company_id := public.intelligence_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Empresa não identificada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public."Company" AS c
        WHERE c.id = v_company_id
          AND c.intelligence_enabled
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Plano Procópio Intelligence não habilitado.';
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE f.status <> 'CANCELLED')::integer,
        COUNT(*)::integer,
        COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer,
        COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer,
        COALESCE(SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')), 0)::numeric(12, 2),
        AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2)
    INTO
        v_sample_size,
        v_order_count,
        v_completed_count,
        v_cancelled_count,
        v_revenue,
        v_average_order_value
    FROM public.intelligence_order_facts AS f
    WHERE f.company_id = v_company_id
      AND NOT f.is_seed
      AND f.created_at >= p_period_start::timestamp AT TIME ZONE 'UTC'
      AND f.created_at < (p_period_end + 1)::timestamp AT TIME ZONE 'UTC';

    IF v_sample_size < 20 THEN
        RETURN jsonb_build_object(
            'data_status', 'collecting_data',
            'sample_size', v_sample_size,
            'minimum_sample_size', 20,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'metrics', NULL
        );
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'month', m.month_start,
                'orders', m.order_count,
                'completed', m.completed_count,
                'cancelled', m.cancelled_count,
                'revenue', m.revenue,
                'average_order_value', m.average_order_value
            )
            ORDER BY m.month_start
        ),
        '[]'::jsonb
    )
    INTO v_monthly
    FROM (
        SELECT
            DATE_TRUNC('month', f.created_at AT TIME ZONE 'UTC')::date AS month_start,
            COUNT(*)::integer AS order_count,
            COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer AS completed_count,
            COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count,
            COALESCE(SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')), 0)::numeric(12, 2) AS revenue,
            AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2) AS average_order_value
        FROM public.intelligence_order_facts AS f
        WHERE f.company_id = v_company_id
          AND NOT f.is_seed
          AND f.created_at >= p_period_start::timestamp AT TIME ZONE 'UTC'
          AND f.created_at < (p_period_end + 1)::timestamp AT TIME ZONE 'UTC'
        GROUP BY month_start
    ) AS m;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'pickup_city', r.pickup_city,
                'pickup_neighborhood', r.pickup_neighborhood,
                'delivery_city', r.delivery_city,
                'delivery_neighborhood', r.delivery_neighborhood,
                'orders', r.order_count,
                'completed', r.completed_count,
                'cancelled', r.cancelled_count,
                'revenue', r.revenue,
                'average_order_value', r.average_order_value
            )
            ORDER BY r.order_count DESC, r.pickup_city, r.pickup_neighborhood,
                r.delivery_city, r.delivery_neighborhood
        ),
        '[]'::jsonb
    )
    INTO v_routes
    FROM (
        SELECT
            f.pickup_city,
            f.pickup_neighborhood,
            f.delivery_city,
            f.delivery_neighborhood,
            COUNT(*)::integer AS order_count,
            COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer AS completed_count,
            COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count,
            COALESCE(SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')), 0)::numeric(12, 2) AS revenue,
            AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2) AS average_order_value
        FROM public.intelligence_order_facts AS f
        WHERE f.company_id = v_company_id
          AND NOT f.is_seed
          AND f.created_at >= p_period_start::timestamp AT TIME ZONE 'UTC'
          AND f.created_at < (p_period_end + 1)::timestamp AT TIME ZONE 'UTC'
        GROUP BY f.pickup_city, f.pickup_neighborhood, f.delivery_city, f.delivery_neighborhood
        ORDER BY COUNT(*) DESC, f.pickup_city, f.pickup_neighborhood,
            f.delivery_city, f.delivery_neighborhood
        LIMIT 10
    ) AS r;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('weekday', t.weekday, 'orders', t.order_count)
            ORDER BY t.weekday
        ),
        '[]'::jsonb
    )
    INTO v_weekdays
    FROM (
        SELECT
            EXTRACT(ISODOW FROM f.created_at AT TIME ZONE 'UTC')::integer AS weekday,
            COUNT(*)::integer AS order_count
        FROM public.intelligence_order_facts AS f
        WHERE f.company_id = v_company_id
          AND NOT f.is_seed
          AND f.created_at >= p_period_start::timestamp AT TIME ZONE 'UTC'
          AND f.created_at < (p_period_end + 1)::timestamp AT TIME ZONE 'UTC'
        GROUP BY weekday
    ) AS t;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object('hour_utc', t.hour_utc, 'orders', t.order_count)
            ORDER BY t.hour_utc
        ),
        '[]'::jsonb
    )
    INTO v_hours
    FROM (
        SELECT
            EXTRACT(HOUR FROM f.created_at AT TIME ZONE 'UTC')::integer AS hour_utc,
            COUNT(*)::integer AS order_count
        FROM public.intelligence_order_facts AS f
        WHERE f.company_id = v_company_id
          AND NOT f.is_seed
          AND f.created_at >= p_period_start::timestamp AT TIME ZONE 'UTC'
          AND f.created_at < (p_period_end + 1)::timestamp AT TIME ZONE 'UTC'
        GROUP BY hour_utc
    ) AS t;

    RETURN jsonb_build_object(
        'data_status', 'ready',
        'sample_size', v_sample_size,
        'minimum_sample_size', 20,
        'period_start', p_period_start,
        'period_end', p_period_end,
        'metrics', jsonb_build_object(
            'orders', v_order_count,
            'completed_orders', v_completed_count,
            'cancelled_orders', v_cancelled_count,
            'completion_rate', ROUND(v_completed_count::numeric / NULLIF(v_order_count, 0), 4),
            'revenue', v_revenue,
            'average_order_value', v_average_order_value,
            'monthly', v_monthly,
            'top_routes', v_routes,
            'orders_by_weekday', v_weekdays,
            'orders_by_hour_utc', v_hours
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.intelligence_get_company_metrics(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intelligence_get_company_metrics(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intelligence_refresh_company_patterns(
    p_include_seed boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company record;
    v_sample_size integer;
    v_total_orders integer;
    v_completed_orders integer;
    v_cancelled_orders integer;
    v_revenue numeric(12, 2);
    v_average_order_value numeric(12, 2);
    v_routes jsonb;
    v_weekdays jsonb;
    v_hours jsonb;
    v_period_start date := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months')::date;
    v_period_end date := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::date;
    v_rows_written integer := 0;
BEGIN
    IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
       AND NOT public.intelligence_is_admin()
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso restrito ao Admin.';
    END IF;

    FOR v_company IN
        SELECT c.id
        FROM public."Company" AS c
        ORDER BY c.id
    LOOP
        SELECT
            COUNT(*) FILTER (WHERE f.status <> 'CANCELLED')::integer,
            COUNT(*)::integer,
            COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer,
            COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer,
            COALESCE(SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')), 0)::numeric(12, 2),
            AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2)
        INTO
            v_sample_size,
            v_total_orders,
            v_completed_orders,
            v_cancelled_orders,
            v_revenue,
            v_average_order_value
        FROM public.intelligence_order_facts AS f
        WHERE f.company_id = v_company.id
          AND f.created_at >= v_period_start::timestamp AT TIME ZONE 'UTC'
          AND f.created_at < (v_period_end + 1)::timestamp AT TIME ZONE 'UTC'
          AND (p_include_seed OR NOT f.is_seed);

        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'pickup_city', r.pickup_city,
                    'pickup_neighborhood', r.pickup_neighborhood,
                    'delivery_city', r.delivery_city,
                    'delivery_neighborhood', r.delivery_neighborhood,
                    'orders', r.order_count,
                    'completed', r.completed_count,
                    'cancelled', r.cancelled_count,
                    'revenue', r.completed_revenue,
                    'average_order_value', r.average_completed_order_value
                )
                ORDER BY r.order_count DESC, r.pickup_city, r.pickup_neighborhood,
                    r.delivery_city, r.delivery_neighborhood
            ),
            '[]'::jsonb
        )
        INTO v_routes
        FROM (
            SELECT
                f.pickup_city,
                f.pickup_neighborhood,
                f.delivery_city,
                f.delivery_neighborhood,
                COUNT(*)::integer AS order_count,
                COUNT(*) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::integer AS completed_count,
                COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::integer AS cancelled_count,
                COALESCE(SUM(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED')), 0)::numeric(12, 2) AS completed_revenue,
                AVG(f.price) FILTER (WHERE f.status IN ('FINALIZED', 'DELIVERED'))::numeric(12, 2) AS average_completed_order_value
            FROM public.intelligence_order_facts AS f
            WHERE f.company_id = v_company.id
              AND f.created_at >= v_period_start::timestamp AT TIME ZONE 'UTC'
              AND f.created_at < (v_period_end + 1)::timestamp AT TIME ZONE 'UTC'
              AND (p_include_seed OR NOT f.is_seed)
            GROUP BY f.pickup_city, f.pickup_neighborhood, f.delivery_city, f.delivery_neighborhood
        ) AS r;

        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object('weekday', t.weekday, 'orders', t.order_count)
                ORDER BY t.weekday
            ),
            '[]'::jsonb
        )
        INTO v_weekdays
        FROM (
            SELECT
                EXTRACT(ISODOW FROM f.created_at AT TIME ZONE 'UTC')::integer AS weekday,
                COUNT(*)::integer AS order_count
            FROM public.intelligence_order_facts AS f
            WHERE f.company_id = v_company.id
              AND f.created_at >= v_period_start::timestamp AT TIME ZONE 'UTC'
              AND f.created_at < (v_period_end + 1)::timestamp AT TIME ZONE 'UTC'
              AND (p_include_seed OR NOT f.is_seed)
            GROUP BY weekday
        ) AS t;

        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object('hour_utc', t.hour_utc, 'orders', t.order_count)
                ORDER BY t.hour_utc
            ),
            '[]'::jsonb
        )
        INTO v_hours
        FROM (
            SELECT
                EXTRACT(HOUR FROM f.created_at AT TIME ZONE 'UTC')::integer AS hour_utc,
                COUNT(*)::integer AS order_count
            FROM public.intelligence_order_facts AS f
            WHERE f.company_id = v_company.id
              AND f.created_at >= v_period_start::timestamp AT TIME ZONE 'UTC'
              AND f.created_at < (v_period_end + 1)::timestamp AT TIME ZONE 'UTC'
              AND (p_include_seed OR NOT f.is_seed)
            GROUP BY hour_utc
        ) AS t;

        INSERT INTO public.company_patterns (
            company_id,
            pattern_key,
            period_start,
            period_end,
            sample_size,
            metrics,
            updated_at
        )
        VALUES
            (
                v_company.id,
                'overview',
                v_period_start,
                v_period_end,
                v_sample_size,
                jsonb_build_object(
                    'data_status', CASE WHEN v_sample_size < 20 THEN 'collecting_data' ELSE 'ready' END,
                    'minimum_sample_size', 20,
                    'orders', v_total_orders,
                    'completed_orders', v_completed_orders,
                    'cancelled_orders', v_cancelled_orders,
                    'completion_rate', ROUND(v_completed_orders::numeric / NULLIF(v_total_orders, 0), 4),
                    'revenue', v_revenue,
                    'average_order_value', v_average_order_value,
                    'includes_seed_data', p_include_seed
                ),
                now()
            ),
            (
                v_company.id,
                'route_mix',
                v_period_start,
                v_period_end,
                v_sample_size,
                jsonb_build_object('routes', v_routes, 'includes_seed_data', p_include_seed),
                now()
            ),
            (
                v_company.id,
                'demand_by_weekday',
                v_period_start,
                v_period_end,
                v_sample_size,
                jsonb_build_object('weekdays', v_weekdays, 'includes_seed_data', p_include_seed),
                now()
            ),
            (
                v_company.id,
                'demand_by_hour',
                v_period_start,
                v_period_end,
                v_sample_size,
                jsonb_build_object('hours_utc', v_hours, 'includes_seed_data', p_include_seed),
                now()
            )
        ON CONFLICT (company_id, pattern_key, period_start, period_end)
        DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            metrics = EXCLUDED.metrics,
            updated_at = EXCLUDED.updated_at;

        v_rows_written := v_rows_written + 4;
    END LOOP;

    RETURN v_rows_written;
END;
$$;

REVOKE ALL ON FUNCTION public.intelligence_refresh_company_patterns(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intelligence_refresh_company_patterns(boolean) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS Order_company_created_seed_idx
    ON public."Order" ("companyId", "createdAt")
    WHERE "companyId" IS NOT NULL;
