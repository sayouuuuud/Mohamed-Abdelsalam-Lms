--
-- PostgreSQL database dump
--

\restrict 3xUNXoScKC49axhrUTb5H4U0pxuCzlS4yvH7SHgJZ6xQGzyyxBVlcuf1OV7zdUV

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: admin_wipe_all_data("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."admin_wipe_all_data"("keep_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  -- Tables that must survive the wipe (public pages + configuration).
  keep_tables text[] := array['site_content', 'site_theme', 'settings', 'profiles'];
  table_list  text;
begin
  -- Build a comma-separated, schema-qualified list of every table to wipe.
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
    into table_list
  from pg_tables
  where schemaname = 'public'
    and tablename <> all(keep_tables);

  -- Truncate them all in one shot; CASCADE clears dependent rows safely.
  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;

  -- Remove all accounts except the acting admin.
  delete from public.profiles where id <> keep_admin_id;
  delete from auth.users where id <> keep_admin_id;
end;
$$;


--
-- Name: claim_video_job("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."claim_video_job"("p_worker_id" "text") RETURNS TABLE("job_id" "uuid", "video_id" "uuid", "r2_raw_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v_job_id uuid; v_video_id uuid; v_raw_key text;
begin
  select vj.id, vj.video_id, v.r2_raw_key into v_job_id, v_video_id, v_raw_key
    from public.video_jobs vj join public.videos v on v.id = vj.video_id
   where vj.status in ('queued','failed') and vj.attempts < 3
   order by vj.created_at asc limit 1 for update skip locked;
  if v_job_id is null then return; end if;
  update public.video_jobs set status='claimed', claimed_by=p_worker_id, claimed_at=now(), attempts=attempts+1 where id=v_job_id;
  return query select v_job_id, v_video_id, v_raw_key;
end;
$$;


--
-- Name: count_distinct_actors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."count_distinct_actors"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(distinct actor_id) from public.activity_logs;
$$;


--
-- Name: get_advanced_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_advanced_analytics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  views_data jsonb;
  funnel_data jsonb;
  top_students jsonb;
  course_completion jsonb;
  exam_insights jsonb;
  period_comparison jsonb;
  refunds_analysis jsonb;
  peak_times jsonb;
  coupon_performance jsonb;
  dropoff_points jsonb;
  time_to_completion jsonb;
  notifications_engagement jsonb;
  payment_trends jsonb;
begin
  -- 1. Views Report
  select jsonb_build_object(
    'top_pages', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as views 
        from public.page_views 
        where path != '/' and path not like '%admin%'
        group by path 
        order by views desc 
        limit 5
      ) t
    ), '[]'::jsonb),
    'device_distribution', coalesce((
      select jsonb_agg(t) from (
        select device, count(*) as value 
        from public.page_views 
        group by device
      ) t
    ), '[]'::jsonb)
  ) into views_data;

  -- 2. Funnel Data (Overall completed courses)
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from public.page_views),
    'registered', (select count(*) from public.students),
    'buyers', (select count(distinct student_id) from public.enrollments),
    'completed', (
      select count(distinct e.id) 
      from public.enrollments e
      where (
        select count(*) from public.lesson_progress lp where lp.enrollment_id = e.id and lp.completed = true
      ) >= nullif((select count(*) from public.course_lessons cl join public.course_sections cs on cs.id = cl.section_id where cs.course_id = e.course_id), 0)
    )
  ) into funnel_data;

  -- 3. Top Students
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select s.id, s.name, s.email, 
           (select count(*) from public.enrollments e where e.student_id = s.id) as courses_count,
           (select coalesce(sum(o.total), 0) from public.orders o where o.student_name = s.name and o.status = 'approved') as total_spent
    from public.students s
    order by total_spent desc, courses_count desc
    limit 10
  ) t into top_students;

  -- 4. Course Completion (Average Progress Percentage)
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select c.title as name, 
           count(e.id) as enrolled,
           coalesce(
             round(
               avg(
                 cast((select count(*) from public.lesson_progress lp where lp.enrollment_id = e.id and lp.completed = true) as numeric)
                 / 
                 nullif((select count(*) from public.course_lessons cl join public.course_sections cs on cs.id = cl.section_id where cs.course_id = c.id), 0)
               ) * 100
             )
           , 0) as completion_rate
    from public.courses c
    left join public.enrollments e on e.course_id = c.id
    group by c.id, c.title
    order by enrolled desc
    limit 5
  ) t into course_completion;

  -- 5. Exam Insights
  select jsonb_build_object(
    'average_score', (select coalesce(avg(score), 0) from public.exam_submissions where status in ('ناجح', 'راسب')),
    'total_passed', (select count(*) from public.exam_submissions where status = 'ناجح'),
    'total_failed', (select count(*) from public.exam_submissions where status = 'راسب'),
    'hardest_questions', coalesce((
      select jsonb_agg(hq) from (
        select 
          q.question_text as text,
          count(a.id) filter (where a.is_correct = false) as wrong_answers,
          count(a.id) as total_answers
        from public.exam_answers a
        join public.exam_questions q on q.id = a.question_id
        group by q.id, q.question_text
        having count(a.id) filter (where a.is_correct = false) > 0
        order by wrong_answers desc
        limit 5
      ) hq
    ), '[]'::jsonb)
  ) into exam_insights;

  -- 6. Refunds Analysis
  select jsonb_build_object(
    'refunded_count', (select count(*) from public.orders where status = 'refunded'),
    'refunded_sum', (select coalesce(sum(total), 0) from public.orders where status = 'refunded'),
    'cancelled_count', (select count(*) from public.orders where status = 'cancelled'),
    'cancelled_sum', (select coalesce(sum(total), 0) from public.orders where status = 'cancelled')
  ) into refunds_analysis;

  -- 7. Peak Times (Heatmap) - GitHub Style (Last 365 days)
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select 
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      count(*) as activity_count
    from public.orders
    where status = 'approved'
      and created_at >= (now() - interval '365 days')
    group by date_trunc('day', created_at)
    order by date_trunc('day', created_at)
  ) t into peak_times;

  -- 8. Coupon Performance
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select 
      o.coupon_code as code,
      count(*) as uses,
      sum(o.total) as revenue_generated,
      sum(o.discount) as total_discount
    from public.orders o
    where o.coupon_code is not null and o.coupon_code != '' and o.status = 'approved'
    group by o.coupon_code
    order by uses desc
    limit 5
  ) t into coupon_performance;

  -- 9. Course Dropoff Points
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select c.title || ' - ' || cs.title || ' - ' || cl.title as lesson, count(lp.id) as completion_count
    from public.course_lessons cl
    join public.course_sections cs on cs.id = cl.section_id
    join public.courses c on c.id = cs.course_id
    left join public.lesson_progress lp on lp.lesson_id = cl.id and lp.completed = true
    group by cl.id, cl.title, cs.title, c.title
    order by completion_count asc
    limit 20
  ) t into dropoff_points;

  -- 10. Time to Completion (Average days from enrollment to last progress)
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select c.title as course, 
           avg(extract(epoch from (lp.completed_at - e.enrolled_at))/86400) as avg_days
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    join (
      select enrollment_id, max(completed_at) as completed_at 
      from public.lesson_progress 
      where completed = true 
      group by enrollment_id
    ) lp on lp.enrollment_id = e.id
    group by c.id, c.title
    order by avg_days desc
    limit 20
  ) t into time_to_completion;

  -- 11. Notifications Engagement
  select jsonb_build_object(
    'total_sent', (select count(*) from public.notifications),
    'total_read', (select count(*) from public.notification_reads)
  ) into notifications_engagement;

  -- 12. Payment Trends (By method)
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select 
      to_char(created_at, 'YYYY-MM') as month,
      method,
      count(*) as count,
      sum(total) as sum_amount
    from public.orders
    where status = 'approved'
    group by month, method
    order by month asc
  ) t into payment_trends;

  -- Build final JSON
  return jsonb_build_object(
    'views_data', views_data,
    'funnel_data', funnel_data,
    'top_students', top_students,
    'course_completion', course_completion,
    'exam_insights', exam_insights,
    'refunds_analysis', refunds_analysis,
    'peak_times', peak_times,
    'coupon_performance', coupon_performance,
    'dropoff_points', dropoff_points,
    'time_to_completion', time_to_completion,
    'notifications_engagement', notifications_engagement,
    'payment_trends', payment_trends
  );
end;
$$;


--
-- Name: get_views_daily(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."get_views_daily"("start_ts" timestamp with time zone) RETURNS TABLE("day" "date", "views" bigint, "uniques" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    date_trunc('day', created_at)::date        as day,
    count(*)                                     as views,
    count(distinct visitor_id)                   as uniques
  from public.page_views
  where created_at >= start_ts
    and device <> 'bot'
  group by 1
  order by 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, phone, grade, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'phone', null),
    coalesce(new.raw_user_meta_data ->> 'grade', null),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: has_permission("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."has_permission"("p_resource" "text", "p_level" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    public.is_full_admin()
    or exists (
      select 1
      from public.assistant_permissions ap
      join public.profiles pr on pr.id = ap.profile_id
      where ap.profile_id = auth.uid()
        and pr.role = 'assistant'
        and ap.resource = p_resource
        and (
          ap.access_level = 'manage'
          or (p_level = 'view' and ap.access_level in ('view', 'manage'))
        )
    );
$$;


--
-- Name: increment_coupon_used("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."increment_coupon_used"("p_code" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.coupons set used = used + 1 where code = p_code;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


--
-- Name: is_full_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_full_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


--
-- Name: owns_lecture_via_order("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."owns_lecture_via_order"("p_lecture_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'approved'
      and o.student_id = auth.uid()
      and oi.lecture_id = p_lecture_id
  );
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: validate_lecture_monthly_course_branch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_lecture_monthly_course_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.monthly_course_id is not null and not exists (
    select 1 from public.monthly_courses mc
    where mc.id = new.monthly_course_id and mc.branch_id = new.branch_id
  ) then
    raise exception 'Lecture and monthly course must belong to the same branch';
  end if;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text" DEFAULT ''::"text" NOT NULL,
    "actor_role" "text" DEFAULT ''::"text" NOT NULL,
    "action" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "target_id" "text",
    "target_label" "text",
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_logs_action_check" CHECK (("action" = ANY (ARRAY['create'::"text", 'update'::"text", 'delete'::"text", 'approve'::"text", 'reject'::"text"]))),
    CONSTRAINT "activity_logs_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['admin'::"text", 'assistant'::"text", ''::"text"])))
);


--
-- Name: assignment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assignment_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "options" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "correct_index" integer DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "kind" "text" DEFAULT 'mcq'::"text" NOT NULL
);


--
-- Name: assignment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assignment_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'لم يبدأ'::"text" NOT NULL,
    "score" integer,
    "attachment_url" "text",
    "submitted_at" timestamp with time zone,
    CONSTRAINT "assignment_submissions_status_check" CHECK (("status" = ANY (ARRAY['لم يبدأ'::"text", 'قيد التنفيذ'::"text", 'تم التسليم'::"text", 'مصحّح'::"text"])))
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "course_id" "uuid",
    "section_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "instructions" "text"[] DEFAULT '{}'::"text"[],
    "due_date" "date",
    "points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lecture_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "assignments_type_check" CHECK (("type" = ANY (ARRAY['تسليم'::"text", 'اختبار'::"text"])))
);


--
-- Name: assistant_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assistant_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "resource" "text" NOT NULL,
    "access_level" "text" DEFAULT 'none'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "assistant_permissions_access_level_check" CHECK (("access_level" = ANY (ARRAY['none'::"text", 'view'::"text", 'manage'::"text"])))
);


--
-- Name: auth_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."auth_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text" DEFAULT ''::"text" NOT NULL,
    "actor_role" "text" DEFAULT ''::"text" NOT NULL,
    "event" "text" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auth_logs_actor_role_check" CHECK (("actor_role" = ANY (ARRAY['admin'::"text", 'assistant'::"text", ''::"text"]))),
    CONSTRAINT "auth_logs_event_check" CHECK (("event" = ANY (ARRAY['login'::"text", 'logout'::"text"])))
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" "text" NOT NULL,
    "type" "text" NOT NULL,
    "course" "text",
    "description" "text",
    "custom" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage_id" "uuid",
    "branch_id" "uuid",
    "lecture_id" "uuid",
    CONSTRAINT "calendar_events_type_check" CHECK (("type" = ANY (ARRAY['محاضرة'::"text", 'اختبار'::"text", 'موعد تسليم'::"text", 'اجتماع'::"text", 'حدث مخصص'::"text"])))
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "lecture_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monthly_course_id" "uuid",
    "term_id" "uuid",
    CONSTRAINT "cart_items_one_product" CHECK (("num_nonnulls"("lecture_id", "monthly_course_id") = 1))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "courses" integer DEFAULT 0 NOT NULL,
    "students" integer DEFAULT 0 NOT NULL,
    "icon" "text" DEFAULT 'Layers'::"text" NOT NULL,
    "color" "text" DEFAULT 'text-primary'::"text" NOT NULL,
    "bg" "text" DEFAULT 'bg-primary/10'::"text" NOT NULL,
    "status" "text" DEFAULT 'مفعّل'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categories_status_check" CHECK (("status" = ANY (ARRAY['مفعّل'::"text", 'متوقف'::"text"])))
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "title" "text" NOT NULL,
    "issuer" "text" DEFAULT 'منصة تعليمية'::"text" NOT NULL,
    "issued_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: coupon_lectures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."coupon_lectures" (
    "coupon_id" "uuid" NOT NULL,
    "lecture_id" "uuid" NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "display_code" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" NOT NULL,
    "value" numeric DEFAULT 0 NOT NULL,
    "used" integer DEFAULT 0 NOT NULL,
    "limit" integer DEFAULT 0 NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope" "text" DEFAULT 'all'::"text" NOT NULL,
    CONSTRAINT "coupons_scope_check" CHECK (("scope" = ANY (ARRAY['all'::"text", 'lectures'::"text"]))),
    CONSTRAINT "coupons_status_check" CHECK (("status" = ANY (ARRAY['نشط'::"text", 'منتهي'::"text", 'متوقف'::"text"]))),
    CONSTRAINT "coupons_type_check" CHECK (("type" = ANY (ARRAY['نسبة مئوية'::"text", 'مبلغ ثابت'::"text"])))
);


--
-- Name: course_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."course_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'فيديو'::"text" NOT NULL,
    "duration" "text" DEFAULT ''::"text" NOT NULL,
    "video_url" "text",
    "description" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "course_lessons_type_check" CHECK (("type" = ANY (ARRAY['فيديو'::"text", 'مقال'::"text", 'تمرين'::"text"])))
);


--
-- Name: course_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."course_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "instructor" "text",
    "category" "text",
    "level" "text" DEFAULT 'مبتدئ'::"text" NOT NULL,
    "students" integer DEFAULT 0 NOT NULL,
    "lessons" integer DEFAULT 0 NOT NULL,
    "duration_hours" numeric DEFAULT 0 NOT NULL,
    "rating" numeric DEFAULT 0 NOT NULL,
    "price" "text" DEFAULT '0 ج.م'::"text" NOT NULL,
    "status" "text" DEFAULT 'مسودة'::"text" NOT NULL,
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "branch_id" "uuid",
    CONSTRAINT "courses_level_check" CHECK (("level" = ANY (ARRAY['مبتدئ'::"text", 'متوسط'::"text", 'متقدم'::"text"]))),
    CONSTRAINT "courses_status_check" CHECK (("status" = ANY (ARRAY['منشور'::"text", 'مسودة'::"text", 'مؤرشف'::"text"])))
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: exam_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."exam_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answer_text" "text",
    "selected_option" "text",
    "file_url" "text",
    "awarded_points" integer DEFAULT 0 NOT NULL,
    "is_correct" boolean,
    "needs_manual" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: exam_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."exam_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "text",
    "points" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_type" "text" DEFAULT 'mcq'::"text" NOT NULL,
    "content_mode" "text" DEFAULT 'text'::"text" NOT NULL,
    "image_url" "text",
    "model_answer" "text",
    "order_index" integer DEFAULT 0 NOT NULL
);


--
-- Name: exam_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."exam_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "total" integer NOT NULL,
    "status" "text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "grading_status" "text" DEFAULT 'graded'::"text" NOT NULL,
    "auto_score" integer DEFAULT 0 NOT NULL,
    "manual_score" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "exam_submissions_status_check" CHECK (("status" = ANY (ARRAY['ناجح'::"text", 'راسب'::"text", 'قيد التصحيح'::"text"])))
);


--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."exams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "course" "text" NOT NULL,
    "duration" integer NOT NULL,
    "questions" integer NOT NULL,
    "participants" integer DEFAULT 0 NOT NULL,
    "avg_score" numeric DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pass_mark" integer DEFAULT 50 NOT NULL,
    "description" "text",
    "shuffle" boolean DEFAULT false NOT NULL,
    "branch_id" "uuid",
    "stage_id" "uuid",
    CONSTRAINT "exams_status_check" CHECK (("status" = ANY (ARRAY['منشور'::"text", 'مسودة'::"text", 'منتهي'::"text"])))
);


--
-- Name: learning_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."learning_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "activity_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "minutes" integer DEFAULT 0 NOT NULL
);


--
-- Name: lecture_playback_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lecture_playback_sessions" (
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "sid" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "lecture_playback_sessions"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."lecture_playback_sessions" IS 'Latest active playback session id (sid) per (student, lesson). Rotating the sid on each lecture open invalidates previously issued video tokens. Accessed only via the service-role admin client server-side.';


--
-- Name: lectures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lectures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "old_price" numeric,
    "badge" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image" "text",
    "release_date" timestamp with time zone,
    "instructor" "text",
    "what_you_learn" "text"[] DEFAULT '{}'::"text"[],
    "monthly_course_id" "uuid",
    "course_sort_order" integer DEFAULT 0 NOT NULL,
    "monthly_course_section_id" "uuid",
    "is_free" boolean DEFAULT false NOT NULL
);


--
-- Name: lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lesson_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lecture_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "duration" "text" DEFAULT ''::"text" NOT NULL,
    "is_free" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "video_url" "text",
    "description" "text",
    "content_type" "text" DEFAULT 'فيديو'::"text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "video_id" "uuid",
    CONSTRAINT "lessons_content_type_check" CHECK (("content_type" = ANY (ARRAY['فيديو'::"text", 'مقال'::"text", 'تمرين'::"text"])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_avatar" "text",
    "subject" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "time_label" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "has_attachment" boolean DEFAULT false NOT NULL,
    "sender_role" "text" DEFAULT 'طالب'::"text" NOT NULL,
    "course" "text" DEFAULT ''::"text" NOT NULL,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "is_online" boolean DEFAULT false NOT NULL,
    "chat_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "student_unread" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


--
-- Name: monthly_course_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."monthly_course_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "monthly_course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: monthly_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."monthly_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "old_price" numeric,
    "badge" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "term_id" "uuid",
    CONSTRAINT "monthly_courses_check" CHECK ((("old_price" IS NULL) OR ("old_price" >= "price"))),
    CONSTRAINT "monthly_courses_price_check" CHECK (("price" >= (0)::numeric))
);


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_reads" (
    "notification_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "time_label" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid",
    "grade" "text",
    "stage_id" "uuid",
    "branch_id" "uuid",
    "lecture_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['طالب'::"text", 'دفع'::"text", 'اختبار'::"text", 'كورس'::"text", 'رسالة'::"text", 'نظام'::"text"])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "lecture_id" "uuid",
    "lecture_title" "text" DEFAULT ''::"text" NOT NULL,
    "branch_title" "text" DEFAULT ''::"text" NOT NULL,
    "stage_title" "text" DEFAULT ''::"text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "monthly_course_id" "uuid",
    "item_type" "text" DEFAULT 'lecture'::"text" NOT NULL,
    "term_id" "uuid",
    CONSTRAINT "order_items_valid_type" CHECK (("item_type" = ANY (ARRAY['lecture'::"text", 'course_bundle'::"text"])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "student_name" "text" DEFAULT ''::"text" NOT NULL,
    "student_email" "text" DEFAULT ''::"text" NOT NULL,
    "student_phone" "text" DEFAULT ''::"text" NOT NULL,
    "method" "text" DEFAULT ''::"text" NOT NULL,
    "reference" "text" DEFAULT ''::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "discount" numeric DEFAULT 0 NOT NULL,
    "coupon_code" "text",
    "receipt_url" "text"
);


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."page_views" (
    "id" bigint NOT NULL,
    "path" "text" DEFAULT '/'::"text" NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "device" "text" DEFAULT 'desktop'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "page_views_device_check" CHECK (("device" = ANY (ARRAY['desktop'::"text", 'mobile'::"text", 'tablet'::"text", 'bot'::"text", 'unknown'::"text"])))
);


--
-- Name: page_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."page_views" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."page_views_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "student_name" "text" NOT NULL,
    "student_email" "text" NOT NULL,
    "student_phone" "text" NOT NULL,
    "course" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "method" "text" NOT NULL,
    "receipt_url" "text",
    "reference" "text" NOT NULL,
    "submitted_at" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid",
    CONSTRAINT "payments_method_check" CHECK (("method" = ANY (ARRAY['انستاباي'::"text", 'فودافون كاش'::"text", 'بطاقة ائتمان'::"text", 'تحويل بنكي'::"text", 'نقدي'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['قيد المراجعة'::"text", 'مقبول'::"text", 'مرفوض'::"text"])))
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."platform_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "is_streaming_enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "worker_cpu_threads" integer DEFAULT 2,
    "worker_ram_mb" integer DEFAULT 2048,
    "worker_concurrency" integer DEFAULT 1,
    "segment_duration_sec" integer DEFAULT 4,
    CONSTRAINT "platform_settings_single_row" CHECK (("id" = 1))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "phone" "text",
    "grade" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color_preset" "text" DEFAULT 'navy'::"text",
    "notif_prefs" "jsonb" DEFAULT '{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}'::"jsonb",
    "avatar_url" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'student'::"text", 'assistant'::"text"])))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['جاهز'::"text", 'قيد التجهيز'::"text", 'فشل'::"text"]))),
    CONSTRAINT "reports_type_check" CHECK (("type" = ANY (ARRAY['مالي'::"text", 'أكاديمي'::"text", 'حضور'::"text", 'نظام'::"text"])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: site_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."site_content" (
    "section" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "site_content"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."site_content" IS 'CMS: محتوى الصفحات العامة مقسّم بالأقسام. القيم المحفوظة تُدمج مع الـ defaults في الكود، فالجدول يبدأ فارغًا بأمان.';


--
-- Name: COLUMN "site_content"."section"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."site_content"."section" IS 'معرّف القسم: hero | features | stats | testimonials | cta | footer | navbar | seo';


--
-- Name: site_theme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."site_theme" (
    "id" boolean DEFAULT true NOT NULL,
    "active_color" "text" DEFAULT 'navy'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "neon_preset" "text" DEFAULT 'teal-violet'::"text" NOT NULL,
    "light_preset" "text" DEFAULT 'navy-gold'::"text",
    CONSTRAINT "site_theme_singleton" CHECK (("id" = true))
);


--
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "idx" "text" DEFAULT ''::"text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text" DEFAULT ''::"text" NOT NULL,
    "rows" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "formula" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "accent" "text" DEFAULT 'emerald'::"text" NOT NULL,
    "term_price" numeric DEFAULT 0 NOT NULL,
    "term_old_price" numeric,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: streaming_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."streaming_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "worker_cpu_threads" integer DEFAULT 2 NOT NULL,
    "worker_ram_mb" integer DEFAULT 2048 NOT NULL,
    "worker_concurrency" integer DEFAULT 1 NOT NULL,
    "renditions" "jsonb" DEFAULT '[{"name": "360p", "width": 640, "height": 360, "abitrate": "64k", "vbitrate": "600k"}, {"name": "480p", "width": 854, "height": 480, "abitrate": "96k", "vbitrate": "1200k"}, {"name": "720p", "width": 1280, "height": 720, "abitrate": "128k", "vbitrate": "2500k"}, {"name": "1080p", "width": 1920, "height": 1080, "abitrate": "192k", "vbitrate": "5000k"}]'::"jsonb" NOT NULL,
    "segment_duration_sec" integer DEFAULT 4 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "streaming_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "streaming_settings_segment_duration_sec_check" CHECK ((("segment_duration_sec" >= 2) AND ("segment_duration_sec" <= 10))),
    CONSTRAINT "streaming_settings_worker_concurrency_check" CHECK ((("worker_concurrency" >= 1) AND ("worker_concurrency" <= 8))),
    CONSTRAINT "streaming_settings_worker_cpu_threads_check" CHECK ((("worker_cpu_threads" >= 1) AND ("worker_cpu_threads" <= 32))),
    CONSTRAINT "streaming_settings_worker_ram_mb_check" CHECK ((("worker_ram_mb" >= 512) AND ("worker_ram_mb" <= 65536)))
);


--
-- Name: student_content_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."student_content_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "status" "text",
    "score" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_content_progress_item_type_check" CHECK (("item_type" = ANY (ARRAY['lesson'::"text", 'assignment'::"text"])))
);


--
-- Name: student_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."student_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "browser" "text" DEFAULT 'Chrome'::"text" NOT NULL,
    "os" "text" DEFAULT 'Windows 11'::"text" NOT NULL,
    "device_type" "text" DEFAULT 'كمبيوتر مكتبي'::"text" NOT NULL,
    "ip" "text" DEFAULT '192.168.1.1'::"text" NOT NULL,
    "city" "text" DEFAULT 'القاهرة'::"text" NOT NULL,
    "country" "text" DEFAULT 'مصر'::"text" NOT NULL,
    "last_active" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sessions" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: student_weekly_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."student_weekly_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "lessons_target" integer DEFAULT 7 NOT NULL,
    "hours_target" integer DEFAULT 14 NOT NULL,
    "assignments_target" integer DEFAULT 3 NOT NULL,
    "exams_target" integer DEFAULT 2 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "gender" "text" DEFAULT 'ذكر'::"text" NOT NULL,
    "avatar" "text",
    "courses" integer DEFAULT 0 NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "spent" "text" DEFAULT '0 ج.م'::"text" NOT NULL,
    "status" "text" DEFAULT 'نشط'::"text" NOT NULL,
    "joined_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage_id" "uuid",
    "last_seen_at" timestamp with time zone,
    CONSTRAINT "students_gender_check" CHECK (("gender" = ANY (ARRAY['ذكر'::"text", 'أنثى'::"text"]))),
    CONSTRAINT "students_status_check" CHECK (("status" = ANY (ARRAY['نشط'::"text", 'موقوف'::"text"])))
);


--
-- Name: terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "old_price" numeric,
    "sort_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: video_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."video_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "claimed_by" "text",
    "claimed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "video_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'claimed'::"text", 'done'::"text", 'failed'::"text"])))
);


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "r2_raw_key" "text",
    "r2_hls_prefix" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "duration_sec" integer,
    "error_message" "text",
    "renditions" "jsonb",
    "file_size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "videos_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'error'::"text"])))
);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."activity_logs" ("id", "actor_id", "actor_name", "actor_role", "action", "resource", "target_id", "target_label", "details", "created_at") FROM stdin;
2305acfa-3333-4f27-b7b1-8bae75dccd83	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-06 14:25:55.621531+00
a2fc6ec2-cb7f-4a6f-9dcd-b47885ffd67c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-06 17:08:08.383915+00
b68c25d9-a7eb-4a7f-9a62-0cfff00a0d09	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: footer	\N	2026-07-06 20:51:05.152596+00
a2188ede-2d37-403b-924c-cc6805b001a6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: موقوف	\N	2026-07-06 20:53:32.169931+00
0cf16267-607a-45bf-8e98-bbd3720bb7bb	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	فرع: الاحتمالات	\N	2026-07-06 20:57:35.154068+00
d70d8315-11f9-4bca-a35b-8fa99cf7a52b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	واجب: اعدا المركبه 1	\N	2026-07-06 20:59:04.77541+00
ecb45506-9087-41f8-80b0-7e9fafc9966e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	الملف الشخصي: محمد أحمد	\N	2026-07-06 21:02:54.564386+00
5b05b1fa-f7a5-4aac-b9a4-115c235e05d2	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-06 21:04:04.005744+00
d4977b70-7f59-4b06-9cc7-8514b224ae11	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-06 21:04:23.533097+00
a351fbdc-1494-47c5-9e57-62e9bd712755	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: hero	\N	2026-07-06 21:07:50.812451+00
ed8c1605-01c5-47c1-bcf6-19a9b2b600ec	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: hero	\N	2026-07-06 21:09:20.644228+00
678fdb83-2b1e-4db4-87c8-f0bfdc7e3b11	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: hero	\N	2026-07-06 21:12:10.003905+00
cdf94c6b-0c06-4669-adca-d2412b3b12d8	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: features	\N	2026-07-06 21:12:33.21055+00
25cec4ff-929f-4625-b78c-38c7a6aa8aef	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	settings	\N	إعادة ضبط قسم: features	\N	2026-07-06 21:12:50.659075+00
bbf45e52-213a-477a-b29f-4dbbc26f839e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: features	\N	2026-07-06 21:12:52.83679+00
6e4590b0-cebf-44d6-b337-0d7cf72e4b42	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: footer	\N	2026-07-06 21:14:24.80034+00
afa071e5-01ea-4199-a88f-8640fdfdc767	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: navbar	\N	2026-07-06 21:15:00.560213+00
bea154e8-a58e-4785-8b89-e81b913a1428	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	approve	payments	2d66e35b-010e-4002-aa09-84af27eba78a	طلب ORD-2026-6463 — Exercitation facilis (170 ج.م)	\N	2026-07-07 13:02:40.451838+00
16b3d6ca-19c3-4497-a73b-9fccba381a34	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	settings	eebff5bc-2e84-42a9-85e4-e305c519ecfa	مساعد جديد: سيد (sayed.s.elshazly@gmail.com)	\N	2026-07-08 07:18:50.075862+00
30be7fed-b4dc-4ae9-bd87-294e9c2fa149	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	settings	f1f8849a-ee21-4dc8-a807-ad2bea1704bd	إزالة مساعد ID: f1f8849a-ee21-4dc8-a807-ad2bea1704bd	\N	2026-07-08 07:18:57.562676+00
00ebc646-c7a0-4f86-aa6e-9266a9602ab4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRBUA5Z7	اختبار: علي الصف الاول	\N	2026-07-08 08:52:04.065183+00
7ac0f420-2e5f-4c61-8be0-c07f7272e0b3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: نشط	\N	2026-07-08 08:53:38.499118+00
91f2d89e-4cbb-4641-b106-38c8b4a8b25f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: موقوف	\N	2026-07-08 08:53:41.989776+00
4da4f2df-915f-4de5-8398-81bf493cdfac	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: غير نشط	\N	2026-07-08 08:53:47.082027+00
f2ece8b0-52ff-4e2b-8d9e-04df8b975116	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	students	STD-9112	رسالة لـ عمار ابراهيم (رسالة داخلية)	\N	2026-07-08 08:54:39.673326+00
27c8dcb8-8f64-4af5-ab91-ce1ae5be45e6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	messages	ticket-80aeee02-mrao404o	حالة تذكرة: closed	\N	2026-07-08 08:55:05.996512+00
327f8198-0f53-4e69-baf2-8886fa2c9075	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	messages	ticket-83eaa8dc-mrbuf7zr	حالة تذكرة: closed	\N	2026-07-08 08:56:08.39487+00
158d5d36-5966-4581-a926-1027188da155	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	13db3541-5e7b-4e5c-b646-f60c8e13e7bd	درس: تركيب القوى	\N	2026-07-08 09:00:46.319733+00
283c626e-26a3-4e37-87ea-c10f81a7df2b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: مقدمه المنصه	\N	2026-07-08 09:02:32.547755+00
747ac7f7-8a6c-4692-a7cc-a55002a201b2	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	532f436c-c715-467c-a492-65964cbdae93	درس: مقدمه المنصه	\N	2026-07-08 09:03:56.722054+00
7d2d817c-8591-48cb-b0e6-37d5f2b2175b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	approve	payments	26dd8ee1-1b80-4789-9c27-0ab0712b0693	طلب ORD-2026-9588 — عمار ابراهيم (135 ج.م)	\N	2026-07-08 09:05:26.99533+00
b3626d12-8ef0-4571-abb9-a014eb40a129	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: تست	\N	2026-07-08 09:08:28.594666+00
1e2d5d50-2c41-4038-94d0-871cea3e7202	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: تركيب القوى1	\N	2026-07-08 09:15:14.443815+00
8a5e44a0-f075-4cf9-a145-793f494a2d59	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	settings	\N	تصدير نسخة احتياطية للإعدادات	\N	2026-07-08 09:20:08.446326+00
aefe91d2-3430-41d7-a54a-52683bbe0bea	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-08 09:20:43.745984+00
8a6ce75d-56d1-478a-8e38-2fe947456e4b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	settings	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	مساعد جديد: عمار (mr01972e52d322@gmail.com)	\N	2026-07-08 09:22:04.456048+00
1d53d784-44a2-4cc5-99a4-e9f6df23ced6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-08 09:24:10.508676+00
721f2a06-0fab-4132-9fa2-788de6c7ddbd	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: seo	\N	2026-07-08 10:01:05.760238+00
46f55380-f9ba-49ab-b8e8-95f7e4172242	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: موقوف	\N	2026-07-08 10:34:42.149116+00
51216756-ee5f-4dd2-9c25-dd0da780b08a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9112	حالة طالب: غير نشط	\N	2026-07-08 10:43:36.821787+00
9879e812-ceeb-4e26-8646-c54b7fb09c2d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	notifications	\N	إشعار: اجازة الاسبوع القادم	\N	2026-07-08 12:29:18.318163+00
099ce289-e6c0-4b7d-9dee-a88995bd3b0f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-08 12:30:24.923489+00
6a81a4f3-cfb7-4caa-834d-cc73f0ed14de	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-08 12:30:46.066299+00
220f1d5c-230f-40c2-abed-3102e75f22fe	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	الملف الشخصي: محمد أحمد	\N	2026-07-08 12:31:11.884217+00
e4e582f8-8689-43b5-8d70-e9f287974224	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-08 12:31:35.759054+00
7d43b749-a248-4992-9ad9-6367d2e83a11	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-08 12:32:49.000257+00
dec0304e-90f1-4775-be5a-8e8afcca3bed	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-08 12:32:53.52026+00
bf14beb1-686d-4985-a594-015bea244eda	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-08 12:33:06.609297+00
8bbbe63b-05b6-422b-8983-3cbbcad395ff	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9110	حالة طالب: موقوف	\N	2026-07-09 12:12:27.127521+00
85f5ed0f-e2f6-403d-90e0-020f56fc9a5b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-09 12:19:04.155956+00
90944c6f-8ab0-40eb-a45f-3462e1dfe2e8	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9110	حالة طالب: نشط	\N	2026-07-09 12:20:49.134504+00
e021fa98-5ab4-4942-a7a5-37b318ba2ca4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: تجربة	\N	2026-07-09 13:15:06.048754+00
4e665603-04e1-4f07-8a84-0aa24e34e298	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	9d670ddd-31b1-4d12-9110-85fc25ac29fd	محاضرة ID: 9d670ddd-31b1-4d12-9110-85fc25ac29fd	\N	2026-07-09 13:15:16.5645+00
246c9b77-1827-4d96-9be6-d94f86d97ea1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	554ef064-3f79-4865-90d9-e8ab802a1bb7	درس: مقدمة عن الأعداد المركّبة	\N	2026-07-09 16:25:29.963542+00
8fa42213-73c8-4963-a7df-5fdfa47f771b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	554ef064-3f79-4865-90d9-e8ab802a1bb7	درس: مقدمة عن الأعداد المركّبة	\N	2026-07-09 16:36:15.747529+00
efcc9707-a2e4-4f7a-8995-623d0eadabd6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الأول	\N	2026-07-12 16:30:17.781143+00
cdb90791-86cd-40b1-898d-33905d166e7f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	d290807c-fed6-449a-bd0c-0c02a8840f8a	كورس ID: d290807c-fed6-449a-bd0c-0c02a8840f8a	\N	2026-07-12 16:31:24.44653+00
4c48858d-ec41-48c7-8432-c06d19a8609d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: البتنجان المقلي	\N	2026-07-12 16:58:00.514705+00
6f8b1b5a-abc2-4332-8cd4-b72fd13b90d4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	60972911-0a92-43bb-96e0-ae5b3c8e8c2b	محاضرة ID: 60972911-0a92-43bb-96e0-ae5b3c8e8c2b	\N	2026-07-12 16:58:31.896828+00
ebda6d4c-26ed-41ad-bf71-bd68da9a521a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: المراجعة النهائية	\N	2026-07-12 17:37:16.421113+00
9cd2cd27-1710-4bc1-9973-0666f589ad0c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	2efdd530-e1aa-48d2-bb5b-87f6abe2d9d9	تصنيف كورس ID: 2efdd530-e1aa-48d2-bb5b-87f6abe2d9d9	\N	2026-07-12 17:38:36.263342+00
deab2625-219e-4f0e-b850-02ad7f0a2f09	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: المراجعة النهائية	\N	2026-07-12 17:38:54.055401+00
2fe4bcb7-3a63-4878-8327-1524df45b8a7	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	60972911-0a92-43bb-96e0-ae5b3c8e8c2b	محاضرة ID: 60972911-0a92-43bb-96e0-ae5b3c8e8c2b	\N	2026-07-12 17:39:07.674842+00
0efeedf2-ada7-4e06-ac71-d8ee40ba4769	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	categories	deb10e69-eaf7-42ba-b028-64923234030d	كورس: البتنجان المقلي	\N	2026-07-12 17:45:00.811785+00
61060c56-1da6-461d-811a-f0a158dc2e38	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس السهر الاول	\N	2026-07-13 15:24:39.948234+00
4f23939b-573f-4173-a034-9173d5ab2acd	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: تست	\N	2026-07-13 15:25:58.028145+00
44fef4d2-00e6-488f-a348-ae1de62cfdeb	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاعداد المركبه	\N	2026-07-13 15:26:56.062297+00
9b482886-309e-439d-afab-295307edcf6a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: مصينكس	\N	2026-07-13 15:27:12.853678+00
d8a894f9-66be-48fe-8cb0-74815c562fb6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	approve	payments	2e1fb2f9-1ab2-42ee-93bb-22741f19f5cc	طلب ORD-2026-6767 — عمار ابراهيم (0 ج.م)	\N	2026-07-13 15:28:32.254673+00
4f0f7cd2-985c-4404-a28f-f306c8104c8f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاسبوع الثاني	\N	2026-07-13 15:29:29.853537+00
d58075a3-953a-42f7-a670-35381a6a5a4b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	f1155eaa-b86e-452d-9890-0fc50de5a18d	كورس ID: f1155eaa-b86e-452d-9890-0fc50de5a18d	\N	2026-07-13 15:36:08.704126+00
9198ca51-6fc7-4821-b3b6-d8fbb114cc57	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	deb10e69-eaf7-42ba-b028-64923234030d	كورس ID: deb10e69-eaf7-42ba-b028-64923234030d	\N	2026-07-13 15:36:13.433405+00
78d393cb-6241-4d28-b0bf-0e30e2c3190f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	36fbe422-00f9-4ca5-898a-7718fb7cdb85	كورس ID: 36fbe422-00f9-4ca5-898a-7718fb7cdb85	\N	2026-07-13 15:36:16.760755+00
ec822b15-2fd1-420d-825e-fac7b62cf48f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الاول	\N	2026-07-13 15:37:23.956707+00
bdc30a37-8fbb-4aec-bed3-824faed91b6c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الاول	\N	2026-07-13 15:37:53.217693+00
ea773873-41c1-4550-8dae-4a8d58a1918d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثاني	\N	2026-07-13 15:38:09.387168+00
9c07ee49-1bdf-49fc-b310-fbf6b9043b77	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثالث	\N	2026-07-13 15:38:18.937368+00
618caf34-f0f9-4956-909b-bb085fe9b2bd	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاعدا المركبه	\N	2026-07-13 15:41:07.378405+00
4ecc01ab-2e17-48c5-89b5-33207f85d10e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	62d7e451-884d-46bc-8788-1e310f17f388	محاضرة ID: 62d7e451-884d-46bc-8788-1e310f17f388	\N	2026-07-13 15:41:49.697528+00
04f4aa40-4022-4994-801d-3fabdcaf0230	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	62d7e451-884d-46bc-8788-1e310f17f388	محاضرة ID: 62d7e451-884d-46bc-8788-1e310f17f388	\N	2026-07-13 15:41:52.27555+00
d30cc460-c958-4fe8-aef2-3b3d7e1a4997	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	4eb92a47-6e2c-4892-a982-5584d639e3de	محاضرة ID: 4eb92a47-6e2c-4892-a982-5584d639e3de	\N	2026-07-13 15:41:57.118045+00
48f98bf4-73f6-46e3-9e76-826edcc8671c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: مفهوم النهاية	\N	2026-07-13 15:43:55.255928+00
576516c7-2b91-4588-a300-63cdb9c5a478	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: مفهوم النهاية	\N	2026-07-13 15:43:56.313966+00
62b62663-4c26-42eb-8b08-70dfd5026faa	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	c00260f5-f61c-4033-8304-082bfc5d4ad7	درس ID: c00260f5-f61c-4033-8304-082bfc5d4ad7	\N	2026-07-13 15:47:22.668013+00
68c5c00a-1cb5-4d20-ba5c-27c702720282	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	students	STD-9112	طالب كود: STD-9112	\N	2026-07-13 15:51:37.348127+00
2dd30cb8-c270-4933-a875-9b32c2c28b41	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	students	STD-9114	طالب كود: STD-9114	\N	2026-07-13 15:51:54.778853+00
08632724-39e0-4fae-b9f6-bbe67cf0dec5	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	2c861dcc-bc3b-467d-8063-976848beba68	كورس ID: 2c861dcc-bc3b-467d-8063-976848beba68	\N	2026-07-13 15:53:48.741263+00
543afac8-d0f3-45ae-ae54-aec050006ecf	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:40:33.271892+00
f7cbe42f-dfdf-489a-8e07-0e70788ba39e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:40:34.161577+00
526deaad-fbd4-4bfb-b159-6689aa9e52a6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:40:44.540434+00
63ed0300-b91d-4d7f-9a64-ba16b75a0d83	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:40:45.083609+00
c2e9f482-a194-415c-802a-4693c80b2885	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:40:55.836073+00
0126e54e-32e6-4712-9188-66e4e6e547af	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:40:56.394943+00
9d23c152-4455-469b-877d-46ea9e630860	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:41:08.793053+00
408e66e7-529c-4992-b84d-80925f2af5a1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:41:09.476612+00
4470ff89-1b30-45d9-a3d1-490d78551ff4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:41:18.3966+00
6285370d-eeb7-460e-9164-090a6e641f24	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:41:18.944555+00
d411fd01-f43f-4ac7-b74d-a39229e45a0c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 17:41:26.316319+00
51936c3c-8c0b-4d9e-a5e8-087625af154f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 17:41:26.911932+00
00c9a54c-6969-4b4c-9152-fa0d9b449cc3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9114	حالة طالب: موقوف	\N	2026-07-13 19:11:10.488118+00
b9efc07e-1f03-4cd4-9a67-c600cd133102	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	students	STD-9114	حالة طالب: نشط	\N	2026-07-13 19:11:24.126329+00
cc1bf57a-d45a-42a8-ae96-21c436a44af1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	students	STD-9114	رسالة لـ عمار ابراهيم (رسالة داخلية)	\N	2026-07-13 19:11:40.243579+00
fb218055-7814-4305-bd1a-d1b43eb53c5e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRJLRS5F	اختبار: علي البرمجه	\N	2026-07-13 19:15:58.891845+00
f5f95dae-fc48-42df-b8b8-22eb9bb14bd3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الاول	\N	2026-07-13 19:21:42.961627+00
e78ba59a-28ad-4783-baa0-68ce11dc9f07	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الاول	\N	2026-07-13 19:22:28.676751+00
f12cd256-9a28-4800-ab52-3adb7b0765e6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثاني	\N	2026-07-13 19:22:34.585085+00
9be17cf9-2506-49c2-adae-1a137d21f36a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاعداد المركبه	\N	2026-07-13 19:24:41.885971+00
f85ed342-372e-43de-a4f5-20c534549cfe	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: هي بس محتاجة {highlight} صح	\N	2026-07-13 19:27:00.054077+00
0a6d639e-6392-4b02-b241-6938c2edeafc	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	7a02492b-efdd-4aa5-bf17-797f66b7a916	درس: هي بس محتاجة {highlight} صح	\N	2026-07-13 19:29:15.974049+00
231512e1-9f82-45e9-8546-6658c716521c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:26.95743+00
5bd64331-c03f-4379-b00c-ed29bccb6d7f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:28.624882+00
04e8ee7f-6101-4011-b60a-ef7ce3d42c5c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:30.167526+00
c4053b7f-6271-4781-b6f0-63a9af09a6c5	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:31.429943+00
562e367e-343a-4842-aa69-49e29b2f533b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:32.490494+00
037d04d3-4257-40fb-9eb2-ff93cc83484a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:33.488301+00
ca288877-3296-430d-80c8-bf61fbe2d42c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:34.799663+00
009d0aa5-a59d-49f7-b6fc-9ed0888c757e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:36.049819+00
a04717a7-3d08-40a2-83ee-243470986413	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: ن	\N	2026-07-13 19:30:37.249859+00
4749063f-9b8e-4875-846e-a2f7cc2b9ac1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	واجب: تن	\N	2026-07-13 19:30:48.88241+00
3f5faa05-d9d6-448a-8e2e-abf0551dddd1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	30607ad3-10cb-45d2-8482-e87272658787	درس ID: 30607ad3-10cb-45d2-8482-e87272658787	\N	2026-07-13 19:31:09.486191+00
22841db3-653d-4b5c-8f1f-07532b8663e5	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	30607ad3-10cb-45d2-8482-e87272658787	درس ID: 30607ad3-10cb-45d2-8482-e87272658787	\N	2026-07-13 19:31:11.703495+00
f746e39c-4215-4935-91d5-c389563775ab	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	cb358cdd-b373-4f96-918f-b4c0e6d32295	درس ID: cb358cdd-b373-4f96-918f-b4c0e6d32295	\N	2026-07-13 19:31:14.902796+00
a57fbe11-0f8a-42e7-a0ca-6ddab450a7ca	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	d7b4a3cd-eb41-4680-b814-92cd19b0db47	درس ID: d7b4a3cd-eb41-4680-b814-92cd19b0db47	\N	2026-07-13 19:31:17.095445+00
857aa3fc-c3d2-4d96-89cf-a65bd04390b1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	6bca53b2-68d6-4751-894f-13b6f354b3e9	درس ID: 6bca53b2-68d6-4751-894f-13b6f354b3e9	\N	2026-07-13 19:31:19.504079+00
802f0883-67f7-4bb2-87b4-2382b7c75485	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	8dd117d6-c341-4072-b6fc-208c3db986fe	درس ID: 8dd117d6-c341-4072-b6fc-208c3db986fe	\N	2026-07-13 19:31:25.477446+00
9445b6af-c0a9-476d-b484-460602cecbd9	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	657efc7b-4e64-4d44-bc94-af097e3d1d8f	درس ID: 657efc7b-4e64-4d44-bc94-af097e3d1d8f	\N	2026-07-13 19:31:28.301383+00
86c1a86b-5571-444f-b3e8-47503be02d7e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	81ddf0ef-69fa-47e9-b1d6-840fa2621462	درس ID: 81ddf0ef-69fa-47e9-b1d6-840fa2621462	\N	2026-07-13 19:31:30.850432+00
5a3e02c9-853a-4b0d-bca3-eb98297fa88b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	aee973cd-42d3-49b0-9f40-bfc281dde46b	درس ID: aee973cd-42d3-49b0-9f40-bfc281dde46b	\N	2026-07-13 19:31:40.229655+00
f3c7320f-7adf-465b-aa5b-80c57102bb99	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الثانس	\N	2026-07-13 19:34:06.144537+00
97547dc8-71ac-44af-b716-71422980bf46	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: ulhv	\N	2026-07-13 19:34:25.739878+00
d7f5a9e8-3f02-466f-bad9-90e13f3a431f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاعداد	\N	2026-07-13 19:39:34.250957+00
059b633a-f4b0-40f4-ac83-bb57ee224bb4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: مقدمه	\N	2026-07-13 19:42:15.424017+00
c37c2ac0-214a-41ec-959c-61b998dbcf2a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	notifications	\N	إشعار: هخنم	\N	2026-07-13 19:46:07.285403+00
a5ae9dfd-fa34-4719-908e-ac4517a71cbd	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	approve	payments	705aa037-7713-464e-9cdf-aaa9f0d95368	طلب ORD-2026-6042 — عمار ابراهيم (0 ج.م)	\N	2026-07-13 19:47:34.040386+00
a2ef155d-0bf1-499f-9012-391e690fe18a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	coupons	CPN-07	كوبون: CPN-07	\N	2026-07-13 19:47:50.685427+00
786c601f-fd63-4738-96db-7e33777e22da	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	reports	\N	تقرير مخصص جديد	\N	2026-07-13 19:48:34.690981+00
593bd675-6076-44dd-9fc8-fa757297537d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 19:49:13.211626+00
f55aa2a2-2f2f-4e1e-9fd4-6df36dacbad4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 19:49:13.860667+00
0a395f1b-a215-4607-9df8-6dbd26096a78	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 19:49:39.948932+00
b31c1104-0f56-441c-ac47-21924a82860e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 19:49:40.609364+00
e5b8e99b-a77b-47a4-9732-dc9716deb84e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات النظام العامة	\N	2026-07-13 19:50:03.216912+00
a1740693-f613-4f42-83ad-356b4e730b52	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	إعدادات المنصة - الاستريمنج: false	\N	2026-07-13 19:50:03.791204+00
c20ca230-6723-4349-86bc-fab1b45b5d04	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	settings	\N	تصدير نسخة احتياطية للإعدادات	\N	2026-07-13 19:50:31.183341+00
7e839fa0-72bd-4c05-97a3-9f767cc6363e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	settings	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	مساعد جديد: عمار (mr019711222@gmail.com)	\N	2026-07-13 19:50:56.965525+00
b326929d-3f84-4e42-862d-aeaf7ed26f18	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: تهنم	\N	2026-07-13 19:58:09.186848+00
6baf8cfa-f817-429c-86c7-55921ab9a50d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	students	STD-9114	رسالة لـ عمار ابراهيم (إشعار)	\N	2026-07-15 18:01:57.481601+00
77ec8555-0729-42d4-8fb6-feaf3c89bf4e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRME3384	اختبار: مقدمه في البرمجه	\N	2026-07-15 18:04:08.126222+00
5b1aa282-6d1d-4732-bbd2-3108e3c287a0	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRME5XER	اختبار: منتصف الشرخ	\N	2026-07-15 18:06:20.475332+00
7952e693-ae89-4206-901e-b305ff076ba5	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRME7RQN	اختبار: عاتى	\N	2026-07-15 18:07:46.46213+00
217a6705-b05c-48dc-babd-6aef341c4c0a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر	\N	2026-07-15 18:10:20.021869+00
56099faf-53c9-4e72-a532-487c44f24775	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الاول	\N	2026-07-15 18:10:53.123629+00
af0d43e0-6ba6-417f-9607-c096cda70b5d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثامي	\N	2026-07-15 18:10:58.579922+00
5f99a297-0e28-4f16-a69f-0c82ab0a6af3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاعداد المركبه	\N	2026-07-15 18:11:30.0041+00
bb0223ed-c1f1-4f65-abf0-b1b803e0375b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: مقدمه	\N	2026-07-15 18:13:34.565022+00
fac18fa2-ef55-415d-b251-01d2d75b216e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	4afa8980-8bd2-42f7-9094-ce7bd8b057f2	محاضرة ID: 4afa8980-8bd2-42f7-9094-ce7bd8b057f2	\N	2026-07-15 18:16:39.023472+00
6f0fbfdd-11cc-462a-8a9f-a5c543a14cc7	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: 5	\N	2026-07-15 18:17:53.930536+00
ccd4c654-1a2d-4452-a518-e235833ce439	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: تست	\N	2026-07-15 18:19:06.331548+00
af9b6b6c-cbfe-4809-a557-4e59c24aef23	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاول	\N	2026-07-15 18:19:18.427103+00
60159a9f-22d5-486b-92b8-fb19dcf4d3ce	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الالو	\N	2026-07-15 18:19:37.60871+00
df3897fd-bc3a-4803-b7fc-c482cba0f67a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	categories	403ae8ec-399e-4dcb-91b3-6a987e5b262f	كورس: تست	\N	2026-07-15 18:21:16.328676+00
fde029fa-2b86-4ded-819d-78c599dfc235	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: navbar	\N	2026-07-15 18:23:14.423499+00
a317dd30-5324-47c5-b36e-2a1192ed3ce8	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRMK62FB	اختبار: تن	\N	2026-07-15 20:54:24.797838+00
562ca21c-aaac-481b-b9f2-d5b4032358c6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	exams	EX-MRMO6FQN	اختبار: مقدمه في البرجمه	\N	2026-07-15 22:46:40.469966+00
aa21d3ef-4ba4-478b-9d69-1af4af4c5f56	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	403ae8ec-399e-4dcb-91b3-6a987e5b262f	كورس ID: 403ae8ec-399e-4dcb-91b3-6a987e5b262f	\N	2026-07-15 22:54:17.331538+00
808ae537-6b9c-44f4-955b-33d664cf6b63	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	82b41ad8-70be-4e80-9e4d-2b8ed2bf43e9	كورس ID: 82b41ad8-70be-4e80-9e4d-2b8ed2bf43e9	\N	2026-07-15 22:54:19.387137+00
d28e1c3c-135c-4052-bd94-ba810b088073	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	9fb1ce9b-ed40-49cb-9af7-bb32250b2fe8	كورس ID: 9fb1ce9b-ed40-49cb-9af7-bb32250b2fe8	\N	2026-07-15 22:54:21.251148+00
3310f89a-060c-4c39-9b60-4889fd4a360a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	37c00e41-7ef2-4e74-a791-a2e5c851f998	كورس ID: 37c00e41-7ef2-4e74-a791-a2e5c851f998	\N	2026-07-15 22:54:24.128916+00
46c635b0-d88c-4229-9c4a-db2dd8c98467	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	categories	62f467d5-b566-4918-8ece-7c419cadeb4c	كورس ID: 62f467d5-b566-4918-8ece-7c419cadeb4c	\N	2026-07-15 22:54:26.699619+00
dce5bb0b-ee2a-4b90-aef3-69168aa9d22a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	60972911-0a92-43bb-96e0-ae5b3c8e8c2b	محاضرة ID: 60972911-0a92-43bb-96e0-ae5b3c8e8c2b	\N	2026-07-15 22:54:38.758554+00
8dc61876-7477-438b-a1ce-54a4149ea54d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	baf1dc65-5473-4f2c-be69-691f09df8952	محاضرة ID: baf1dc65-5473-4f2c-be69-691f09df8952	\N	2026-07-15 22:54:41.730332+00
7e58d7fd-c4fa-4fa3-a1da-0f2bbaaea5d4	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	0d79a689-499e-41be-83d2-68359667b4d5	محاضرة ID: 0d79a689-499e-41be-83d2-68359667b4d5	\N	2026-07-15 22:54:44.734013+00
86568c3b-b775-4d48-af15-9027760b6217	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	0d79a689-499e-41be-83d2-68359667b4d5	محاضرة ID: 0d79a689-499e-41be-83d2-68359667b4d5	\N	2026-07-15 22:54:47.214205+00
d71e38d6-0808-410f-81ff-36c9ae91c937	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	b9a6810e-7cf5-4130-a44e-2193668f3c83	محاضرة ID: b9a6810e-7cf5-4130-a44e-2193668f3c83	\N	2026-07-15 22:54:53.908182+00
a24bf23b-543d-4794-8e5a-eb269d3bf312	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	e82d6458-7cbb-4633-85e6-27a510ebc8ed	محاضرة ID: e82d6458-7cbb-4633-85e6-27a510ebc8ed	\N	2026-07-15 22:55:00.674701+00
02b89fbd-3cf7-4b26-b2af-9751f80c2522	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	0fe9ed97-240a-4af9-b1b5-49afb0c074f0	محاضرة ID: 0fe9ed97-240a-4af9-b1b5-49afb0c074f0	\N	2026-07-15 22:55:03.661642+00
541981bc-0c49-4723-ab46-352f17e2876f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	c80c5881-b16a-44bb-aa54-54cc9580c176	محاضرة ID: c80c5881-b16a-44bb-aa54-54cc9580c176	\N	2026-07-15 22:55:21.697102+00
b10044b0-afba-4dc7-8681-3153fefff5e9	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	f73c206e-2525-4316-bd58-648421011d73	محاضرة ID: f73c206e-2525-4316-bd58-648421011d73	\N	2026-07-15 22:55:25.661702+00
d22c3cc3-33b4-4186-919b-d01f81e5110a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	f1106200-0711-4463-8459-89ab84be457c	محاضرة ID: f1106200-0711-4463-8459-89ab84be457c	\N	2026-07-15 22:55:28.498845+00
f78f03ef-f6db-432a-a00c-a6c008d9c3b0	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	4afa8980-8bd2-42f7-9094-ce7bd8b057f2	محاضرة ID: 4afa8980-8bd2-42f7-9094-ce7bd8b057f2	\N	2026-07-15 22:55:31.087782+00
ae358aed-1212-4e79-99f3-48cd52444c2c	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	a4349f14-20d2-4caf-a971-4e34051dfb30	محاضرة ID: a4349f14-20d2-4caf-a971-4e34051dfb30	\N	2026-07-15 22:55:34.455389+00
d1e2f34d-5605-493b-baf8-b27e91276f2a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	delete	courses	05e23aa8-c7bc-4da4-a4b5-74cd73a928d1	محاضرة ID: 05e23aa8-c7bc-4da4-a4b5-74cd73a928d1	\N	2026-07-15 22:55:37.27942+00
3f69bbee-e81c-4f55-85eb-3ad60004deb6	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الاول	\N	2026-07-15 22:56:09.987462+00
2e9f7236-a359-45f8-a7cc-5239b36f4aea	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الاول	\N	2026-07-15 22:56:19.560375+00
c441d00a-3ec4-462f-af07-d43ccf97b1e0	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثاني	\N	2026-07-15 22:56:25.117704+00
115cf28e-4da1-42e9-9104-8b918953492d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	كورس: كورس الشهر الثاني	\N	2026-07-15 22:56:46.081225+00
3bd279b7-3429-4a5f-b148-2ba3ac41ab8a	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الاول	\N	2026-07-15 22:57:01.391981+00
c3a24e89-9eab-491b-a48c-0f8fe49cc378	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	categories	\N	تصنيف كورس: الاسبوع الثني	\N	2026-07-15 22:57:07.694714+00
2579e0d2-4183-4e78-9997-336dea7b9e06	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: محتوي الاسبوع الاول	\N	2026-07-15 22:57:31.795859+00
9218936a-f89e-4348-aa0b-cf16e63abc83	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: محتوي الاسبوع الاول الشهر الثاني	\N	2026-07-15 22:57:55.160347+00
43811e85-73ca-422a-a4e2-9394569de30f	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: الشرح	\N	2026-07-15 22:59:08.850345+00
999b3c69-d008-4f0b-be24-4fe31de0f7e2	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: تست	\N	2026-07-15 22:59:52.125388+00
a581cfe5-fb80-4140-8bc7-00b4b5019083	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	categories	13059596-1297-409d-b1ed-c7721d8114d7	كورس: كورس الشهر الثاني	\N	2026-07-15 23:00:02.604566+00
95c54bd1-1fce-42a5-b742-063e59804bcf	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	2bdd2d30-0534-4c0b-9324-72f1cb5b2515	درس: تست	\N	2026-07-15 23:02:17.250581+00
ab357730-8e53-481e-b25c-ae7750748752	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	approve	payments	51d36f1d-db8c-47d9-8c84-94433fc2973b	طلب ORD-2026-3437 — عمار ابراهيم (200 ج.م)	\N	2026-07-15 23:04:05.020755+00
4721318d-64f9-4725-a5e8-bd2f02e4ce54	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	settings	\N	محتوى الموقع — قسم: login_panel	\N	2026-07-15 23:06:34.9629+00
0f61c3b4-a738-40eb-bb3e-39d55295f6a3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	update	courses	667b1314-aacd-472f-80ef-5430ca0a0768	درس: النزعة المركزية	\N	2026-07-15 23:15:47.162122+00
477089c3-5952-42cf-80cb-63c51ecf51cd	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: 521	\N	2026-07-15 23:37:18.3739+00
ec407f70-df48-468f-ac68-6d482a8438c7	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	درس: دجكم	\N	2026-07-15 23:38:20.616916+00
9fcc3934-d570-4758-a773-efa8190258ec	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: خنم	\N	2026-07-15 23:39:13.634332+00
143aaa8d-2a4e-4975-b674-3b6e0dfd8931	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: مك	\N	2026-07-15 23:40:11.252021+00
5784ad43-41dd-45f7-8092-ab6a92ed2dea	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	create	courses	\N	محاضرة: الاداد	\N	2026-07-16 12:10:14.825394+00
\.


--
-- Data for Name: assignment_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."assignment_questions" ("id", "assignment_id", "question", "options", "correct_index", "position", "kind") FROM stdin;
2c8b823e-5cdc-45f2-9455-f4263452e099	c433b3df-e9c4-4cca-9bc5-c1c574bf648e	ما ناتج ٢ + ٢؟	{٣,٤,٥,٦}	1	0	mcq
64512a5f-f70a-48d0-b105-49d959bd478c	c433b3df-e9c4-4cca-9bc5-c1c574bf648e	ما ناتج ٣ × ٣؟	{٦,٧,٩,١٢}	2	1	mcq
54cdbc7b-db98-4ee2-9e63-161e8bd0c1b7	081a0b8b-361a-4dd2-aa9f-9626db449b96	ما الفكرة الأساسية التي تتناولها محاضرة «الدائرة المثلثية والنسب»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
77578aba-cb30-42e6-ad7c-94137329f6b4	081a0b8b-361a-4dd2-aa9f-9626db449b96	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
0c3cc127-3bac-4a59-ad22-14844e3da6cd	081a0b8b-361a-4dd2-aa9f-9626db449b96	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
adbc8ef2-1e09-4c6e-a435-929d7746f0c6	081a0b8b-361a-4dd2-aa9f-9626db449b96	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
84fbe7f8-6b8c-4f32-941e-09acba3984cd	b361a98d-39d6-4000-a676-1b010d807cc6	ما الفكرة الأساسية التي تتناولها محاضرة «الإحداثيات والمستقيم»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
3324894a-f016-45d4-9bf1-21e7f917e45a	b361a98d-39d6-4000-a676-1b010d807cc6	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
0c8ae965-e256-4cdd-a310-0a6aff0266b0	b361a98d-39d6-4000-a676-1b010d807cc6	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
af9df33f-2d96-43e0-96d2-c2c37a285f51	b361a98d-39d6-4000-a676-1b010d807cc6	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
e9917722-054f-4b45-ab0a-d58c2a2681bf	190bcaa3-b9af-4558-9d8c-0a591f3d1cfc	ما الفكرة الأساسية التي تتناولها محاضرة «الإحصاء الوصفي»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
5bb12bd1-5afa-4029-afa9-759b24ed13ea	190bcaa3-b9af-4558-9d8c-0a591f3d1cfc	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
7f85a74d-a29d-4512-ae12-823f4e51b52b	190bcaa3-b9af-4558-9d8c-0a591f3d1cfc	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
30a7ed23-ba35-46cc-bae5-1c269fdaa56a	190bcaa3-b9af-4558-9d8c-0a591f3d1cfc	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
f1506916-6c2c-4214-874a-89f9f772baaa	fca03807-e29d-4d5c-b4be-693c854ec4ed	ما الفكرة الأساسية التي تتناولها محاضرة «الجبر المتقدّم»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
0e5e00e7-15de-4845-8178-8c4b626d6c8f	fca03807-e29d-4d5c-b4be-693c854ec4ed	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
23877fee-dde8-4bec-8e2a-a8799cfbd9d4	fca03807-e29d-4d5c-b4be-693c854ec4ed	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
85cef510-89f4-40c1-99f6-a2660e354a39	fca03807-e29d-4d5c-b4be-693c854ec4ed	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
32bfdc50-072a-4290-bd4c-ca1443b5238c	29948baa-3f10-4f5b-aa9e-f8549ead3962	ما الفكرة الأساسية التي تتناولها محاضرة «التفاضل وتطبيقاته»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
09f0f89a-358f-450e-b771-6f679be76ba9	29948baa-3f10-4f5b-aa9e-f8549ead3962	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
8cd7b696-4d27-44fe-9c8d-f751bf5b1ae5	29948baa-3f10-4f5b-aa9e-f8549ead3962	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
bc276517-c9b9-42bc-ad74-a2a45a1f7b11	29948baa-3f10-4f5b-aa9e-f8549ead3962	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
bc22c385-76b6-4062-8b96-9db391558c46	ebf8b447-29b4-441c-8f33-77315000c766	ما الفكرة الأساسية التي تتناولها محاضرة «الديناميكا»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
e6e7fc6d-44ac-41a3-8264-fd76cd20266f	ebf8b447-29b4-441c-8f33-77315000c766	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
25300fd8-9f74-4c23-b028-a39efef184b9	ebf8b447-29b4-441c-8f33-77315000c766	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
753f27a0-1f37-494f-bb01-8333f29edc65	ebf8b447-29b4-441c-8f33-77315000c766	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
0d20c8d0-ae72-4821-9ac4-1b023e85d0d3	2239dbaf-14eb-43b2-8adf-656f6dbf9aba	ما الفكرة الأساسية التي تتناولها محاضرة «المتطابقات الشهيرة»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
3f5f94f7-54f6-4b2f-8c6e-b91552e6f31c	2239dbaf-14eb-43b2-8adf-656f6dbf9aba	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
9dfcf3c9-d2b1-4134-a52a-d44f0d7b59b8	2239dbaf-14eb-43b2-8adf-656f6dbf9aba	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
e5606cae-fb94-4c82-a1b4-e93fc9518e33	2239dbaf-14eb-43b2-8adf-656f6dbf9aba	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
2f4d7db4-2417-4f95-bcbd-19b031cebb90	1fe7e3aa-e583-4a28-aaf4-e4558534a073	ما الفكرة الأساسية التي تتناولها محاضرة «القطع المكافئ»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
f4e4041b-8f86-4ca9-b5c6-4f192a2bb6b6	1fe7e3aa-e583-4a28-aaf4-e4558534a073	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
518299d4-5651-49fd-aa0e-af9f322235cd	1fe7e3aa-e583-4a28-aaf4-e4558534a073	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
8118f9d9-4cee-474a-aa83-f6afdc399702	1fe7e3aa-e583-4a28-aaf4-e4558534a073	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
b374b8c6-197e-4f0c-8470-f2dcd1726199	3ddfafa1-e185-470d-b15a-9074dc0edecf	ما الفكرة الأساسية التي تتناولها محاضرة «الاحتمالات»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
f415badd-557a-4ea2-8ae0-4f5e968bf4a7	3ddfafa1-e185-470d-b15a-9074dc0edecf	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
fcd68e1c-e78f-4eae-a35a-f6dd9bf32702	3ddfafa1-e185-470d-b15a-9074dc0edecf	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
9928e45b-6d56-4f2f-8fc2-542939bd4d96	3ddfafa1-e185-470d-b15a-9074dc0edecf	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
e246450b-402a-4c7c-98eb-41461855a20b	62d4b874-6f5a-42c5-a0b3-9eb4ff138035	ما الفكرة الأساسية التي تتناولها محاضرة «الحركة وقوانين نيوتن»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
0e730f8c-982a-4df1-8c4a-ae99cbce2191	62d4b874-6f5a-42c5-a0b3-9eb4ff138035	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
92381120-e05b-4806-b497-c6dd4d6d1e7c	62d4b874-6f5a-42c5-a0b3-9eb4ff138035	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
16ac8e96-0b60-46d1-9ab5-cdee2dd26035	62d4b874-6f5a-42c5-a0b3-9eb4ff138035	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
1e900717-df09-4ad1-9f2f-a83a1a70759f	8dd7101e-7ca9-411a-b2cf-efd3d0da202e	ما الفكرة الأساسية التي تتناولها محاضرة «قوانين الجيب وحل المثلث»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
11e87a0c-be67-4afa-ab4e-12fec2098876	8dd7101e-7ca9-411a-b2cf-efd3d0da202e	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
c9c54a29-ecb3-4394-a48b-c058a510664d	8dd7101e-7ca9-411a-b2cf-efd3d0da202e	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
cf4c20a1-6f6e-4793-9c84-d0a61c84ddc9	8dd7101e-7ca9-411a-b2cf-efd3d0da202e	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
a315217a-7b89-4693-a1ed-03eb4fce022c	35c8985f-f438-453e-a316-8a12ded94107	ما الفكرة الأساسية التي تتناولها محاضرة «التفاضل والتكامل المتقدّم»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
cb65a37e-0a99-4d47-b9c9-8f523e29cbd5	35c8985f-f438-453e-a316-8a12ded94107	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
19633175-e8ab-4413-a02f-d204fe1a3207	35c8985f-f438-453e-a316-8a12ded94107	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
c0f14df1-a8c5-4d05-a720-f7b622b3d647	35c8985f-f438-453e-a316-8a12ded94107	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
6485387d-b24e-4238-abe9-26acfee3bdb5	1c142171-6c8f-43bc-b796-0a28e5d26ab6	ما الفكرة الأساسية التي تتناولها محاضرة «المعادلات والمتباينات»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
d379f5ef-5897-4988-a674-75bea0eda7ae	1c142171-6c8f-43bc-b796-0a28e5d26ab6	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
0bde047f-c256-43dd-9648-944fd8ee61b2	1c142171-6c8f-43bc-b796-0a28e5d26ab6	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
8316ee27-334a-4085-8279-eac2fcb5e7e3	1c142171-6c8f-43bc-b796-0a28e5d26ab6	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
006285ba-685c-4843-a14e-cbeb884b643d	1d1be514-45f4-4947-9767-3de515fd6d2c	ما الفكرة الأساسية التي تتناولها محاضرة «التكامل»؟	{"مفهوم أساسي في الموضوع","موضوع غير متعلق بالمنهج","مراجعة تاريخية فقط","لا شيء مما سبق"}	0	1	mcq
3a8e770c-57e9-4829-aad8-e13a650b7bcf	1d1be514-45f4-4947-9767-3de515fd6d2c	أي من التالي يُعد خطوة صحيحة عند حل مسائل هذه المحاضرة؟	{"تجاهل المعطيات","قراءة المعطيات وتحديد المطلوب","التخمين العشوائي","حذف الوحدات"}	1	2	mcq
56602603-1816-46a7-8640-4973a83c71ec	1d1be514-45f4-4947-9767-3de515fd6d2c	ما النسبة المطلوبة لاجتياز اختبار المحاضرة؟	{30%,45%,60%,90%}	2	3	mcq
af26bca1-fdda-4d17-80a6-f2177ca59afc	1d1be514-45f4-4947-9767-3de515fd6d2c	متى يُفضّل حل اختبار المحاضرة؟	{"قبل مشاهدة أي درس","بعد إكمال دروس المحاضرة","بدون مذاكرة","في امتحان آخر"}	1	4	mcq
\.


--
-- Data for Name: assignment_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."assignment_submissions" ("id", "assignment_id", "student_id", "status", "score", "attachment_url", "submitted_at") FROM stdin;
98d1cc09-363e-4690-af10-0d9dd4156574	c433b3df-e9c4-4cca-9bc5-c1c574bf648e	625048f2-3bc5-4765-9ce8-fdf14b534ce5	مصحّح	8	\N	2026-06-25 05:29:35.094418+00
\.


--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."assignments" ("id", "code", "course_id", "section_id", "type", "title", "description", "instructions", "due_date", "points", "created_at", "lecture_id", "sort_order") FROM stdin;
c433b3df-e9c4-4cca-9bc5-c1c574bf648e	ASG-DEMO-Q1	46049902-0da3-4d72-a282-a2c1de6dc285	\N	اختبار	اختبار الوحدة الأولى	اختبار قصير على الوحدة الأولى	{}	2026-07-03	10	2026-06-26 05:29:35.094418+00	\N	0
74cb22cd-12ae-4b98-9989-ae88a22efc78	ASG-DEMO-S1	46049902-0da3-4d72-a282-a2c1de6dc285	\N	تسليم	واجب الوحدة الأولى	حل تمارين الوحدة الأولى وسلّمها	{}	2026-06-29	20	2026-06-26 05:29:35.094418+00	\N	0
081a0b8b-361a-4dd2-aa9f-9626db449b96	ASG-LEC-101	\N	\N	اختبار	اختبار: الدائرة المثلثية والنسب	اختبار قصير لقياس فهمك لمحاضرة «الدائرة المثلثية والنسب». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	4
b361a98d-39d6-4000-a676-1b010d807cc6	ASG-LEC-102	\N	\N	اختبار	اختبار: الإحداثيات والمستقيم	اختبار قصير لقياس فهمك لمحاضرة «الإحداثيات والمستقيم». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	998872f6-d922-485f-b1ad-0df5d674cb4f	4
190bcaa3-b9af-4558-9d8c-0a591f3d1cfc	ASG-LEC-105	\N	\N	اختبار	اختبار: الإحصاء الوصفي	اختبار قصير لقياس فهمك لمحاضرة «الإحصاء الوصفي». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	9d0cb383-eeac-4d4d-b9b7-e6c352996635	3
fca03807-e29d-4d5c-b4be-693c854ec4ed	ASG-LEC-106	\N	\N	اختبار	اختبار: الجبر المتقدّم	اختبار قصير لقياس فهمك لمحاضرة «الجبر المتقدّم». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	faec3889-0537-4177-a48f-c750832c7840	4
29948baa-3f10-4f5b-aa9e-f8549ead3962	ASG-LEC-109	\N	\N	اختبار	اختبار: التفاضل وتطبيقاته	اختبار قصير لقياس فهمك لمحاضرة «التفاضل وتطبيقاته». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	81ae09bb-d4e4-4e3f-9c1c-fe52cae5394a	4
ebf8b447-29b4-441c-8f33-77315000c766	ASG-LEC-110	\N	\N	اختبار	اختبار: الديناميكا	اختبار قصير لقياس فهمك لمحاضرة «الديناميكا». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	2ede3ef9-a763-497e-955b-3e0fa046fb12	3
2239dbaf-14eb-43b2-8adf-656f6dbf9aba	ASG-LEC-111	\N	\N	اختبار	اختبار: المتطابقات الشهيرة	اختبار قصير لقياس فهمك لمحاضرة «المتطابقات الشهيرة». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	ea53043c-28e4-491f-b1df-72c0c4204c8d	4
1fe7e3aa-e583-4a28-aaf4-e4558534a073	ASG-LEC-112	\N	\N	اختبار	اختبار: القطع المكافئ	اختبار قصير لقياس فهمك لمحاضرة «القطع المكافئ». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	3438f9cc-5abd-41d7-997e-152d9754ab5e	3
3ddfafa1-e185-470d-b15a-9074dc0edecf	ASG-LEC-113	\N	\N	اختبار	اختبار: الاحتمالات	اختبار قصير لقياس فهمك لمحاضرة «الاحتمالات». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	4c60e0dc-4e6a-48b5-97a0-bd88f4736767	3
62d4b874-6f5a-42c5-a0b3-9eb4ff138035	ASG-LEC-114	\N	\N	اختبار	اختبار: الحركة وقوانين نيوتن	اختبار قصير لقياس فهمك لمحاضرة «الحركة وقوانين نيوتن». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	5b12216c-1959-4551-a7a3-e8943d8bf86f	3
8dd7101e-7ca9-411a-b2cf-efd3d0da202e	ASG-LEC-115	\N	\N	اختبار	اختبار: قوانين الجيب وحل المثلث	اختبار قصير لقياس فهمك لمحاضرة «قوانين الجيب وحل المثلث». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	c3fc1554-ff8f-450b-a41b-4074ab00dbb0	4
35c8985f-f438-453e-a316-8a12ded94107	ASG-LEC-116	\N	\N	اختبار	اختبار: التفاضل والتكامل المتقدّم	اختبار قصير لقياس فهمك لمحاضرة «التفاضل والتكامل المتقدّم». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	43e59e65-75e0-40b0-a5f5-407cd17215aa	3
1c142171-6c8f-43bc-b796-0a28e5d26ab6	ASG-LEC-117	\N	\N	اختبار	اختبار: المعادلات والمتباينات	اختبار قصير لقياس فهمك لمحاضرة «المعادلات والمتباينات». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	45644434-2983-473e-8f03-7b28c5fd5f75	4
1d1be514-45f4-4947-9767-3de515fd6d2c	ASG-LEC-118	\N	\N	اختبار	اختبار: التكامل	اختبار قصير لقياس فهمك لمحاضرة «التكامل». اجتزه بعد إكمال دروس المحاضرة.	{"أجب عن جميع الأسئلة","لكل سؤال إجابة واحدة صحيحة","تحتاج إلى 60% على الأقل للنجاح"}	\N	10	2026-06-28 23:48:05.748741+00	c61e4564-6a9a-4729-acfd-e5a8a62bc828	4
\.


--
-- Data for Name: assistant_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."assistant_permissions" ("id", "profile_id", "resource", "access_level", "created_at", "updated_at") FROM stdin;
191633b4-93f5-4cae-aa33-3e881f40c3cc	eebff5bc-2e84-42a9-85e4-e305c519ecfa	dashboard	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
a54a6830-7629-4006-8004-bb352f043656	eebff5bc-2e84-42a9-85e4-e305c519ecfa	students	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
4ec1b3f9-9b4d-42e4-b43a-add18ae909f0	eebff5bc-2e84-42a9-85e4-e305c519ecfa	categories	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
0f50c589-d82f-49f7-b10e-555200002f0f	eebff5bc-2e84-42a9-85e4-e305c519ecfa	courses	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
44fd013d-aaec-4d7a-8612-bc742a0e6c20	eebff5bc-2e84-42a9-85e4-e305c519ecfa	exams	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
294b2554-78f0-451b-b586-5e713781dc93	eebff5bc-2e84-42a9-85e4-e305c519ecfa	calendar	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
ad06af56-61af-4eb6-9ae3-72463c4dc389	eebff5bc-2e84-42a9-85e4-e305c519ecfa	payments	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
05380c74-be79-4d5d-bf62-30835917151d	eebff5bc-2e84-42a9-85e4-e305c519ecfa	messages	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
5e6e725a-cfd7-4ac3-872e-5d3de3c0cc55	eebff5bc-2e84-42a9-85e4-e305c519ecfa	notifications	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
97849264-0947-4b42-9cbe-a8ebdbb9010a	eebff5bc-2e84-42a9-85e4-e305c519ecfa	coupons	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
656a96e9-bd29-4665-bd5b-383fce2f4bdd	eebff5bc-2e84-42a9-85e4-e305c519ecfa	reports	manage	2026-07-08 07:18:49.854648+00	2026-07-08 07:18:49.854648+00
b5f46b39-8b62-4832-aceb-8362311b4b85	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	dashboard	manage	2026-07-08 09:22:04.349795+00	2026-07-08 09:22:04.349795+00
4e5d752c-a9e2-4cf6-b87a-9d4120a38059	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	students	manage	2026-07-08 09:22:04.349795+00	2026-07-08 09:22:04.349795+00
91271c19-1c82-4cb6-ae1d-fae4906b0a39	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	dashboard	manage	2026-07-13 19:50:56.790389+00	2026-07-13 19:50:56.790389+00
\.


--
-- Data for Name: auth_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."auth_logs" ("id", "actor_id", "actor_name", "actor_role", "event", "ip", "user_agent", "created_at") FROM stdin;
bc0bcc09-8495-4d51-83a9-11ca9c7e33b7	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 13:36:25.258205+00
a96b3ee5-dfa0-4e2a-99ef-9315656f4c52	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 13:36:30.02087+00
55dda400-8a56-43e8-979e-2b3ac35cb5cf	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 13:38:05.238035+00
f5f1620f-07ff-4604-afd8-68a33329c056	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 13:41:15.524071+00
cdea2403-769c-4f9c-a3f8-0f30780998a8	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 14:51:07.730361+00
d20b1177-b0d7-4283-bbc1-663e4e17a714	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.1.48	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-06 17:35:59.538641+00
d511d496-6e63-4e68-b5d3-649222c4cdf5	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.120.146	Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.51 Mobile/15E148 Safari/604.1	2026-07-06 17:52:58.960848+00
c170e17f-2059-4353-ba69-8844b293fa62	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.120.146	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0	2026-07-07 13:02:22.794456+00
c7e44aa0-eafc-4f29-a28c-75b2e7f9eab8	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	عمار	assistant	login	197.54.144.35	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-08 09:22:18.542563+00
e9c0aef5-5118-4539-806f-395d5c24f282	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	156.217.94.61	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-08 10:45:03.069003+00
20e99b6f-8e42-431e-bcee-98726385d320	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.94.61	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-08 10:45:25.779326+00
9e616095-004d-4224-949d-fe8907b81608	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.144.35	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0	2026-07-08 12:26:08.65963+00
7eff0047-fe2b-4a3a-b546-1e207c26e61e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 12:10:08.513794+00
c9481fab-61f5-4ee5-ae51-c1ce43accd9d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 12:12:35.544057+00
cefadafb-095a-4993-b710-538bd135c9db	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 12:12:59.343787+00
bc393d45-016a-410c-8222-40f52dc160e3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 13:16:57.14081+00
e6775331-b5c2-49c2-a732-28b92bf62959	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 14:58:35.28665+00
e480e15f-cf88-4692-9946-6e096bb3c2a8	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	156.217.94.61	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 15:13:09.872459+00
8f08d037-92f6-4139-94ba-56bfab2adf8d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 16:43:36.518078+00
6b9afbe3-49f4-431f-9e7c-c86854f097e3	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 16:47:10.040268+00
a29f4296-4ce3-4d6b-b310-c1fd06df663e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 16:49:12.599081+00
5e2f2c91-51f1-4642-92bb-db5d88b7f815	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-09 16:50:03.22855+00
38b448a3-08b9-4364-8595-dd433e5bd5f7	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.144.35	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0	2026-07-12 13:34:19.321548+00
1f9deb4a-0e4c-4280-900e-4d7b2b224e31	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	197.54.144.35	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0	2026-07-12 13:34:31.224702+00
6b73e12d-bf7e-4fed-a6af-7bc1427b8c8d	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.144.35	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0	2026-07-12 13:34:39.985472+00
c4fa15da-0894-4b43-9ddd-7ea80cad543b	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	logout	197.54.144.35	Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0	2026-07-12 13:47:50.341144+00
f0b5a691-321f-4cbb-bbdf-48ccfbadb5d9	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-12 16:18:29.303542+00
724798be-29e3-4c68-86f7-1413b81c6b18	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36	2026-07-12 16:29:09.63162+00
42234131-b8ff-426c-8bfb-5ea22f955f3e	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-12 17:28:28.341424+00
bdc8e63d-73d5-4b3b-99cb-3a06a340ef30	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	::1	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36	2026-07-13 14:46:28.81197+00
1b743f27-68c0-4240-92eb-5066d0537042	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0	2026-07-13 15:23:53.993268+00
6601c871-a629-4d48-9537-548047e0ca65	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-13 17:13:38.540602+00
55dcf650-9529-4b6e-95a4-cf8478784a82	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	عمار	assistant	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-07-13 19:51:06.058627+00
980fab53-9fc3-4596-b8b5-a285eae0df10	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	عمار	assistant	login	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-07-13 20:05:09.507032+00
fee01096-2b45-49e5-b4ca-1bb7784c263f	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	عمار	assistant	logout	197.54.154.155	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-07-13 20:05:22.856319+00
3e0fedb3-b08b-4e2e-9c78-204d682875be	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.172.204	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-15 16:52:53.280791+00
05c4d5d5-5cb1-4fca-8f1e-147524d8c8d1	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.172.204	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-15 18:25:39.231302+00
d28affcc-02d9-4b7f-b2bc-41591b273f49	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.172.204	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-15 18:27:15.818733+00
bade0ec2-d272-494c-b8c3-b59b78a93500	6acccd5b-69ee-439e-86ab-dad4936ff251	محمد أحمد	admin	login	197.54.147.21	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	2026-07-15 21:20:18.272605+00
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."branches" ("id", "stage_id", "slug", "title", "description", "image", "topics", "sort_order", "created_at") FROM stdin;
64bbc31f-84db-4a92-88ff-c73dbd9b0a13	d95cbf45-9218-419b-a579-f47ee77eebc5	alg-identities	الجبر والمتطابقات	تأسيس كامل للأعداد والمتطابقات وحل المعادلات بأنواعها خطوة بخطوة.	/lectures/alg-identities.png	{"الأعداد المركّبة","المتطابقات الشهيرة","المعادلات والمتباينات","الأسس واللوغاريتمات"}	1	2026-06-26 03:16:39.338668+00
c19689bf-8367-4b3c-a923-2875611bc632	d95cbf45-9218-419b-a579-f47ee77eebc5	trigonometry	حساب المثلثات	من الزاوية والدائرة المثلثية لحد حل المثلث وقوانين الجيب وجيب التمام.	/lectures/trigonometry.png	{"الدائرة المثلثية","النسب المثلثية","قانون الجيب وجيب التمام","حل المثلث"}	2	2026-06-26 03:16:39.338668+00
73535a47-362d-4291-b346-05071374d278	d95cbf45-9218-419b-a579-f47ee77eebc5	analytic-geometry	الهندسة التحليلية	المستقيم والمنحنيات على المستوى الإحداثي بأسلوب بصري سهل.	/lectures/analytic-geometry.png	{"الإحداثيات والمسافة","ميل المستقيم","معادلة المستقيم","القطع المكافئ"}	3	2026-06-26 03:16:39.338668+00
9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367	calculus	التفاضل والتكامل	النهايات والاتصال والتفاضل والتكامل بتطبيقات حياتية تخلّيها سهلة.	/lectures/calculus.png	{"النهايات والاتصال","قواعد الاشتقاق","تطبيقات التفاضل","التكامل وحساب المساحات"}	1	2026-06-26 03:16:39.338668+00
20b47765-40b5-48bf-a6b1-a58fe2037660	47ba8d28-3fda-42bf-a9e6-9ed892379367	mechanics	الميكانيكا	القوى والاتزان والحركة بشرح مبسّط مدعوم بالرسومات والأمثلة.	/lectures/mechanics.png	{"القوى والاتزان",الاحتكاك,"الحركة في خط مستقيم","قوانين نيوتن"}	2	2026-06-26 03:16:39.338668+00
40e69d76-f782-4604-8417-92fc7c8ebe0e	47ba8d28-3fda-42bf-a9e6-9ed892379367	statistics	الإحصاء والاحتمالات	تحليل البيانات والتوزيعات والاحتمالات بطريقة عملية وواضحة.	/lectures/statistics.png	{"مقاييس النزعة المركزية",التشتت,الاحتمال,"التوزيع الطبيعي"}	3	2026-06-26 03:16:39.338668+00
6b957f3c-7076-4e76-a85e-225edc075515	35cbe80b-5e06-4787-945e-2de7f8441459	pure-math	الرياضيات البحتة	الجبر والتفاضل والتكامل المتقدّم باستعداد كامل لامتحان الثانوية.	/lectures/pure-math.png	{"الأعداد المركّبة","المحدّدات والمصفوفات","التفاضل المتقدّم","التكامل وتطبيقاته"}	1	2026-06-26 03:16:39.338668+00
91f0e6cb-0679-4598-90ac-59e8f88fdba5	35cbe80b-5e06-4787-945e-2de7f8441459	applied-math	الرياضيات التطبيقية	الاستاتيكا والديناميكا بمسائل على نمط الامتحان الفعلي.	/lectures/applied-math.png	{"الاتزان والعزوم","الأطر والقضبان","الحركة والمقذوفات","الشغل والطاقة"}	2	2026-06-26 03:16:39.338668+00
e4604d7f-c9ef-4ff8-aa8f-7e361dded7dd	35cbe80b-5e06-4787-945e-2de7f8441459	final-revision	المراجعة النهائية	مراجعة مركّزة وحل امتحانات السنوات السابقة قبل الامتحان مباشرة.	/lectures/final-revision.png	{"ملخّصات سريعة","نماذج امتحانات","أخطاء شائعة","استراتيجيات الحل"}	3	2026-06-26 03:16:39.338668+00
590c368b-7a0b-491f-a0d3-14c805937af9	47ba8d28-3fda-42bf-a9e6-9ed892379367	الاحتمالات-c6ln4	الاحتمالات	1	/lectures/alg-identities.png	{"اعد\\\\ا مركبه",نهايات}	4	2026-07-06 20:57:34.646348+00
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."calendar_events" ("id", "code", "title", "event_date", "event_time", "type", "course", "description", "custom", "created_at", "stage_id", "branch_id", "lecture_id") FROM stdin;
67f6cab2-36ed-449a-9093-ad5d392fb2c6	EVT-01	محاضرة مقدمة في البرمجة	2026-06-25	10:00	محاضرة	مقدمة في البرمجة	شرح المتغيرات وأنواع البيانات الأساسية	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
b9408f76-89c8-4689-a4b9-229660410245	EVT-02	اختبار أساسيات قواعد البيانات	2026-06-25	14:00	اختبار	قواعد البيانات العلائقية	30 سؤالًا - مدة 50 دقيقة	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
398aca0d-b632-4c8e-93dd-d41d0ec34c96	EVT-03	محاضرة تطوير الويب المتقدم	2026-06-26	12:00	محاضرة	تطوير الويب المتقدم	\N	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
6532c4e0-30de-4e0e-84ce-97ea49913af6	EVT-04	موعد تسليم مشروع UI/UX	2026-06-27	23:59	موعد تسليم	مبادئ UI/UX	تسليم النموذج الأولي عبر المنصة	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
0403bdd0-ffc6-4f5a-b08f-bc2f70dc904e	EVT-05	اجتماع فريق المحتوى	2026-06-28	09:30	اجتماع	\N	مراجعة خطة الكورسات الجديدة	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
b86e35af-cf14-4539-98eb-c8cd4d1a1414	EVT-06	محاضرة هياكل البيانات	2026-06-29	11:00	محاضرة	هياكل البيانات	\N	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
9ba5ff0a-1ed1-4e46-9780-5049740f31d0	EVT-07	اختبار لغة بايثون	2026-06-30	13:00	اختبار	البرمجة بلغة بايثون	كويز قصير 20 سؤالًا	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
09644ff4-9eb0-4654-b30e-dca1a2d5eb4c	EVT-08	محاضرة الأمن السيبراني	2026-07-02	15:00	محاضرة	مقدمة في الأمن السيبراني	\N	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
ba91d970-39a9-498c-81a0-a0afef913aca	EVT-09	موعد تسليم واجب الشبكات	2026-06-23	23:59	موعد تسليم	أساسيات الشبكات	\N	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
cf03504d-bd73-47c0-9046-c99ca4618785	EVT-10	محاضرة تعلم الآلة	2026-07-04	10:30	محاضرة	مقدمة في تعلم الآلة	\N	f	2026-06-25 23:52:22.891633+00	\N	\N	\N
171dc817-a927-4a66-ac15-db26cb6f6790	EVT-12	محاضرة	2026-08-05	10:00	محاضرة	\N	\N	t	2026-07-05 20:30:15.112235+00	\N	\N	\N
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."cart_items" ("id", "student_id", "lecture_id", "created_at", "monthly_course_id", "term_id") FROM stdin;
06993419-0c70-4879-ac03-9d96f2eeb47f	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	\N	2026-07-16 12:10:50.709462+00	13059596-1297-409d-b1ed-c7721d8114d7	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."categories" ("id", "code", "name", "description", "courses", "students", "icon", "color", "bg", "status", "created_at") FROM stdin;
bfe8d392-50e4-4341-9303-bf84dcf340b3	CAT-01	البرمجة	كورسات تطوير البرمجيات والويب والذكاء الاصطناعي	24	3280	Code2	text-primary	bg-primary/10	مفعّل	2026-06-25 23:34:52.111269+00
f8300a73-3073-4a7c-b5d6-3a7877be3765	CAT-02	التصميم	تصميم واجهات المستخدم والجرافيك والهوية البصرية	16	1940	Palette	text-pink-600	bg-pink-50 dark:bg-pink-500/10	مفعّل	2026-06-25 23:34:52.111269+00
b6535fb3-4400-4fee-a52a-20337f667493	CAT-03	التسويق	التسويق الرقمي وإدارة الحملات ووسائل التواصل	12	1520	Megaphone	text-amber-600	bg-amber-50 dark:bg-amber-500/10	مفعّل	2026-06-25 23:34:52.111269+00
5768ac62-2825-42e5-b1c5-f71bf728d5c8	CAT-04	اللغات	تعلم اللغات الأجنبية للمبتدئين والمحترفين	9	1180	Languages	text-emerald-600	bg-emerald-50 dark:bg-emerald-500/10	مفعّل	2026-06-25 23:34:52.111269+00
a5eb3aca-773b-4d94-ac77-623e3cfa9bf5	CAT-05	تحليل البيانات	تحليل البيانات وأدوات Excel ولوحات المعلومات	7	860	BarChart3	text-blue-600	bg-blue-50 dark:bg-blue-500/10	مفعّل	2026-06-25 23:34:52.111269+00
3b8c5f3c-2332-44bb-b9ff-597609db5b8b	CAT-06	الأعمال	إدارة المشاريع وريادة الأعمال والمهارات الإدارية	5	540	Briefcase	text-rose-600	bg-rose-50 dark:bg-rose-500/10	متوقف	2026-06-25 23:34:52.111269+00
\.


--
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."certificates" ("id", "student_id", "title", "issuer", "issued_at", "created_at") FROM stdin;
\.


--
-- Data for Name: coupon_lectures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."coupon_lectures" ("coupon_id", "lecture_id") FROM stdin;
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."coupons" ("id", "code", "display_code", "description", "type", "value", "used", "limit", "start_date", "end_date", "status", "created_at", "scope") FROM stdin;
d27ad092-0cc2-45a7-bfda-8f79eb59b041	SAYED	CPN-07		نسبة مئوية	50	2	2	2026-07-03	2026-07-31	نشط	2026-07-03 04:51:56.708464+00	all
\.


--
-- Data for Name: course_lessons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."course_lessons" ("id", "section_id", "title", "type", "duration", "video_url", "description", "position", "created_at") FROM stdin;
9a6c4f1d-7bc0-49e5-b818-406ec88702d1	5d92c4e9-4c35-4d62-96aa-71406807a288	الدرس 1	فيديو	10:00	\N	\N	1	2026-06-26 05:29:35.094418+00
252d0386-7c3c-4ba5-af5a-ae9086c3de3d	5d92c4e9-4c35-4d62-96aa-71406807a288	الدرس 2	فيديو	10:00	\N	\N	2	2026-06-26 05:29:35.094418+00
be9b492c-b5da-4a2c-b58c-4ad7933c8743	5d92c4e9-4c35-4d62-96aa-71406807a288	الدرس 3	فيديو	10:00	\N	\N	3	2026-06-26 05:29:35.094418+00
0e5b61d6-0807-4ba5-b35b-118ad0e3b507	5d92c4e9-4c35-4d62-96aa-71406807a288	الدرس 4	فيديو	10:00	\N	\N	4	2026-06-26 05:29:35.094418+00
b59a1faf-d401-4414-a20c-5bd2ea8ea23a	5d92c4e9-4c35-4d62-96aa-71406807a288	الدرس 5	فيديو	10:00	\N	\N	5	2026-06-26 05:29:35.094418+00
dd498d51-c109-47c2-ac7a-4b86b8eb283d	c9c7669d-b317-42ce-9407-ac889b770839	الدرس 1	فيديو	10:00	\N	\N	1	2026-06-26 05:29:35.094418+00
1af4d276-f19b-4fe5-87db-851bf6841c62	c9c7669d-b317-42ce-9407-ac889b770839	الدرس 2	فيديو	10:00	\N	\N	2	2026-06-26 05:29:35.094418+00
1a5aee61-0190-4e1a-9791-b7c88b29424b	c9c7669d-b317-42ce-9407-ac889b770839	الدرس 3	فيديو	10:00	\N	\N	3	2026-06-26 05:29:35.094418+00
8e9cfc47-2dbb-4c79-bade-e924adbbf2a4	c9c7669d-b317-42ce-9407-ac889b770839	الدرس 4	فيديو	10:00	\N	\N	4	2026-06-26 05:29:35.094418+00
cddff004-c5be-474c-bc9b-19a68165ca8e	c9c7669d-b317-42ce-9407-ac889b770839	الدرس 5	فيديو	10:00	\N	\N	5	2026-06-26 05:29:35.094418+00
d4c2e21d-8d4c-40eb-b491-1328644b6761	de015243-504d-4633-9383-15e53ffabc43	الدرس 1	فيديو	10:00	\N	\N	1	2026-06-26 05:29:35.094418+00
d38e77fe-c845-4ff8-b276-57cb1b2b1afc	de015243-504d-4633-9383-15e53ffabc43	الدرس 2	فيديو	10:00	\N	\N	2	2026-06-26 05:29:35.094418+00
83fb29a7-c370-424c-9336-cc093795afea	de015243-504d-4633-9383-15e53ffabc43	الدرس 3	فيديو	10:00	\N	\N	3	2026-06-26 05:29:35.094418+00
c4e41a47-aa48-4c6e-b40f-92c56faee33b	de015243-504d-4633-9383-15e53ffabc43	الدرس 4	فيديو	10:00	\N	\N	4	2026-06-26 05:29:35.094418+00
ca4cbdb3-31a7-4c58-9922-95a40d9b7c37	de015243-504d-4633-9383-15e53ffabc43	الدرس 5	فيديو	10:00	\N	\N	5	2026-06-26 05:29:35.094418+00
\.


--
-- Data for Name: course_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."course_sections" ("id", "course_id", "title", "position", "created_at") FROM stdin;
5d92c4e9-4c35-4d62-96aa-71406807a288	46049902-0da3-4d72-a282-a2c1de6dc285	الوحدة الأولى	0	2026-06-26 05:29:35.094418+00
c9c7669d-b317-42ce-9407-ac889b770839	93238540-c95c-4ae3-af81-b7ee116da331	الوحدة الأولى	0	2026-06-26 05:29:35.094418+00
de015243-504d-4633-9383-15e53ffabc43	f896e183-9ef9-46a4-9b4f-bec6f3ad2d71	الوحدة الأولى	0	2026-06-26 05:29:35.094418+00
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."courses" ("id", "code", "title", "instructor", "category", "level", "students", "lessons", "duration_hours", "rating", "price", "status", "image", "created_at", "image_url", "branch_id") FROM stdin;
f896e183-9ef9-46a4-9b4f-bec6f3ad2d71	CRS-202	تصميم واجهات المستخدم UI/UX	أ. منى رشاد	التصميم	متوسط	980	36	28	4.8	650 ج.م	منشور	/courses/uiux.png	2026-06-25 20:54:18.865169+00	/courses/uiux.png	9b4a46cf-530c-4946-93aa-1739359e4baa
46049902-0da3-4d72-a282-a2c1de6dc285	CRS-203	التسويق الرقمي الشامل	أ. أحمد فؤاد	التسويق	مبتدئ	760	30	22	4.6	350 ج.م	منشور	/courses/marketing.png	2026-06-25 20:54:18.865169+00	/courses/marketing.png	20b47765-40b5-48bf-a6b1-a58fe2037660
93238540-c95c-4ae3-af81-b7ee116da331	CRS-204	تعلم اللغة الإنجليزية	أ. سالي جورج	اللغات	مبتدئ	650	60	40	4.7	300 ج.م	منشور	/courses/english.png	2026-06-25 20:54:18.865169+00	/courses/english.png	40e69d76-f782-4604-8417-92fc7c8ebe0e
0fc26a54-2c88-4568-8ef3-91887cf90956	CRS-205	تحليل البيانات باستخدام Excel	م. هشام عادل	تحليل البيانات	متوسط	540	24	18	4.5	400 ج.م	منشور	/courses/excel.png	2026-06-25 20:54:18.865169+00	/courses/excel.png	9b4a46cf-530c-4946-93aa-1739359e4baa
5237857c-e76d-4b54-a363-b4a90f88bfa4	CRS-206	دليل احتراف الجافاسكريبت	م. كريم سعيد	البرمجة	متقدم	420	52	38	4.8	550 ج.م	منشور	/courses/javascript.png	2026-06-25 20:54:18.865169+00	/courses/javascript.png	20b47765-40b5-48bf-a6b1-a58fe2037660
55236f89-a35e-4abb-a206-d3515e8c826e	CRS-207	أساسيات الذكاء الاصطناعي	د. ليلى منصور	البرمجة	متقدم	310	44	34	4.9	700 ج.م	مسودة	/courses/ai.png	2026-06-25 20:54:18.865169+00	/courses/ai.png	40e69d76-f782-4604-8417-92fc7c8ebe0e
b7436924-8067-4f38-84e5-19557946bb9f	CRS-208	إدارة المشاريع الاحترافية	أ. طارق حلمي	الأعمال	متوسط	180	28	20	4.4	500 ج.م	مسودة	/courses/projects.png	2026-06-25 20:54:18.865169+00	/courses/projects.png	9b4a46cf-530c-4946-93aa-1739359e4baa
ee676292-c394-4303-8c5d-c06960645bf8	CRS-201	البرمجة باستخدام Python	م. كريم سعيد	البرمجة	مبتدئ	1250	48	32	4.9	450 ج.م	منشور	/courses/python.png	2026-06-25 20:54:18.865169+00	/courses/python.png	20b47765-40b5-48bf-a6b1-a58fe2037660
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."enrollments" ("id", "student_id", "course_id", "enrolled_at") FROM stdin;
2b1e8199-4e41-49b9-8e48-fd4f7cfe731c	625048f2-3bc5-4765-9ce8-fdf14b534ce5	46049902-0da3-4d72-a282-a2c1de6dc285	2026-06-26 05:29:35.094418+00
09a07ac1-69e0-46b8-94a6-f9131aec06cb	625048f2-3bc5-4765-9ce8-fdf14b534ce5	93238540-c95c-4ae3-af81-b7ee116da331	2026-06-26 05:29:35.094418+00
59a59227-a6c4-4e9d-a2c0-061936823e7f	625048f2-3bc5-4765-9ce8-fdf14b534ce5	f896e183-9ef9-46a4-9b4f-bec6f3ad2d71	2026-06-26 05:29:35.094418+00
\.


--
-- Data for Name: exam_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."exam_answers" ("id", "submission_id", "question_id", "answer_text", "selected_option", "file_url", "awarded_points", "is_correct", "needs_manual", "created_at") FROM stdin;
61fff246-95e1-42b6-9dbb-f1d9392b7589	76c43bd9-14c3-4728-86e8-142d775ff155	8b97c63c-ad7d-43a6-b7ad-5a8b0395287e	\N	1	\N	1	t	f	2026-07-15 18:05:04.713946+00
524550b2-8a9f-4234-8873-00913b79adcc	76c43bd9-14c3-4728-86e8-142d775ff155	d28f4f17-02a3-4ede-a414-58c37ef896ae	\N	0	\N	1	t	f	2026-07-15 18:05:04.713946+00
96820b0b-f90c-4786-8258-b92d8d699a01	e0755145-a9b0-4e39-ace5-d5e8100caa73	a07c895e-a4f2-40e7-8287-90cf1eeb6ae2	\N	1	\N	1	t	f	2026-07-15 23:33:42.221902+00
\.


--
-- Data for Name: exam_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."exam_questions" ("id", "exam_id", "question_text", "options", "correct_answer", "points", "created_at", "question_type", "content_mode", "image_url", "model_answer", "order_index") FROM stdin;
71787162-b667-4254-b440-2bdb5de154ff	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	ما هو حل المعادلة 2س + 5 = 15؟	["5", "10", "15", "20"]	5	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
ad56f963-b2ae-4da2-b859-28b7941917f8	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	إذا كانت س = 3، فما قيمة س^2 + 4؟	["7", "10", "13", "16"]	13	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
c4b07ecc-a78a-4fee-8c94-5a238dd16a47	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	في المثلث القائم، إذا كان طول الضلعين 3 و 4، فما طول الوتر؟	["5", "6", "7", "8"]	5	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
e70e7860-eefc-4cce-8840-ae2f52436622	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	ما هو ناتج تفاضل الدالة ص = 3س^2 + 2س؟	["6س + 2", "3س + 2", "6س", "س^2"]	6س + 2	3	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
9c29cac8-a94c-4969-a968-11ea87cfc23c	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	أوجد المشتقة الأولى للدالة الجيبية جا(س)	["جتا(س)", "-جا(س)", "-جتا(س)", "قا(س)"]	جتا(س)	3	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
ee52b525-5a67-4e01-a4a6-5d8b48e7f35a	94eaed01-5bfe-449a-92c7-4f9bc46ceb1d	ما هي مساحة المربع الذي طول ضلعه 5 سم؟	["20 سم مربع", "25 سم مربع", "10 سم مربع", "15 سم مربع"]	25 سم مربع	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
3a3c1a5b-e4f1-4a65-9004-9b165df8a3a1	94eaed01-5bfe-449a-92c7-4f9bc46ceb1d	قيمة الدالة اللوغاريتمية لو(100) للأساس 10 هي:	["1", "2", "10", "100"]	2	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
0eb18947-6fd0-4947-a0ee-5abb4f00c606	94eaed01-5bfe-449a-92c7-4f9bc46ceb1d	حل المتباينة س - 3 > 5 هو:	["س > 2", "س < 8", "س > 8", "س < 2"]	س > 8	2	2026-06-28 23:15:05.005459+00	mcq	text	\N	\N	0
2fe8c898-b7cd-4350-82de-ec58a881cede	1cac7cb1-4ea9-4024-b9fd-033375b82720	ما هو اسمك	\N	\N	1	2026-07-05 20:25:32.987864+00	essay	text	\N	عمار	0
8a2b9cc5-dd31-4f5d-81e4-0ad91eb9b2e5	1cac7cb1-4ea9-4024-b9fd-033375b82720	ذكر اسم المدرس	\N	\N	1	2026-07-05 20:25:32.987864+00	file	image	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/cff2ce18-69e0-4c45-9d71-2ebf7ae9f0d6.png	\N	1
bb11f0b9-7330-4f86-adf4-a452c8e2254d	1cac7cb1-4ea9-4024-b9fd-033375b82720	انا مين	["1", "2"]	1	1	2026-07-05 20:25:32.987864+00	mcq	text	\N	\N	2
8b97c63c-ad7d-43a6-b7ad-5a8b0395287e	95052c27-ecdd-48ee-8918-f37360ce8cce	1*1=	["1", "2"]	1	1	2026-07-08 08:52:03.965736+00	mcq	text	\N	\N	0
d28f4f17-02a3-4ede-a414-58c37ef896ae	95052c27-ecdd-48ee-8918-f37360ce8cce	3-3	["0", "1"]	0	1	2026-07-08 08:52:03.965736+00	mcq	text	\N	\N	1
8ed1141a-761a-472a-b92a-4399af5f90d3	eb3f39ed-bd35-4859-83c7-5dbabd2a80cc	1=1	["1", "2"]	1	1	2026-07-13 19:15:58.768156+00	mcq	text	\N	\N	0
3ca54d5d-5c90-4adc-8482-4e645667e25e	eb3f39ed-bd35-4859-83c7-5dbabd2a80cc	2+2	["0", "4"]	0	1	2026-07-13 19:15:58.768156+00	mcq	text	\N	\N	1
ba0205ae-f981-4494-aa8c-62b785c185df	eb3f39ed-bd35-4859-83c7-5dbabd2a80cc	دا	["شعار", "لوجو"]	شعار	1	2026-07-13 19:15:58.768156+00	mcq	image	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/16361129-8153-4511-a4bb-a9247e6a909a.png	\N	2
4a17247b-0e8d-4de2-bdc1-b37d720a68be	0126710b-782f-4651-82a6-2396415df8a2	عه	["ته", "ته"]	ته	1	2026-07-15 18:04:07.957501+00	mcq	text	\N	\N	0
5b5bc384-34f0-4091-8df7-a208f512cfbc	0126710b-782f-4651-82a6-2396415df8a2	تان	["ت", "تى"]	ت	1	2026-07-15 18:04:07.957501+00	mcq	text	\N	\N	1
c4d27246-6e00-4dcb-b19f-cc4e2dc20068	6b1963e4-12f2-4cc0-aaa5-e790cb93fda4	هخ	["ت", "تن"]	ت	1	2026-07-15 18:06:20.357152+00	mcq	text	\N	\N	0
a0306a27-c2ea-4671-bdbe-95436e7bb0f9	6b1963e4-12f2-4cc0-aaa5-e790cb93fda4	للاتىنة وز	\N	\N	1	2026-07-15 18:06:20.357152+00	essay	text	\N	تىةو	1
80a7aa8d-dde2-4709-85be-3827ab0d1989	c841f927-07dd-4f51-a191-4a3e90f7ee10	تاى	["اتنى", "تى"]	اتنى	1	2026-07-15 18:07:46.296139+00	mcq	text	\N	\N	0
96b6def9-abb9-405c-93be-a1175dc03028	c841f927-07dd-4f51-a191-4a3e90f7ee10	ا	\N	\N	1	2026-07-15 18:07:46.296139+00	file	image	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/3167e041-e094-4684-acba-291468e2ecd4.png	\N	1
a07c895e-a4f2-40e7-8287-90cf1eeb6ae2	631fc407-0810-48e4-a2f5-fa3e6ccda734	نمظةو	["1", "1"]	1	1	2026-07-15 20:54:24.596201+00	mcq	text	\N	\N	0
33bf7b4a-d7dc-40b6-85e6-4df41d19de9c	37510794-7399-4e81-8e31-6f715bf7b323	اتنىة	\N	\N	1	2026-07-15 22:46:40.339616+00	file	text	\N	\N	0
\.


--
-- Data for Name: exam_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."exam_submissions" ("id", "exam_id", "student_id", "score", "total", "status", "submitted_at", "grading_status", "auto_score", "manual_score") FROM stdin;
3f8a2f2b-0d5e-428f-a2e3-a2a10214ce3a	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	99571d20-0630-4bfb-bb89-4dae4ef8e5c4	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
b89c47e9-a36f-4d02-a756-0739249e9b0e	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	d9cac849-cd6b-4b3d-b0e9-0bb7a5f67e3a	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
1459dff0-babb-466f-b452-c13ee10f1fa4	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	b1f4d704-6007-4279-9900-295a693be228	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
19a04367-0571-45ce-8b3b-172473684d04	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	1474b992-b959-417f-a891-c9e221cd0744	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
fcd29a87-881f-4748-b6b0-baae0236f36b	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	be6af4e1-dd23-4962-9a1e-38371ccebedb	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
1a750a6d-bdc6-43e6-968d-37f19104cd92	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	e02798d4-8108-4451-bf78-bc125c23d351	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
88d2cde2-50a9-4270-a844-45d3d13c04e1	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	b7ac6501-4750-4144-8766-40c9e1fd2263	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
e7cf92f9-46be-4ec0-a025-9a8e8f3018c2	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	a3caa1a8-00fe-452e-96e5-b826e5353024	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
d540b361-f5e7-4b15-93b1-4c6dc1588da4	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	f5fc10fd-b136-4759-9ec7-90754626f907	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
ff78fc8a-a54e-44bb-96f6-0c4cf92802f2	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	625048f2-3bc5-4765-9ce8-fdf14b534ce5	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
ee9c9945-58f5-43c1-8dff-e351435e21c3	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	30dfe825-efa0-4329-b673-15f927348f69	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
b15db508-855a-442b-b6bb-de5fdb0cf108	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	4b49f94e-d2cd-43ad-88cf-affd409bada8	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
65d98adf-32b5-43c8-9b5b-0c5dad1af138	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	ffccb618-6637-4463-81c2-d8a97f94e63c	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
35c932c0-6b57-4b90-ae41-8ad46925c165	a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	91b2644e-b3ff-4ea8-8b10-299d2204f2f3	18	20	ناجح	2026-06-28 06:37:26.612803+00	graded	0	0
76c43bd9-14c3-4728-86e8-142d775ff155	95052c27-ecdd-48ee-8918-f37360ce8cce	806700b9-4a98-48b5-9e2a-e19ff83b2647	2	2	ناجح	2026-07-15 18:05:04.643037+00	graded	2	0
e0755145-a9b0-4e39-ace5-d5e8100caa73	631fc407-0810-48e4-a2f5-fa3e6ccda734	806700b9-4a98-48b5-9e2a-e19ff83b2647	1	1	ناجح	2026-07-15 23:33:42.15396+00	graded	1	0
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."exams" ("id", "code", "title", "course", "duration", "questions", "participants", "avg_score", "status", "created_at", "pass_mark", "description", "shuffle", "branch_id", "stage_id") FROM stdin;
95052c27-ecdd-48ee-8918-f37360ce8cce	EX-MRBUA5Z7	علي الصف الاول	11	45	2	0	0	منشور	2026-07-08 08:52:03.928514+00	50	ركز جيدا	t	\N	\N
0126710b-782f-4651-82a6-2396415df8a2	EX-MRME3384	مقدمه في البرمجه	عمار	1	2	0	0	منشور	2026-07-15 18:04:07.884261+00	50	ت	t	\N	d95cbf45-9218-419b-a579-f47ee77eebc5
6b1963e4-12f2-4cc0-aaa5-e790cb93fda4	EX-MRME5XER	منتصف الشرخ	كورس الشهر الاوول	45	2	0	0	منشور	2026-07-15 18:06:20.302132+00	50	\N	f	\N	\N
c841f927-07dd-4f51-a191-4a3e90f7ee10	EX-MRME7RQN	عاتى	عهتن	45	2	0	0	منشور	2026-07-15 18:07:46.255772+00	50	ها	f	\N	d95cbf45-9218-419b-a579-f47ee77eebc5
631fc407-0810-48e4-a2f5-fa3e6ccda734	EX-MRMK62FB	تن	ختنى	1	1	0	0	منشور	2026-07-15 20:54:24.515587+00	50	نمةو	t	\N	d95cbf45-9218-419b-a579-f47ee77eebc5
3e14495e-56c5-46cf-89de-ad63a0d924f0	EXM-2051	اختبار أساسيات البرمجة	مقدمة في البرمجة	45	25	320	78	منشور	2026-06-26 00:07:49.415955+00	50	\N	f	9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367
dffadbdd-1cbb-458b-933f-2da3038d2e63	EXM-2050	امتحان نهاية الوحدة الأولى	تطوير الويب المتقدم	60	40	215	71	منشور	2026-06-26 00:07:49.415955+00	50	\N	f	20b47765-40b5-48bf-a6b1-a58fe2037660	47ba8d28-3fda-42bf-a9e6-9ed892379367
620cb9f5-d9ab-47ef-947b-6bd00d81cba2	EXM-2049	اختبار قواعد البيانات	قواعد البيانات العلائقية	50	30	184	66	منتهي	2026-06-26 00:07:49.415955+00	50	\N	f	40e69d76-f782-4604-8417-92fc7c8ebe0e	47ba8d28-3fda-42bf-a9e6-9ed892379367
053a5cb3-4265-4dab-bfda-3da5b68edc3c	EXM-2048	كويز تصميم واجهات المستخدم	مبادئ UI/UX	20	15	142	84	منشور	2026-06-26 00:07:49.415955+00	50	\N	f	9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367
adfa1665-9d7a-42a8-8d8b-dab04ee6c02f	EXM-2047	اختبار خوارزميات وهياكل البيانات	هياكل البيانات	70	35	98	59	منتهي	2026-06-26 00:07:49.415955+00	50	\N	f	20b47765-40b5-48bf-a6b1-a58fe2037660	47ba8d28-3fda-42bf-a9e6-9ed892379367
ffafa2da-4d86-47c9-9927-101910de8115	EXM-2046	امتحان مفاهيم الشبكات	أساسيات الشبكات	45	28	0	0	مسودة	2026-06-26 00:07:49.415955+00	50	\N	f	40e69d76-f782-4604-8417-92fc7c8ebe0e	47ba8d28-3fda-42bf-a9e6-9ed892379367
c814403d-4619-4a0f-9f4d-4f1770802c0d	EXM-2045	كويز لغة بايثون	البرمجة بلغة بايثون	30	20	276	81	منشور	2026-06-26 00:07:49.415955+00	50	\N	f	9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367
7d4d706b-64b8-4883-b517-f93de80b8530	EXM-2044	اختبار الأمن السيبراني	مقدمة في الأمن السيبراني	55	32	0	0	مسودة	2026-06-26 00:07:49.415955+00	50	\N	f	20b47765-40b5-48bf-a6b1-a58fe2037660	47ba8d28-3fda-42bf-a9e6-9ed892379367
9aa6d77a-4924-42f5-99b0-6b0c148a3c2a	EXM-2043	امتحان التعلم الآلي	مقدمة في تعلم الآلة	90	45	67	62	منتهي	2026-06-26 00:07:49.415955+00	50	\N	f	40e69d76-f782-4604-8417-92fc7c8ebe0e	47ba8d28-3fda-42bf-a9e6-9ed892379367
a5b5b8e7-82cb-4edb-ba63-10f06fe2deb8	EXM-001	امتحان أساسيات البرمجة	مقدمة في البرمجة	60	20	150	85.5	منشور	2026-06-28 06:37:26.612803+00	50	\N	f	9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367
94eaed01-5bfe-449a-92c7-4f9bc46ceb1d	EXM-002	اختبار قواعد البيانات	قواعد البيانات العلائقية	45	15	120	75.0	منشور	2026-06-28 06:37:26.612803+00	50	\N	f	20b47765-40b5-48bf-a6b1-a58fe2037660	47ba8d28-3fda-42bf-a9e6-9ed892379367
1cac7cb1-4ea9-4024-b9fd-033375b82720	EX-MR88QFN4	علي الفصل الاول	تا	1	3	0	0	منشور	2026-07-05 20:25:32.914901+00	50	اوعي تغش ياض	t	9b4a46cf-530c-4946-93aa-1739359e4baa	47ba8d28-3fda-42bf-a9e6-9ed892379367
eb3f39ed-bd35-4859-83c7-5dbabd2a80cc	EX-MRJLRS5F	علي البرمجه	تست	1	3	0	0	منشور	2026-07-13 19:15:58.687849+00	50	لارتغش	t	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	d95cbf45-9218-419b-a579-f47ee77eebc5
37510794-7399-4e81-8e31-6f715bf7b323	EX-MRMO6FQN	مقدمه في البرجمه	خه	45	1	0	0	منشور	2026-07-15 22:46:40.23316+00	50	نم	f	\N	d95cbf45-9218-419b-a579-f47ee77eebc5
\.


--
-- Data for Name: learning_activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."learning_activity" ("id", "student_id", "activity_date", "minutes") FROM stdin;
3ecf0456-cbc2-4fe9-ad79-870665686bbd	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03	15
b5fd0557-d181-46cd-a6a5-83fc8f4fcd39	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07	54
323492b5-54f7-4705-a947-a8ef4f9dd871	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-09	0
90d2d198-1b86-4222-afe4-f7a5e2ac8d5b	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-12	0
c3d587ab-4a64-467a-b3a6-b6236977d0e8	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-13	0
3795541e-71c2-422e-84f5-475b25bcf59d	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-15	0
b2fb6ef7-754d-4f7b-b0a7-7555aeaa072e	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16	0
\.


--
-- Data for Name: lecture_playback_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."lecture_playback_sessions" ("user_id", "lesson_id", "sid", "updated_at") FROM stdin;
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	46dfbab9-2038-4146-ae09-3cee2a1d11d1	4db447588c50ae215401ee7263fdcb14	2026-07-05 20:15:40.638+00
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	ed4535ed-d695-4a64-b67c-272f8e610c1b	27b32eba1b9e7c360717727175bc9611	2026-07-05 20:15:44.586+00
80aeee02-e678-40f6-ace8-20a9a0b575cd	61e5b2cd-8a4e-478c-ac01-7a2823652845	d98234c97ad76d6ba2ea0a71462cb5e7	2026-07-07 13:15:42.778+00
80aeee02-e678-40f6-ace8-20a9a0b575cd	79ad4833-3a1e-455c-a832-167cdffefbde	3c89ec3ded3a0a88a7c081f4d2334b73	2026-07-07 13:15:49.031+00
80aeee02-e678-40f6-ace8-20a9a0b575cd	bad3b376-641e-4427-9749-5698a2383035	6a26e5e2c942caa8f999b7ef1524425a	2026-07-07 13:15:52.5+00
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	5c9a529f-afb2-4cb2-ba44-2be3d26f1f58	559359e62c4fbc259e2bf44771f3001a	2026-07-08 09:05:47.592+00
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	04b37bd4-b293-467f-a0a2-5048f9eeb6ab	2bd455eb3a8d0ed089a5e754d46614e3	2026-07-08 09:06:27.109+00
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	13db3541-5e7b-4e5c-b646-f60c8e13e7bd	0e601c11a4ea412452b4157cf688d31a	2026-07-08 10:24:26.063+00
8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	554ef064-3f79-4865-90d9-e8ab802a1bb7	f2bc5f3ddb19626f6901acfbc0393822	2026-07-12 13:48:38.546+00
8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	662f4c35-14fb-49ea-8622-b8041957bd33	6be2eff9fb0636dc17bc40f4c0dbc876	2026-07-12 14:29:50.248+00
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	eb5e198f-0be2-421d-b70a-8e8cb41a8385	35109a707a554ad26cf6fa18adabc35c	2026-07-13 15:46:50.778+00
9da04a2b-558b-48ba-a8c4-efcf7c5a850e	5e1dbc47-435d-446f-981e-0b5908aad20e	fc9e59c5c1695d73b98ebcbd7131bb1a	2026-07-15 18:14:18.133+00
9da04a2b-558b-48ba-a8c4-efcf7c5a850e	7a02492b-efdd-4aa5-bf17-797f66b7a916	0224ca58b98214952d5287c7b257a716	2026-07-15 22:44:23.538+00
9da04a2b-558b-48ba-a8c4-efcf7c5a850e	59802fbd-68b2-4f43-965a-6ca5af39f175	d19dca3684a308c09e1ba77943df521f	2026-07-16 20:19:14.56+00
\.


--
-- Data for Name: lectures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."lectures" ("id", "branch_id", "slug", "title", "description", "price", "old_price", "badge", "sort_order", "created_at", "image", "release_date", "instructor", "what_you_learn", "monthly_course_id", "course_sort_order", "monthly_course_section_id", "is_free") FROM stdin;
ea53043c-28e4-491f-b1df-72c0c4204c8d	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	famous-identities	المتطابقات الشهيرة	كل المتطابقات الجبرية المهمة مع تطبيقات على المسائل.	100	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
45644434-2983-473e-8f03-7b28c5fd5f75	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	equations	المعادلات والمتباينات	حل المعادلات والمتباينات بأنواعها بطريقة منظّمة وسهلة.	110	\N	\N	3	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
5ac54b83-91a7-416e-8fd4-07f7f0302c6f	c19689bf-8367-4b3c-a923-2875611bc632	trig-circle	الدائرة المثلثية والنسب	الزوايا والدائرة المثلثية والنسب المثلثية الأساسية.	130	\N	الأكثر طلبًا	1	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
c3fc1554-ff8f-450b-a41b-4074ab00dbb0	c19689bf-8367-4b3c-a923-2875611bc632	trig-laws	قوانين الجيب وحل المثلث	قانون الجيب وجيب التمام وتطبيقاتهم في حل المثلث.	120	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
998872f6-d922-485f-b1ad-0df5d674cb4f	73535a47-362d-4291-b346-05071374d278	coordinates	الإحداثيات والمستقيم	الإحداثيات والمسافة وميل ومعادلة المستقيم.	125	\N	\N	1	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
3438f9cc-5abd-41d7-997e-152d9754ab5e	73535a47-362d-4291-b346-05071374d278	parabola	القطع المكافئ	دراسة القطع المكافئ ومعادلاته وخواصه.	115	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
81ae09bb-d4e4-4e3f-9c1c-fe52cae5394a	9b4a46cf-530c-4946-93aa-1739359e4baa	derivatives	التفاضل وتطبيقاته	قواعد الاشتقاق وتطبيقات التفاضل على المسائل.	150	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
c61e4564-6a9a-4729-acfd-e5a8a62bc828	9b4a46cf-530c-4946-93aa-1739359e4baa	integration	التكامل	التكامل وحساب المساحات تحت المنحنيات.	145	\N	\N	3	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
5b12216c-1959-4551-a7a3-e8943d8bf86f	20b47765-40b5-48bf-a6b1-a58fe2037660	motion	الحركة وقوانين نيوتن	الحركة في خط مستقيم وقوانين نيوتن للحركة.	130	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
9d0cb383-eeac-4d4d-b9b7-e6c352996635	40e69d76-f782-4604-8417-92fc7c8ebe0e	descriptive	الإحصاء الوصفي	مقاييس النزعة المركزية والتشتت.	110	\N	\N	1	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
4c60e0dc-4e6a-48b5-97a0-bd88f4736767	40e69d76-f782-4604-8417-92fc7c8ebe0e	probability	الاحتمالات	الاحتمال والتوزيع الطبيعي.	120	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
faec3889-0537-4177-a48f-c750832c7840	6b957f3c-7076-4e76-a85e-225edc075515	algebra-adv	الجبر المتقدّم	الأعداد المركّبة والمحدّدات والمصفوفات بعمق.	170	\N	الأكثر طلبًا	1	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
43e59e65-75e0-40b0-a5f5-407cd17215aa	6b957f3c-7076-4e76-a85e-225edc075515	calculus-adv	التفاضل والتكامل المتقدّم	التفاضل والتكامل المتقدّم وتطبيقاته في الامتحان.	180	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
2ede3ef9-a763-497e-955b-3e0fa046fb12	91f0e6cb-0679-4598-90ac-59e8f88fdba5	dynamics	الديناميكا	الحركة والمقذوفات والشغل والطاقة.	165	\N	\N	2	2026-06-26 03:16:39.338668+00	\N	\N	\N	{}	\N	0	\N	f
c0aae293-55b5-4046-8c62-881f6eb54ede	6b957f3c-7076-4e76-a85e-225edc075515	تجربة-l1wbk	تجربة		0	\N	\N	3	2026-07-09 13:15:05.059494+00	\N	\N	\N	{}	\N	0	\N	f
237c35bf-c7a7-4190-a5d5-c8d2aecd7e91	9b4a46cf-530c-4946-93aa-1739359e4baa	الاعداد-المركبه-qt9yx	الاعداد المركبه		110	1000	\N	4	2026-07-13 15:26:55.647577+00	\N	\N	\N	{}	\N	0	\N	f
33864775-3baa-4643-b62b-55070b69e038	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	محتوي-الاسبوع-الاول-7ncfa	محتوي الاسبوع الاول		0	\N	\N	3	2026-07-15 22:57:31.532928+00	\N	\N	\N	{}	2abd18f3-737d-4e7c-b668-3ca67793e6ca	0	4a89bcc7-cc5c-4a3b-838b-9a870983663f	t
8626fbea-8ff4-426b-b3b0-117e119fdca7	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	محتوي-الاسبوع-الاول-الشه-ja08h	محتوي الاسبوع الاول الشهر الثاني		49	\N	\N	4	2026-07-15 22:57:53.94466+00	\N	\N	\N	{}	13059596-1297-409d-b1ed-c7721d8114d7	0	f39ff272-e661-4986-ba34-4eadbfa6f013	f
e76939a1-2547-46eb-9b94-f62efb2aab1e	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	521-jxett	521	2	120	\N	\N	5	2026-07-15 23:37:18.1071+00	\N	\N	\N	{}	13059596-1297-409d-b1ed-c7721d8114d7	0	8f622073-14b0-42db-8957-20078ea9d3c6	f
76282871-4927-42de-93db-eea0fa7901e6	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	خنم-jx0ow	خنم		0	\N	\N	6	2026-07-15 23:39:13.419943+00	\N	\N	\N	{}	2abd18f3-737d-4e7c-b668-3ca67793e6ca	0	4a89bcc7-cc5c-4a3b-838b-9a870983663f	t
0a104ea7-33eb-40ee-90c3-b14ec6403369	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	مك-obtnb	مك		0	\N	\N	7	2026-07-15 23:40:11.024423+00	\N	\N	\N	{}	2abd18f3-737d-4e7c-b668-3ca67793e6ca	0	6c67f102-c0d7-43f3-bf02-1ebbfd7c42b8	f
06da2ac2-86c0-4019-9265-f20a456d0b30	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	الاداد-ds2u1	الاداد		119	\N	\N	8	2026-07-16 12:10:14.509647+00	\N	\N	\N	{}	13059596-1297-409d-b1ed-c7721d8114d7	0	8f622073-14b0-42db-8957-20078ea9d3c6	f
\.


--
-- Data for Name: lesson_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."lesson_progress" ("id", "enrollment_id", "lesson_id", "completed", "completed_at") FROM stdin;
c534b24f-0c3f-4704-b0af-923bc32043f6	2b1e8199-4e41-49b9-8e48-fd4f7cfe731c	9a6c4f1d-7bc0-49e5-b818-406ec88702d1	t	2026-06-26 05:29:35.094418+00
a2761368-553b-4165-95bb-7de985f636d1	09a07ac1-69e0-46b8-94a6-f9131aec06cb	dd498d51-c109-47c2-ac7a-4b86b8eb283d	t	2026-06-26 05:29:35.094418+00
2a706ec3-ffbd-45ab-ad64-5df1de9acb86	09a07ac1-69e0-46b8-94a6-f9131aec06cb	1af4d276-f19b-4fe5-87db-851bf6841c62	t	2026-06-26 05:29:35.094418+00
7a774042-e583-4ef8-9f1a-dac5b78cf6ae	59a59227-a6c4-4e9d-a2c0-061936823e7f	d4c2e21d-8d4c-40eb-b491-1328644b6761	t	2026-06-26 05:29:35.094418+00
55affe34-3e68-486a-af90-21b29e3175f5	59a59227-a6c4-4e9d-a2c0-061936823e7f	d38e77fe-c845-4ff8-b276-57cb1b2b1afc	t	2026-06-26 05:29:35.094418+00
e9c7dcb3-0149-478a-be96-d900e33f79eb	59a59227-a6c4-4e9d-a2c0-061936823e7f	83fb29a7-c370-424c-9336-cc093795afea	t	2026-06-26 05:29:35.094418+00
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."lessons" ("id", "lecture_id", "slug", "title", "duration", "is_free", "sort_order", "created_at", "video_url", "description", "content_type", "attachments", "video_id") FROM stdin;
0fdc6f9e-c6fc-4f3f-983f-7a3fa6b19d1b	2ede3ef9-a763-497e-955b-3e0fa046fb12	l1	الحركة والمقذوفات	19:00	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «الحركة والمقذوفات» من محاضرة «الديناميكا» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
dc0ab51b-f193-4168-9429-2d04755bf7d0	2ede3ef9-a763-497e-955b-3e0fa046fb12	l2	الشغل والطاقة	17:15	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «الشغل والطاقة» من محاضرة «الديناميكا» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
54029f1e-04f5-40cc-9694-005279a8d532	3438f9cc-5abd-41d7-997e-152d9754ab5e	l1	تعريف القطع المكافئ	13:10	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «تعريف القطع المكافئ» من محاضرة «القطع المكافئ» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
76be6cb8-994e-4c81-b6ef-451365f6eaea	3438f9cc-5abd-41d7-997e-152d9754ab5e	l2	معادلة القطع المكافئ	16:00	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «معادلة القطع المكافئ» من محاضرة «القطع المكافئ» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
cd7ddd21-e593-45ad-916f-7413c296a993	43e59e65-75e0-40b0-a5f5-407cd17215aa	l1	التفاضل المتقدّم	20:00	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «التفاضل المتقدّم» من محاضرة «التفاضل والتكامل المتقدّم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
43d4334f-915c-42f8-92f3-2c279e1c026d	43e59e65-75e0-40b0-a5f5-407cd17215aa	l2	التكامل وتطبيقاته	21:30	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «التكامل وتطبيقاته» من محاضرة «التفاضل والتكامل المتقدّم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
cb9dd05a-cf70-4b9e-a820-fa6cfaaadfd6	45644434-2983-473e-8f03-7b28c5fd5f75	l1	المعادلات التربيعية	17:20	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «المعادلات التربيعية» من محاضرة «المعادلات والمتباينات» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
1f9a6ae9-1259-4586-80fc-64f0cd9b0ff5	45644434-2983-473e-8f03-7b28c5fd5f75	l2	المتباينات	13:15	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «المتباينات» من محاضرة «المعادلات والمتباينات» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
4aa685ff-d9e5-4c73-ad7c-da8bc0c667ba	45644434-2983-473e-8f03-7b28c5fd5f75	l3	الأسس واللوغاريتمات	18:40	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «الأسس واللوغاريتمات» من محاضرة «المعادلات والمتباينات» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
ec1519c6-fae0-4d9a-85b9-77f1f4c07c33	4c60e0dc-4e6a-48b5-97a0-bd88f4736767	l1	مبادئ الاحتمال	15:20	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «مبادئ الاحتمال» من محاضرة «الاحتمالات» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
b54464ea-a70f-42ed-a5c0-d6008298fa6f	4c60e0dc-4e6a-48b5-97a0-bd88f4736767	l2	التوزيع الطبيعي	16:50	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «التوزيع الطبيعي» من محاضرة «الاحتمالات» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
59802fbd-68b2-4f43-965a-6ca5af39f175	33864775-3baa-4643-b62b-55070b69e038	الشرح-59162	الشرح	0:09	f	1	2026-07-15 22:59:08.686825+00	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/videos/5bc854b2-a4b6-4493-8449-3d1e099eedbf.mp4	\N	فيديو	[{"url": "https://utfs.io/f/NiVV1ZmO5wIEw8A5qFhHfyjmqgJC9Zovp4DAtQO2Flux1kaW", "name": "Acadia_Medical_Product_Catalog_Print_Quality.pdf", "type": "pdf"}]	\N
6951a2f3-4947-47af-9340-2889b3194329	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	l1	قياس الزوايا	12:00	t	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «قياس الزوايا» من محاضرة «الدائرة المثلثية والنسب» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
02275ca8-2387-4ddd-9e66-aa3ccc72e0b1	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	l2	الدائرة المثلثية	15:30	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «الدائرة المثلثية» من محاضرة «الدائرة المثلثية والنسب» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
29466576-c51e-4f47-917a-9a0b21185eb2	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	l3	النسب المثلثية	14:10	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «النسب المثلثية» من محاضرة «الدائرة المثلثية والنسب» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
db1a9916-c753-4a2e-8cd4-4b48ebc0ca25	5b12216c-1959-4551-a7a3-e8943d8bf86f	l1	الحركة في خط مستقيم	17:00	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «الحركة في خط مستقيم» من محاضرة «الحركة وقوانين نيوتن» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
d10585c6-ba1a-4a63-82a7-4b77a38ba12a	5b12216c-1959-4551-a7a3-e8943d8bf86f	l2	قوانين نيوتن	18:30	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «قوانين نيوتن» من محاضرة «الحركة وقوانين نيوتن» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
63a53059-dd16-488b-a00a-4fb8bb81822e	81ae09bb-d4e4-4e3f-9c1c-fe52cae5394a	l1	قواعد الاشتقاق	18:10	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «قواعد الاشتقاق» من محاضرة «التفاضل وتطبيقاته» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
30911b8c-1c16-4c62-8ba7-1685e1ab8671	81ae09bb-d4e4-4e3f-9c1c-fe52cae5394a	l2	اشتقاق الدوال المثلثية	16:40	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «اشتقاق الدوال المثلثية» من محاضرة «التفاضل وتطبيقاته» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
7923de25-aeb4-41f8-8ce1-a3602974ef62	81ae09bb-d4e4-4e3f-9c1c-fe52cae5394a	l3	تطبيقات التفاضل	19:25	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «تطبيقات التفاضل» من محاضرة «التفاضل وتطبيقاته» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
c64c360b-ea38-47ab-af12-cd2b8ff6903c	998872f6-d922-485f-b1ad-0df5d674cb4f	l1	الإحداثيات والمسافة	11:40	t	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «الإحداثيات والمسافة» من محاضرة «الإحداثيات والمستقيم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
99ea9c22-b547-42a7-a74a-b12f09c12a6d	998872f6-d922-485f-b1ad-0df5d674cb4f	l2	ميل المستقيم	12:50	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «ميل المستقيم» من محاضرة «الإحداثيات والمستقيم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
d7d4503c-0ff9-449a-b5b1-05d819633c3a	998872f6-d922-485f-b1ad-0df5d674cb4f	l3	معادلة المستقيم	15:20	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «معادلة المستقيم» من محاضرة «الإحداثيات والمستقيم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
2bdd2d30-0534-4c0b-9324-72f1cb5b2515	8626fbea-8ff4-426b-b3b0-117e119fdca7	تست-49xkj	تست		t	1	2026-07-15 22:59:51.960789+00	https://www.youtube.com/watch?v=X0dXd5mVUug&list=RDe1vMJAFHdTo&index=3	\N	فيديو	[]	\N
f327852b-55d9-4362-a4eb-b0963a49a923	9d0cb383-eeac-4d4d-b9b7-e6c352996635	l2	مقاييس التشتت	14:45	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «مقاييس التشتت» من محاضرة «الإحصاء الوصفي» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
d8201976-d152-4a9d-8203-d52c9a2323bd	c3fc1554-ff8f-450b-a41b-4074ab00dbb0	l1	قانون الجيب	13:25	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «قانون الجيب» من محاضرة «قوانين الجيب وحل المثلث» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
36692039-f630-4f9c-bb75-2b806de6a9c8	c3fc1554-ff8f-450b-a41b-4074ab00dbb0	l2	قانون جيب التمام	14:55	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «قانون جيب التمام» من محاضرة «قوانين الجيب وحل المثلث» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
93281aa1-86a8-4340-a0b4-9f06db627df3	c3fc1554-ff8f-450b-a41b-4074ab00dbb0	l3	حل المثلث	16:30	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «حل المثلث» من محاضرة «قوانين الجيب وحل المثلث» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
3632e0af-c9c5-47a3-96f2-42614ed2db0e	c61e4564-6a9a-4729-acfd-e5a8a62bc828	l1	التكامل غير المحدود	16:15	f	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «التكامل غير المحدود» من محاضرة «التكامل» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
fadbc7ee-e3e3-4cd5-ba26-dc5d415d8141	c61e4564-6a9a-4729-acfd-e5a8a62bc828	l2	التكامل المحدود	17:50	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «التكامل المحدود» من محاضرة «التكامل» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
8bc7a2f9-7177-4bbc-8278-f7a1ecf4fac4	c61e4564-6a9a-4729-acfd-e5a8a62bc828	l3	حساب المساحات	15:30	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «حساب المساحات» من محاضرة «التكامل» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
a03ef127-4517-401f-a950-e11812e7c24d	ea53043c-28e4-491f-b1df-72c0c4204c8d	l1	مربع ومكعب ذات الحدين	12:10	t	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «مربع ومكعب ذات الحدين» من محاضرة «المتطابقات الشهيرة» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
ea4e5570-721d-4bd5-b3fe-f8e22800a529	ea53043c-28e4-491f-b1df-72c0c4204c8d	l2	الفرق بين مربعين ومكعبين	10:35	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «الفرق بين مربعين ومكعبين» من محاضرة «المتطابقات الشهيرة» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
6ae86290-d725-4b9d-aee2-8cb1d0cfa5e4	ea53043c-28e4-491f-b1df-72c0c4204c8d	l3	تطبيقات على المتطابقات	15:50	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «تطبيقات على المتطابقات» من محاضرة «المتطابقات الشهيرة» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
61e5b2cd-8a4e-478c-ac01-7a2823652845	faec3889-0537-4177-a48f-c750832c7840	l1	الأعداد المركّبة	18:00	t	1	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4	في درس «الأعداد المركّبة» من محاضرة «الجبر المتقدّم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
9a41470f-7c71-4c14-b672-672a21712a27	e76939a1-2547-46eb-9b94-f62efb2aab1e	دجكم-dmwd6	دجكم		f	1	2026-07-15 23:38:20.472427+00	https://www.youtube.com/watch?v=X0dXd5mVUug&list=RDe1vMJAFHdTo&index=3	\N	فيديو	[]	\N
667b1314-aacd-472f-80ef-5430ca0a0768	9d0cb383-eeac-4d4d-b9b7-e6c352996635	l1	النزعة المركزية	1:57	t	1	2026-06-26 03:16:39.338668+00	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/videos/ee5e2627-9f0b-4947-8788-5692129aa390.mp4	في درس «النزعة المركزية» من محاضرة «الإحصاء الوصفي» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
79ad4833-3a1e-455c-a832-167cdffefbde	faec3889-0537-4177-a48f-c750832c7840	l2	المحدّدات	16:30	f	2	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4	في درس «المحدّدات» من محاضرة «الجبر المتقدّم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
bad3b376-641e-4427-9749-5698a2383035	faec3889-0537-4177-a48f-c750832c7840	l3	المصفوفات	19:10	f	3	2026-06-26 03:16:39.338668+00	https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4	في درس «المصفوفات» من محاضرة «الجبر المتقدّم» نشرح الفكرة من الأساس خطوة بخطوة، مع أمثلة محلولة وتطبيقات على نماذج الامتحانات، وتلخيص لأهم النقاط في نهاية الدرس.	فيديو	[]	\N
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."messages" ("id", "code", "sender_name", "sender_avatar", "subject", "content", "time_label", "is_read", "has_attachment", "sender_role", "course", "unread_count", "is_online", "chat_history", "created_at", "student_id", "status", "student_unread") FROM stdin;
ca044cf2-795f-4498-8118-9c0adeb626fe	ticket-80aeee02-mrao404o	ahmed ashraf	\N	هاي	هههه	الآن	t	f	student		0	f	[{"id": "m1783429892520", "text": "هههه", "time": "الآن", "fromMe": false}]	2026-07-07 13:11:32.559763+00	80aeee02-e678-40f6-ace8-20a9a0b575cd	closed	0
a442939a-9254-4208-a119-acaa2f62a7a3	ticket-83eaa8dc-mrbuf7zr	عمار ابراهيم	\N	السلتم عليكم	محتاج استفسر	الآن	t	f	student		0	f	[{"id": "m1783500959799", "text": "محتاج استفسر", "time": "الآن", "fromMe": false}]	2026-07-08 08:55:59.819323+00	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	closed	0
e6614b7b-083f-4fdf-9b0d-610416c5a1d6	ticket-83eaa8dc-mr88017u	عمار ابراهيم	\N	hajvh;	الحمد لله	٨ يوليو في ٠٨:٥٤ ص	t	f	student		0	f	[{"id": "m1783281901098", "text": "ulv", "time": "الآن", "fromMe": false}, {"id": "m1783281911621", "text": "kul", "time": "الآن", "fromMe": true}, {"id": "m1783500879564", "text": "الحمد لله", "time": "الآن", "fromMe": true}]	2026-07-05 20:05:01.135705+00	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	open	0
7f9e590d-af54-4523-8f68-8414576b6c26	MSG-ADMIN-1783969900107	عمار ابراهيم	\N	تست	عهتن	١٣ يوليو في ٠٧:١١ م	t	f	أدمن		0	f	[{"id": "m1783969900107", "text": "عهتن", "time": "الآن", "fromMe": true}]	2026-07-13 19:11:40.136545+00	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	open	0
\.


--
-- Data for Name: monthly_course_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."monthly_course_sections" ("id", "monthly_course_id", "title", "sort_order", "created_at") FROM stdin;
4a89bcc7-cc5c-4a3b-838b-9a870983663f	2abd18f3-737d-4e7c-b668-3ca67793e6ca	الاسبوع الاول	1	2026-07-15 22:56:19.410012+00
6c67f102-c0d7-43f3-bf02-1ebbfd7c42b8	2abd18f3-737d-4e7c-b668-3ca67793e6ca	الاسبوع الثاني	2	2026-07-15 22:56:24.985582+00
f39ff272-e661-4986-ba34-4eadbfa6f013	13059596-1297-409d-b1ed-c7721d8114d7	الاسبوع الاول	1	2026-07-15 22:57:01.240503+00
8f622073-14b0-42db-8957-20078ea9d3c6	13059596-1297-409d-b1ed-c7721d8114d7	الاسبوع الثني	2	2026-07-15 22:57:07.508517+00
\.


--
-- Data for Name: monthly_courses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."monthly_courses" ("id", "branch_id", "slug", "title", "description", "image", "price", "old_price", "badge", "is_published", "sort_order", "created_at", "updated_at", "term_id") FROM stdin;
2abd18f3-737d-4e7c-b668-3ca67793e6ca	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	كورس-الشهر-الاول-228sd	كورس الشهر الاول		https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/ca4289b2-84e2-44bb-b24b-d7ba1440affc.png	0	\N	\N	t	1	2026-07-15 22:56:09.848809+00	2026-07-15 22:56:09.848809+00	\N
13059596-1297-409d-b1ed-c7721d8114d7	64bbc31f-84db-4a92-88ff-c73dbd9b0a13	كورس-الشهر-الثاني-3if7r	كورس الشهر الثاني		https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/8b84b508-8404-47b0-bd4f-f83f8c2fa842.jpg	200	500	\N	t	2	2026-07-15 22:56:45.829341+00	2026-07-15 23:00:02.426+00	\N
\.


--
-- Data for Name: notification_reads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."notification_reads" ("notification_id", "student_id", "read_at") FROM stdin;
1b92a132-9814-41a2-a489-5063416b7bfb	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
ca3ef8fa-11c9-46a1-b3e6-03ddae52f515	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
b74d4361-bb05-46a6-9836-255f9841968c	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
ad3061fe-78f3-438b-9efb-43e015ff6270	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
826e8b98-cb76-49b1-acbc-f07788810df3	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
ebdaa8ed-ecda-411c-9997-eb6948d581eb	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
4381c724-358d-4eeb-af06-66525e3aebf1	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
cbe67bad-a562-46f2-ba22-16298429712e	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
5c68d36e-afef-45f4-972d-dd64a90d528c	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
63bdbd6f-a17d-4acb-8032-9fdd2fe2ba5d	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
346fb491-602e-4ec0-a37a-d6285b89e37d	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
99a7ecd7-ee77-47a1-80d2-4fec16431ecf	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
eca45d10-2d93-4c8b-8528-6f7f093f5444	ffccb618-6637-4463-81c2-d8a97f94e63c	2026-07-03 06:39:00.27793+00
5a1cffd6-e101-45ab-8cf0-9d721948a255	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
1b92a132-9814-41a2-a489-5063416b7bfb	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
b74d4361-bb05-46a6-9836-255f9841968c	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
ad3061fe-78f3-438b-9efb-43e015ff6270	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
826e8b98-cb76-49b1-acbc-f07788810df3	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
ebdaa8ed-ecda-411c-9997-eb6948d581eb	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
eca45d10-2d93-4c8b-8528-6f7f093f5444	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
4381c724-358d-4eeb-af06-66525e3aebf1	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
5c68d36e-afef-45f4-972d-dd64a90d528c	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
63bdbd6f-a17d-4acb-8032-9fdd2fe2ba5d	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
346fb491-602e-4ec0-a37a-d6285b89e37d	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
99a7ecd7-ee77-47a1-80d2-4fec16431ecf	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
cbe67bad-a562-46f2-ba22-16298429712e	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
ca3ef8fa-11c9-46a1-b3e6-03ddae52f515	d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	2026-07-07 13:02:43.586446+00
4ac2e066-8c06-44fc-b525-89e6c8cf2e94	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
b2d1c48b-ecbb-4e1c-8cea-96806e4a15a7	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
9a1a6100-5266-4329-aa00-d19dc6cf9048	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
54c33de2-865a-448a-929d-51befbb183eb	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
e5e5808b-4518-4dc0-b904-92a6d04bfa56	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
683983ea-06fd-49f7-a917-145f1f3a59c9	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
67d94779-94fd-495c-88b4-7b6c450eba86	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
a46c8886-3332-410b-80e7-e49169ec7ec1	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
412d2d48-ed18-42e8-97f5-20ca37fb84bf	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
057ea924-e289-4cb0-a9a4-1073d235112d	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
e543263f-87e8-4423-93a4-394d062c285d	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
c16340d9-ea40-4d32-8ae6-b3827abc18b1	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
7aa578a7-cfcc-4ee5-bbff-b8fed050bdec	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
aa3dd5ea-8484-4b31-b583-37763d4befbc	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
e92f8b94-6d5d-4617-8f38-9accaf3121ad	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
9a202bf2-295f-46ec-aab8-2ed2bc6da6e0	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
8e959cb9-56fc-4356-9c6c-5226846f3c5c	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
1d9cc0b3-e75a-45d1-8068-51145db1e868	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
637af6be-f496-4ae4-9a9a-c3790676471a	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
5a1cffd6-e101-45ab-8cf0-9d721948a255	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
1b92a132-9814-41a2-a489-5063416b7bfb	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
63bdbd6f-a17d-4acb-8032-9fdd2fe2ba5d	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
5c68d36e-afef-45f4-972d-dd64a90d528c	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
cbe67bad-a562-46f2-ba22-16298429712e	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
eca45d10-2d93-4c8b-8528-6f7f093f5444	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
ebdaa8ed-ecda-411c-9997-eb6948d581eb	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
826e8b98-cb76-49b1-acbc-f07788810df3	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
ad3061fe-78f3-438b-9efb-43e015ff6270	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
b74d4361-bb05-46a6-9836-255f9841968c	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
4381c724-358d-4eeb-af06-66525e3aebf1	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
ca3ef8fa-11c9-46a1-b3e6-03ddae52f515	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
99a7ecd7-ee77-47a1-80d2-4fec16431ecf	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
346fb491-602e-4ec0-a37a-d6285b89e37d	806700b9-4a98-48b5-9e2a-e19ff83b2647	2026-07-16 00:07:40.163443+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."notifications" ("id", "code", "type", "title", "description", "read", "time_label", "created_at", "student_id", "grade", "stage_id", "branch_id", "lecture_id") FROM stdin;
4381c724-358d-4eeb-af06-66525e3aebf1	NOTI-2047	كورس	كورس وصل للحد الأقصى	كورس "تصميم واجهات المستخدم" وصل إلى 200 طالب مسجّل.	t	منذ 4 ساعات	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
ca3ef8fa-11c9-46a1-b3e6-03ddae52f515	NOTI-2046	دفع	فشل في عملية دفع	لم تكتمل عملية الدفع الخاصة بـ سارة محمود بسبب رفض البطاقة.	t	منذ 6 ساعات	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
b74d4361-bb05-46a6-9836-255f9841968c	NOTI-2045	نظام	تحديث للنظام	تم تحديث المنصة إلى الإصدار 2.4.0 مع تحسينات في الأداء.	t	أمس	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
ad3061fe-78f3-438b-9efb-43e015ff6270	NOTI-2044	طالب	طالب أكمل كورسًا	أكملت ليلى حسن كورس "مقدمة في الذكاء الاصطناعي" وحصلت على الشهادة.	t	أمس	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
826e8b98-cb76-49b1-acbc-f07788810df3	NOTI-2043	اختبار	تم نشر اختبار جديد	تم نشر اختبار "هياكل البيانات المتقدمة" وأصبح متاحًا للطلاب.	t	منذ يومين	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
ebdaa8ed-ecda-411c-9997-eb6948d581eb	NOTI-2042	رسالة	رد على تذكرة دعم	تم الرد على تذكرة الدعم رقم #1284 الخاصة بمشكلة تسجيل الدخول.	t	منذ يومين	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
eca45d10-2d93-4c8b-8528-6f7f093f5444	NOTI-2041	كورس	مراجعة جديدة على كورس	حصل كورس "تطوير تطبيقات الموبايل" على تقييم 5 نجوم من طالب.	t	منذ 3 أيام	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
cbe67bad-a562-46f2-ba22-16298429712e	NOTI-2040	نظام	نسخة احتياطية مكتملة	تم إنشاء نسخة احتياطية كاملة لبيانات المنصة بنجاح.	t	منذ 3 أيام	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
5c68d36e-afef-45f4-972d-dd64a90d528c	NOTI-2051	طالب	طالب جديد انضم للمنصة	محمد إبراهيم سجّل حسابًا جديدًا واشترك في كورس أساسيات البرمجة.	t	منذ 5 دقائق	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
63bdbd6f-a17d-4acb-8032-9fdd2fe2ba5d	NOTI-2050	دفع	تم استلام دفعة جديدة	دفعة بقيمة 1,200 ج.م من فاطمة الزهراء مقابل كورس تطوير الويب.	t	منذ 22 دقيقة	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
346fb491-602e-4ec0-a37a-d6285b89e37d	NOTI-2049	اختبار	تم إنهاء اختبار	أنهى 48 طالبًا اختبار "أساسيات JavaScript" بمتوسط درجات 76%.	t	منذ ساعة	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
99a7ecd7-ee77-47a1-80d2-4fec16431ecf	NOTI-2048	رسالة	رسالة جديدة من طالب	أرسل أحمد سمير استفسارًا حول موعد بدء كورس قواعد البيانات.	t	منذ ساعتين	2026-06-25 23:54:39.394561+00	\N	\N	\N	\N	\N
1b92a132-9814-41a2-a489-5063416b7bfb	NTF-bldzw2	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "اعداد". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-06-30 06:55:23.965838+00	\N	sec-1	\N	\N	\N
5a1cffd6-e101-45ab-8cf0-9d721948a255	NTF-cm2zuf	نظام	موعد جديد: محاضرة	2026-08-05 - 10:00	t	الآن	2026-07-05 20:30:15.166587+00	\N	\N	\N	\N	\N
637af6be-f496-4ae4-9a9a-c3790676471a	NTF-pmu5wp	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "تست". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-08 09:08:28.3237+00	\N	sec-2	\N	\N	\N
e543263f-87e8-4423-93a4-394d062c285d	NTF-gs74ns	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاعداد". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 19:39:34.043172+00	\N	sec-1	\N	\N	\N
1d9cc0b3-e75a-45d1-8068-51145db1e868	NTF-z8kaid	طالب	اجازة الاسبوع القادم	00	t	الآن	2026-07-08 12:29:18.178734+00	\N	\N	\N	\N	\N
8e959cb9-56fc-4356-9c6c-5226846f3c5c	NTF-bt82h9	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "تجربة". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-09 13:15:05.55489+00	\N	sec-3	\N	\N	\N
9a202bf2-295f-46ec-aab8-2ed2bc6da6e0	NTF-5p07im	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاعداد المركبه". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 15:26:55.849505+00	\N	sec-2	\N	\N	\N
e92f8b94-6d5d-4617-8f38-9accaf3121ad	NTF-n3g1q3	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاسبوع الثاني". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 15:29:29.677323+00	\N	sec-2	\N	\N	\N
aa3dd5ea-8484-4b31-b583-37763d4befbc	NTF-u5vorj	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاعدا المركبه". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 15:41:07.246968+00	\N	sec-2	\N	\N	\N
7aa578a7-cfcc-4ee5-bbff-b8fed050bdec	NTF-64or8l	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاعداد المركبه". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 19:24:41.684536+00	\N	sec-1	\N	\N	\N
c16340d9-ea40-4d32-8ae6-b3827abc18b1	NTF-z8458b	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "ulhv". تقدر تشوفها في صفحة تصفّح المحاضرات.	t	الآن	2026-07-13 19:34:25.480569+00	\N	sec-1	\N	\N	\N
057ea924-e289-4cb0-a9a4-1073d235112d	NTF-t7qmnb	طالب	هخنم	9حخنم	f	الآن	2026-07-13 19:46:07.148224+00	\N	\N	\N	\N	\N
412d2d48-ed18-42e8-97f5-20ca37fb84bf	NOTIF-1784138517320	رسالة	كم	نم	f	١٥ يوليو في ٠٦:٠١ م	2026-07-15 18:01:57.362376+00	806700b9-4a98-48b5-9e2a-e19ff83b2647	\N	\N	\N	\N
a46c8886-3332-410b-80e7-e49169ec7ec1	NTF-y5kvrn	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاعداد المركبه". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 18:11:29.894114+00	\N	sec-1	\N	\N	\N
67d94779-94fd-495c-88b4-7b6c450eba86	NTF-alhjs3	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "5". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 18:17:53.823678+00	\N	sec-1	\N	\N	\N
683983ea-06fd-49f7-a917-145f1f3a59c9	NTF-j63cr4	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الالو". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 18:19:37.408739+00	\N	sec-1	\N	\N	\N
e5e5808b-4518-4dc0-b904-92a6d04bfa56	NTF-qzf5o9	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "محتوي الاسبوع الاول". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 22:57:31.633337+00	\N	sec-1	\N	\N	\N
54c33de2-865a-448a-929d-51befbb183eb	NTF-4kxk69	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "محتوي الاسبوع الاول الشهر الثاني". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 22:57:54.942079+00	\N	sec-1	\N	\N	\N
9a1a6100-5266-4329-aa00-d19dc6cf9048	NTF-2c8uo8	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "521". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 23:37:18.215572+00	\N	sec-1	\N	\N	\N
b2d1c48b-ecbb-4e1c-8cea-96806e4a15a7	NTF-ek70mj	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "خنم". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 23:39:13.515569+00	\N	sec-1	\N	\N	\N
4ac2e066-8c06-44fc-b525-89e6c8cf2e94	NTF-ffqnjq	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "مك". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-15 23:40:11.111411+00	\N	sec-1	\N	\N	\N
537c5848-3348-498e-ad93-04bfcd5cbd40	NTF-l00vsb	كورس	محاضرة جديدة متاحة	تمت إضافة محاضرة "الاداد". تقدر تشوفها في صفحة تصفّح المحاضرات.	f	الآن	2026-07-16 12:10:14.629591+00	\N	sec-1	\N	\N	\N
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."order_items" ("id", "order_id", "lecture_id", "lecture_title", "branch_title", "stage_title", "price", "monthly_course_id", "item_type", "term_id") FROM stdin;
fd094cc4-2126-4d3d-bfe7-774a1a605f2a	001328cb-24bd-4a33-9d28-de6584607b63	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	الدائرة المثلثية والنسب	حساب المثلثات	الصف الأول الثانوي	130	\N	lecture	\N
98683efa-71ac-417e-9930-9e09b6b5c20b	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	ea53043c-28e4-491f-b1df-72c0c4204c8d	المتطابقات الشهيرة	الجبر والمتطابقات	الصف الأول الثانوي	100	\N	lecture	\N
d0c20941-3f32-4150-a43c-9ff85578d645	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	45644434-2983-473e-8f03-7b28c5fd5f75	المعادلات والمتباينات	الجبر والمتطابقات	الصف الأول الثانوي	110	\N	lecture	\N
81c118a7-8d8c-4334-859b-1d61fa91dcec	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	5ac54b83-91a7-416e-8fd4-07f7f0302c6f	الدائرة المثلثية والنسب	حساب المثلثات	الصف الأول الثانوي	130	\N	lecture	\N
607a946d-a82b-483c-b760-815fb179ed8c	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	c3fc1554-ff8f-450b-a41b-4074ab00dbb0	قوانين الجيب وحل المثلث	حساب المثلثات	الصف الأول الثانوي	120	\N	lecture	\N
f3e6fd36-1827-4a6d-a0ab-30046d077a87	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	998872f6-d922-485f-b1ad-0df5d674cb4f	الإحداثيات والمستقيم	الهندسة التحليلية	الصف الأول الثانوي	125	\N	lecture	\N
7c5e3b17-a69c-403f-8568-8f3924f00f23	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	3438f9cc-5abd-41d7-997e-152d9754ab5e	القطع المكافئ	الهندسة التحليلية	الصف الأول الثانوي	115	\N	lecture	\N
1d251746-bf98-4eba-ac8f-15037430cc1a	2d66e35b-010e-4002-aa09-84af27eba78a	faec3889-0537-4177-a48f-c750832c7840	الجبر المتقدّم	الرياضيات البحتة	الصف الثالث الثانوي	170	\N	lecture	\N
2ee0b8f8-ffc6-4d3d-ab1b-1a655d7dab5a	2423b8fb-6ab4-4ad6-aaa7-65dfc9c8539d	\N	تست	التفاضل والتكامل	الصف الثاني الثانوي	0	\N	lecture	\N
b74a78ed-57fb-43ed-94a9-51a4087212c8	e308fcf3-d050-493a-b110-4f09c694b015	c0aae293-55b5-4046-8c62-881f6eb54ede	تجربة	الرياضيات البحتة	الصف الثالث الثانوي	0	\N	lecture	\N
6f7fb2e9-d8da-4285-a5d6-db545f3e04d0	2e1fb2f9-1ab2-42ee-93bb-22741f19f5cc	\N	تست	التفاضل والتكامل	الصف الثاني الثانوي	0	\N	course_bundle	\N
fa41a349-8392-41df-adb8-2f4de9b9bb2d	26dd8ee1-1b80-4789-9c27-0ab0712b0693	\N	القوى والاتزان	الميكانيكا	الصف الثاني الثانوي	135	\N	lecture	\N
38d09a1d-9a0d-4cd3-b8a4-e2887fabab5b	001328cb-24bd-4a33-9d28-de6584607b63	\N	الأعداد المركّبة	الجبر والمتطابقات	الصف الأول الثانوي	120	\N	lecture	\N
ee9d16ce-ddf5-4606-a788-2d40fa8cd200	0c2f6164-086c-4d88-ab16-1122eeb1a2cf	\N	الأعداد المركّبة	الجبر والمتطابقات	الصف الأول الثانوي	120	\N	lecture	\N
b40b7acd-3f9c-4292-8125-d6832f3c59e5	49aeb3f8-0b2f-48f7-8383-66d15447f29f	\N	الأعداد المركّبة	الجبر والمتطابقات	الصف الأول الثانوي	120	\N	lecture	\N
79d13701-887d-46ef-8b62-21aec567a8f2	001328cb-24bd-4a33-9d28-de6584607b63	\N	النهايات والاتصال	التفاضل والتكامل	الصف الثاني الثانوي	140	\N	lecture	\N
4ff96cb9-0c7c-4645-b400-14d256e9d7f2	c3de0f44-807f-4ada-82cc-f94c35079531	\N	النهايات والاتصال	التفاضل والتكامل	الصف الثاني الثانوي	140	\N	lecture	\N
ed872a50-3cbe-42d9-aa1a-878ebe3ce37e	2d4ace7c-5d66-4883-b993-4bbea2cf7906	\N	الاعدا المركبه	التفاضل والتكامل	الصف الثاني الثانوي	0	\N	lecture	\N
a8319cd9-3acf-4b72-bf2c-8c30b72fb575	de6b3d4b-c563-4c81-93c0-6568b1115862	\N	الاعدا المركبه	التفاضل والتكامل	الصف الثاني الثانوي	0	\N	lecture	\N
018c9b2d-94b0-428b-a0aa-ecc17b09378e	4081c1d9-c900-4b96-b238-355479768e4c	\N	الاعدا المركبه	التفاضل والتكامل	الصف الثاني الثانوي	0	\N	lecture	\N
7ec79115-cb66-44a6-8291-c443a1371483	243d5bdb-39dc-4e4f-8b91-3fa2a90ff183	\N	كورس الشهر الاول	الجبر والمتطابقات	الصف الأول الثانوي	0	2abd18f3-737d-4e7c-b668-3ca67793e6ca	course_bundle	\N
546ee7b9-0380-4cc0-a426-01af6eec495d	8936a207-efaa-4889-9bd4-1caf142b0435	\N	كورس الشهر الاول	الجبر والمتطابقات	الصف الأول الثانوي	0	2abd18f3-737d-4e7c-b668-3ca67793e6ca	course_bundle	\N
d1d75fb6-64fe-4b26-9635-489865161959	da22d8ea-5ee5-490f-842c-4da7c81ed9cf	\N	كورس الشهر الاول	الجبر والمتطابقات	الصف الأول الثانوي	0	2abd18f3-737d-4e7c-b668-3ca67793e6ca	course_bundle	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."orders" ("id", "code", "student_id", "student_name", "student_email", "student_phone", "method", "reference", "note", "total", "status", "created_at", "subtotal", "discount", "coupon_code", "receipt_url") FROM stdin;
001328cb-24bd-4a33-9d28-de6584607b63	SEED-APPROVED-1	71bbe139-a35d-494b-b6a0-bddfbc8bc73a	محمد إبراهيم	student@platform.com	01000000000	فودافون كاش	SEED		390	approved	2026-06-26 22:31:14.325757+00	390	0	\N	\N
0c2f6164-086c-4d88-ab16-1122eeb1a2cf	ORD-2026-6291	79e42b41-dcf0-477b-9b19-2772b89a58ec	عمار	mr01972222@gmail.com	+201009771898	فودافون كاش			820	rejected	2026-06-27 02:00:01.554339+00	820	0	\N	\N
49aeb3f8-0b2f-48f7-8383-66d15447f29f	ORD-2026-8086	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	سيد	sayedxiv@gmail.com	01020962775	فودافون كاش			60	approved	2026-07-03 05:13:40.333368+00	120	60	SAYED	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/381d8452-d5d9-43f4-9be4-76d46716a9aa.jpg
c3de0f44-807f-4ada-82cc-f94c35079531	ORD-2026-8593	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	فودافون كاش	01111		140	approved	2026-07-05 20:06:31.479158+00	140	0	\N	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/bae5fe68-6712-4d58-9733-c04fd46a3db1.jpeg
2d66e35b-010e-4002-aa09-84af27eba78a	ORD-2026-6463	80aeee02-e678-40f6-ace8-20a9a0b575cd	Exercitation facilis	proahmedashraf0@gmail.com	Non adipisicing cons	اتصالات كاش	Quia harum aliqua C	Id magna laborum No	170	approved	2026-07-07 13:01:36.069461+00	170	0	\N	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/1150b7d7-094c-4c04-8aca-e0825100494d.png
26dd8ee1-1b80-4789-9c27-0ab0712b0693	ORD-2026-9588	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	فودافون كاش	74512		135	approved	2026-07-08 09:05:13.643697+00	135	0	\N	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/169e7361-4893-48b7-a7a4-2794000e342c.png
2423b8fb-6ab4-4ad6-aaa7-65dfc9c8539d	ORD-2026-2635	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	مجاني			0	approved	2026-07-08 09:08:47.875629+00	0	0	\N	\N
5b9109aa-cf53-45bf-95d8-e88c14d71bd8	ORD-2026-9228	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	سيد	sayedxiv@gmail.com	01020962775	مجاني			0	approved	2026-07-09 13:18:11.715902+00	0	0	\N	\N
e308fcf3-d050-493a-b110-4f09c694b015	ORD-2026-9827	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	سيد	sayedxiv@gmail.com	01020962775	مجاني			0	approved	2026-07-09 14:32:57.471791+00	0	0	\N	\N
2e1fb2f9-1ab2-42ee-93bb-22741f19f5cc	ORD-2026-6767	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	فودافون كاش			0	approved	2026-07-13 15:28:18.247121+00	0	0	\N	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/8e9e5705-48b9-4722-b815-f8b14967b32e.png
2d4ace7c-5d66-4883-b993-4bbea2cf7906	ORD-2026-5505	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	مجاني			0	approved	2026-07-13 15:45:34.554028+00	0	0	\N	\N
de6b3d4b-c563-4c81-93c0-6568b1115862	ORD-2026-8668	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	مجاني			0	approved	2026-07-13 15:46:38.036304+00	0	0	\N	\N
4081c1d9-c900-4b96-b238-355479768e4c	ORD-2026-4747	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	عمار ابراهيم	mr019722222@gmail.com	01116013151	مجاني			0	approved	2026-07-13 15:46:38.954733+00	0	0	\N	\N
705aa037-7713-464e-9cdf-aaa9f0d95368	ORD-2026-6042	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	فودافون كاش			0	approved	2026-07-13 19:47:24.351625+00	0	0	SAYED	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/be40a4d1-b0e3-4868-8996-473079c3d307.png
b02b58b5-d3e0-46d7-a9cb-d66a63dcca42	ORD-2026-9418	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 18:13:45.260507+00	0	0	\N	\N
c5277682-a78f-4ef7-ad86-f1bf16d72883	ORD-2026-9302	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 18:19:42.722709+00	0	0	\N	\N
5e7fe349-a47f-435d-8f17-0a59fd8cb690	ORD-2026-9721	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 18:21:00.506445+00	0	0	\N	\N
243d5bdb-39dc-4e4f-8b91-3fa2a90ff183	ORD-2026-6925	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 23:01:13.403656+00	0	0	\N	\N
8936a207-efaa-4889-9bd4-1caf142b0435	ORD-2026-1034	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 23:01:14.012318+00	0	0	\N	\N
da22d8ea-5ee5-490f-842c-4da7c81ed9cf	ORD-2026-3863	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	مجاني			0	approved	2026-07-15 23:03:25.235333+00	0	0	\N	\N
51d36f1d-db8c-47d9-8c84-94433fc2973b	ORD-2026-3437	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	فودافون كاش			200	approved	2026-07-15 23:03:56.171436+00	200	0	\N	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/a5657923-317a-4dd8-8d33-48da2f8e3cde.jpg
\.


--
-- Data for Name: page_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."page_views" ("id", "path", "visitor_id", "device", "created_at") FROM stdin;
1	/	63f1f75e-a17c-4041-bb15-d9041283fb74	desktop	2026-07-06 09:01:30.545805+00
2	/stages/sec-2	63f1f75e-a17c-4041-bb15-d9041283fb74	desktop	2026-07-06 09:02:04.594632+00
3	/stages/sec-2/calculus	63f1f75e-a17c-4041-bb15-d9041283fb74	desktop	2026-07-06 09:02:10.520056+00
4	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:48:15.64449+00
5	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:48:19.544124+00
6	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:48:22.28434+00
7	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:48:44.458731+00
8	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:48:47.931685+00
9	/student/exams/EX-MR88QFN4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:10.902462+00
10	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:14.320801+00
11	/student/exams/EXM-001	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:15.901385+00
12	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:19.778144+00
13	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:22.471622+00
14	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:23.414041+00
15	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:26.612969+00
16	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:27.565459+00
17	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:29.951711+00
18	/student/assignments/5d82993c-f0d3-40e3-aa30-f8da0c9a4459	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:33.417077+00
19	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:34.754579+00
20	/student/assignments/cd47b669-dafa-4a86-a35f-93a597139058	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:38.297159+00
21	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:52.244114+00
22	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:49:58.275295+00
23	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:51:09.076129+00
24	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:53:20.410468+00
25	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:53:37.311031+00
26	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:53:40.229547+00
27	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:53:42.166807+00
28	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:53:43.319852+00
29	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:54:23.446113+00
30	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:54:27.202795+00
31	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:56:21.083251+00
32	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:56:25.488729+00
33	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:10.110499+00
34	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:11.396047+00
35	/student/assignments/cd47b669-dafa-4a86-a35f-93a597139058	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:17.933933+00
36	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:33.805223+00
37	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:37.477495+00
38	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:39.773405+00
39	/student/assignments/cd47b669-dafa-4a86-a35f-93a597139058	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:43.556248+00
40	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:54.040342+00
41	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 20:59:56.863883+00
42	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:00:01.151213+00
43	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:00:09.554016+00
44	/student/exams/EX-MR88QFN4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:01:32.202496+00
45	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:01:33.695491+00
46	/student/exams/EXM-001	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:01:35.113038+00
47	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:02:19.627698+00
48	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:03:50.453321+00
49	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:04:07.924776+00
50	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:14.38299+00
51	/student/billing	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:16.59386+00
52	/student/schedule	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:18.418411+00
53	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:19.761502+00
54	/student/exams/EXM-001	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:26.705795+00
55	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:27.621045+00
56	/student/exams/EXM-2051	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:29.430217+00
57	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:30.97185+00
58	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:36.366981+00
59	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:38.940228+00
60	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:40.853262+00
61	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:42.669244+00
62	/student/exams/EXM-2045	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:47.307606+00
63	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:49.046825+00
64	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:55.115522+00
65	/student/billing	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:56.463651+00
66	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:24:58.557733+00
67	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:26:33.420057+00
68	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-06 21:38:39.263225+00
69	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:00:05.386737+00
70	/student/courses	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:00:10.214899+00
71	/student/browse	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:00:13.262624+00
72	/student/notifications	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:01:56.665841+00
73	/student/browse	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:05.17522+00
74	/student/settings	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:07.848113+00
75	/student/settings	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:47.015063+00
76	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:51.249305+00
77	/student/courses/algebra-adv	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:54.112491+00
78	/student/courses/algebra-adv/lessons/l1	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:02:56.523102+00
79	/student/courses/algebra-adv/lessons/l1	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:03:26.133224+00
80	/student/exams	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:08.803606+00
81	/student/assignments	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:11.663254+00
82	/student/exams	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:12.939369+00
83	/student/schedule	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:15.288878+00
84	/student/messages	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:16.098226+00
85	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:09:22.180899+00
86	/student/messages	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:11:19.116193+00
87	/student/browse	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:17.447698+00
88	/student/exams	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:20.916944+00
89	/student/messages	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:21.692195+00
90	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:27.465596+00
91	/student/settings	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:28.362931+00
92	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:30.758813+00
93	/student/courses/algebra-adv	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:37.252623+00
94	/student/courses/algebra-adv/lessons/l1	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:40.200842+00
95	/student/courses/algebra-adv/lessons/l2	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:45.450318+00
96	/student/courses/algebra-adv/lessons/l3	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:50.193519+00
97	/student/assignments/fca03807-e29d-4d5c-b4be-693c854ec4ed	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:15:54.305438+00
98	/student	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:18:57.51902+00
99	/student/exams	d7174db9-7daa-44ab-9df1-c00d05ffd8e6	desktop	2026-07-07 13:20:52.337138+00
100	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-08 06:24:37.00339+00
101	/auth	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-08 06:24:40.560389+00
102	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:50:56.073135+00
103	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:50:59.002669+00
104	/student/exams/EX-MR88QFN4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:51:01.688714+00
105	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:51:03.235546+00
106	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:52:09.690321+00
107	/student/exams/EX-MRBUA5Z7	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:52:12.7457+00
108	/student/exams/EX-MRBUA5Z7	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:53:52.301857+00
109	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:53:58.555619+00
110	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:54:02.52761+00
111	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:54:45.621415+00
112	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:55:10.159661+00
113	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:55:14.31296+00
114	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:55:45.258485+00
115	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:56:16.50176+00
116	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:57:08.000722+00
117	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:57:42.540206+00
118	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:57:44.041809+00
119	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:57:47.321487+00
120	/student/assignments/cd47b669-dafa-4a86-a35f-93a597139058	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:57:51.123511+00
121	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:58:12.601012+00
122	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:58:14.519256+00
123	/student/assignments/5d82993c-f0d3-40e3-aa30-f8da0c9a4459	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:58:18.848788+00
124	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 08:58:28.261458+00
125	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:00:57.362196+00
126	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:04:01.768331+00
127	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:04:06.761783+00
128	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:04:23.805436+00
129	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:04:26.663243+00
130	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:04:31.257495+00
131	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:30.68313+00
132	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:32.224585+00
133	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:34.883827+00
134	/student/courses/forces/lessons/l1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:39.159977+00
135	/student/courses/forces/lessons/l2	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:44.682983+00
136	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:49.452939+00
137	/student/assignments/da7b9c07-de54-4195-8b3a-fb48faf86da2	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:05:53.076037+00
138	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:04.13174+00
139	/student/assignments/135df3bc-9c2b-45cd-8723-218f4189e2f1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:07.351512+00
140	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:12.155175+00
141	/student/courses/forces/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-%D8%A7%D9%84%D9%85%D9%86%D8%B5%D9%87-zvv11	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:13.046479+00
142	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:15.319323+00
143	/student/assignments/135df3bc-9c2b-45cd-8723-218f4189e2f1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:21.405265+00
144	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:27.926802+00
145	/student/courses/forces/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-%D8%A7%D9%84%D9%85%D9%86%D8%B5%D9%87-zvv11	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:30.643192+00
146	/student/courses/forces/lessons/l3	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:33.206927+00
147	/student/assignments/da7b9c07-de54-4195-8b3a-fb48faf86da2	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:38.827713+00
148	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:46.203831+00
149	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:48.708888+00
150	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:06:52.835502+00
151	/student/courses/forces/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-%D8%A7%D9%84%D9%85%D9%86%D8%B5%D9%87-zvv11	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:07:03.170183+00
152	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:07:05.434498+00
153	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:31.744403+00
154	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:34.8555+00
155	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:41.680777+00
156	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:49.653324+00
157	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:53.775771+00
158	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:08:56.763297+00
159	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:15:22.074831+00
160	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:15:25.241901+00
161	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:15:32.648826+00
162	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:15:35.485614+00
163	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:17:42.370083+00
164	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:24:35.234694+00
165	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:24:36.822867+00
166	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:24:41.069003+00
167	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:36:02.383384+00
168	/student/courses/forces/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-%D8%A7%D9%84%D9%85%D9%86%D8%B5%D9%87-zvv11	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:36:23.686098+00
169	/student/courses/forces/lessons/l1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:36:37.601633+00
170	/student/courses/forces/lessons/1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:36:57.662213+00
171	/student/courses/forces/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-%D8%A7%D9%84%D9%85%D9%86%D8%B5%D9%87-zvv11	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-08 09:37:43.583108+00
172	/student/courses/forces/lessons/1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:59:31.642995+00
173	/	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 09:59:37.998097+00
174	/auth	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:22:10.903701+00
175	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:22:12.007928+00
176	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:22:17.428223+00
177	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:22:21.161599+00
178	/student/courses/forces/lessons/l1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:24:26.815801+00
179	/student/courses/forces	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:24:30.763732+00
180	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:31:00.606671+00
181	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:31:02.680072+00
182	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:31:07.828456+00
183	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:33:14.188098+00
184	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:34:49.65733+00
185	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:35:15.280233+00
186	/student	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:35:53.107252+00
187	/student	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:35:59.902124+00
188	/student	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:36:30.78725+00
189	/student/browse	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:12.863939+00
190	/student	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:13.946032+00
191	/student/courses/%D8%AA%D8%B3%D8%AA-htg80	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:23.047636+00
192	/student	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:23.961866+00
193	/student/browse	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:26.935286+00
194	/student/courses	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:40.455931+00
195	/student/exams	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:55.344496+00
196	/student/exams/EX-MR88QFN4	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:37:59.422199+00
197	/student/exams	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:00.09788+00
198	/student/exams/EX-MRBUA5Z7	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:02.150995+00
199	/student/exams	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:11.161689+00
200	/student/exams/EXM-2045	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:20.197686+00
201	/student/exams	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:20.710904+00
202	/student/assignments	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:23.140449+00
203	/student/schedule	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:27.70795+00
204	/student/assignments	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:38:29.182007+00
205	/student/schedule	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:39:59.547085+00
206	/student/messages	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:40:00.698135+00
207	/student/notifications	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:40:04.586786+00
208	/student/settings	71d9b9ff-8987-45b5-9950-42277284f5d3	desktop	2026-07-08 10:40:15.474397+00
209	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:43:23.327407+00
210	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:43:56.142738+00
211	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-08 10:44:54.252318+00
212	/auth	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-08 10:44:57.986291+00
213	/student	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-08 10:45:11.367933+00
214	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:51:04.687655+00
215	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:51:07.600508+00
216	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:51:08.97076+00
217	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 10:51:16.275782+00
218	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 12:29:41.302717+00
219	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 12:29:46.5407+00
220	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 12:31:47.196048+00
221	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-08 12:33:54.243823+00
222	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:17:22.0833+00
223	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:17:55.215918+00
224	/student/browse	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:17:58.307815+00
225	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:18:14.317746+00
226	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:18:18.317776+00
227	/student/courses/%D8%AA%D8%AC%D8%B1%D8%A8%D8%A9-l1wbk	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:18:45.509009+00
228	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:18:49.473771+00
229	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:19:48.327602+00
230	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:22:11.947826+00
231	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:23:34.557948+00
232	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:28:51.925757+00
233	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:29:08.113325+00
234	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:33:40.315824+00
235	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:33:57.829494+00
236	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:35:39.720679+00
237	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:36:07.846935+00
238	/student/settings	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:44:20.656095+00
239	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:44:58.121774+00
240	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:46:58.291713+00
241	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 13:50:30.730515+00
242	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:24:58.786641+00
243	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:25:40.697678+00
244	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:28:05.87892+00
245	/student/exams	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:29:10.985553+00
246	/student/assignments	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:29:26.288671+00
247	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:29:34.884221+00
248	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:32:49.734495+00
249	/student/browse	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:32:53.16098+00
250	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:33:03.293205+00
251	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:33:06.276383+00
252	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:33:09.911485+00
253	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:33:35.198448+00
254	/student/courses/%D8%AA%D8%AC%D8%B1%D8%A8%D8%A9-l1wbk	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:36:42.124296+00
255	/student/courses/%D8%AA%D8%AC%D8%B1%D8%A8%D8%A9-l1wbk	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:36:56.404678+00
256	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:37:08.921602+00
257	/student/courses/%D8%AA%D8%AC%D8%B1%D8%A8%D8%A9-l1wbk	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:37:15.547666+00
258	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:39:36.329853+00
259	/student/courses	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:49:16.905237+00
260	/student/courses/complex-numbers	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 14:49:20.635711+00
261	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:43:51.432367+00
262	/student/courses/complex-numbers	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:43:56.463304+00
263	/student/courses/complex-numbers/lessons/l1	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:44:39.594044+00
264	/student/courses/complex-numbers/lessons/l1	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:46:11.327946+00
265	/student	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:49:30.363725+00
266	/student/notifications	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:49:46.60088+00
267	/student/settings	953b2640-a00c-4842-ac62-cff0d2508366	desktop	2026-07-09 16:49:48.265875+00
268	/student	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 13:48:09.712349+00
269	/student/courses	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 13:48:16.806523+00
270	/student/courses/complex-numbers	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 13:48:21.01965+00
271	/student/courses/complex-numbers/lessons/l1	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 13:48:39.60603+00
272	/student/courses/complex-numbers	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 13:48:42.39161+00
273	/student/courses	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 14:08:55.636697+00
274	/student/courses/%D8%AA%D8%AC%D8%B1%D8%A8%D8%A9-l1wbk	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 14:09:08.310337+00
275	/student/courses	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 14:09:11.365926+00
276	/student/courses/complex-numbers	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 14:29:45.961705+00
277	/student/courses/complex-numbers/lessons/l2	524b29d0-148b-4370-876d-f823016c9f84	desktop	2026-07-12 14:29:50.834062+00
278	/student	152f1190-7b3f-4f6a-bef8-ab2ef79956a6	desktop	2026-07-12 16:22:12.845953+00
279	/student/courses	473050ad-7456-4e7a-8d84-72a3b1f8b643	desktop	2026-07-12 16:22:30.550037+00
280	/student/courses/complex-numbers	7bb8649c-210a-4d43-bb6d-d7e6fd0d3c2c	desktop	2026-07-12 16:23:15.089819+00
281	/student/browse	917205b8-1dd4-41d0-aa37-7c8909645749	desktop	2026-07-12 16:55:06.044348+00
282	/student/courses	917205b8-1dd4-41d0-aa37-7c8909645749	desktop	2026-07-12 16:55:46.620352+00
283	/	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:04:27.018345+00
284	/stages/sec-1	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:04:33.426709+00
285	/stages/sec-1/alg-identities	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:04:45.013383+00
286	/stages/sec-1	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:05:00.83211+00
287	/stages/sec-1/analytic-geometry	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:05:05.006873+00
288	/stages/sec-1/analytic-geometry	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 17:45:14.671672+00
289	/stages/sec-1/analytic-geometry	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 18:08:54.718989+00
290	/stages/sec-1/analytic-geometry	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 18:13:45.605353+00
291	/stages/sec-1/analytic-geometry/%D8%A7%D9%84%D8%A8%D8%AA%D9%86%D8%AC%D8%A7%D9%86-%D8%A7%D9%84%D9%85%D9%82%D9%84%D9%8A-1bdgx	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 18:13:50.494529+00
292	/stages/sec-1/analytic-geometry	2dafaf48-1d42-4b76-a7d4-5c7c6cbbe508	desktop	2026-07-12 18:14:02.352019+00
293	/student	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:04.259796+00
294	/student/courses	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:08.653265+00
295	/student/browse	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:11.730938+00
296	/student/courses	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:13.303752+00
297	/student/browse	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:18.039834+00
298	/student/settings	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:22:22.099651+00
299	/student/messages	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:23:33.295552+00
300	/student/browse	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 15:23:40.959582+00
301	/	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:27:45.776229+00
302	/auth	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:27:51.309683+00
303	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:27:52.157835+00
304	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:27:55.905758+00
305	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:28:00.063494+00
306	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:28:23.273186+00
307	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-qt9yx	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:28:46.35668+00
308	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-qt9yx	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:29:35.092689+00
309	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-qt9yx	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:29:40.001754+00
310	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:29:50.263101+00
311	/student/courses/%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A-c4xma	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:29:55.187121+00
312	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:30:00.810726+00
313	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:30:41.324335+00
314	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:38:28.873891+00
315	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:38:31.220234+00
316	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:41:14.788195+00
317	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:45:03.183313+00
318	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:45:37.119624+00
319	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:45:45.660403+00
320	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:45:48.708129+00
321	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:45:58.12604+00
322	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:01.358889+00
323	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:04.903872+00
324	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:22.035363+00
325	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:41.519329+00
326	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:45.32867+00
327	/student/courses/limits/lessons/l1	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:51.068609+00
328	/student/courses/limits	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:55.62327+00
329	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:56.519372+00
330	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:58.679393+00
331	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:46:59.770517+00
332	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:47:04.436813+00
333	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 15:48:16.779207+00
334	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:52:02.631347+00
335	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:52:05.839787+00
336	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:52:32.67294+00
337	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 15:53:09.481192+00
338	/auth	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 16:03:26.534978+00
339	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 16:09:34.864618+00
340	/stages/sec-3	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 16:10:10.82557+00
341	/stages/sec-3/pure-math	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 16:10:18.321999+00
342	/stages/sec-3	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 16:10:23.340187+00
343	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 16:11:26.386979+00
344	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 16:51:47.033061+00
345	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:12:27.567538+00
346	/auth	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:12:30.88764+00
347	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:40:28.375759+00
348	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:40:37.750668+00
349	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:40:49.153992+00
350	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:40:59.51236+00
351	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:41:15.107609+00
352	/	5e01663b-03d8-42ab-9c69-a42fd0a318b2	desktop	2026-07-13 17:41:30.609398+00
353	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 18:15:01.178956+00
354	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:05:54.629462+00
355	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:06:04.410704+00
356	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:06:06.7747+00
357	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:06:36.188853+00
358	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:06:37.501827+00
359	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:10:51.477645+00
360	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:11:15.389349+00
361	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:11:27.3572+00
362	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:11:54.290215+00
363	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:11:56.359637+00
364	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:14:05.147257+00
365	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:16:56.167925+00
366	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:16:59.868198+00
367	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:17:02.647709+00
368	/student/exams/EX-MRBUA5Z7	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:17:05.909031+00
369	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:17:19.080371+00
370	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:17:53.822789+00
371	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:17:58.430373+00
372	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:18:00.261454+00
373	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:19:35.095346+00
374	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:21:49.263528+00
375	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:21:52.201365+00
376	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:31:46.541013+00
377	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n/watch/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:31:59.183526+00
378	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:33:11.075293+00
379	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n/watch/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:35:52.609326+00
380	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:42:24.778894+00
381	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:42:28.907994+00
382	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n/watch/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-z4pgb	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:42:59.064148+00
383	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:43:05.474609+00
384	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n/watch/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-z4pgb	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:43:43.226511+00
385	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:01.397506+00
386	/stages/sec-1	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:08.315713+00
387	/stages/sec-1/alg-identities	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:19.600197+00
388	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:23.670512+00
389	/stages/sec-1/alg-identities	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:32.370208+00
390	/stages/sec-1	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:44:33.395592+00
391	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:11.791203+00
392	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:15.205347+00
393	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:32.14605+00
394	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:34.252994+00
395	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:35.688117+00
396	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 19:46:37.398198+00
397	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:49:15.787337+00
398	/auth	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-13 19:49:19.164435+00
399	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:05:38.732893+00
400	/student/assignments	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:10:44.263089+00
401	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:10:47.519553+00
402	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:10:54.50185+00
403	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:11:26.150748+00
404	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:11:30.391447+00
405	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:11:46.222081+00
406	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:12:13.389133+00
407	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:47:36.525525+00
408	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:47:40.675519+00
409	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:48:19.772356+00
410	/	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-13 20:49:22.687385+00
411	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 12:50:58.61053+00
412	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 12:51:12.354649+00
413	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 14:30:13.635941+00
414	/	81205e6b-c954-4377-ad71-c53a767e109c	desktop	2026-07-15 16:53:21.269452+00
415	/stages/sec-3	81205e6b-c954-4377-ad71-c53a767e109c	desktop	2026-07-15 16:53:33.315788+00
416	/stages/sec-3	81205e6b-c954-4377-ad71-c53a767e109c	desktop	2026-07-15 16:56:05.618661+00
417	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 18:00:09.054141+00
418	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-yui5n	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 18:00:23.04457+00
419	/	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 18:00:26.938321+00
420	/stages/sec-1	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 18:00:34.965196+00
421	/auth	10d03bb5-ae92-4e73-b57c-3564cb50223b	desktop	2026-07-15 18:01:05.265988+00
422	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:01:20.608033+00
423	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:02:07.233631+00
424	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:02:27.224962+00
425	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:04:10.7464+00
426	/student/exams/EX-MRBUA5Z7	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:04:13.731316+00
427	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:04:18.790057+00
428	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:04:21.64809+00
429	/student/exams/EX-MRBUA5Z7	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:04:56.970682+00
430	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:05:09.286922+00
431	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:06:25.590692+00
432	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:07:50.194632+00
433	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:07:53.797968+00
434	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:13:40.552678+00
435	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:13:46.874857+00
436	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:13:52.491434+00
437	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-734p4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:14:00.213581+00
438	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-734p4/lessons/%D9%85%D9%82%D8%AF%D9%85%D9%87-l63yd	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:14:03.810218+00
439	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-734p4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:15:55.985426+00
440	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-734p4	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:16:43.864291+00
441	/	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:16:52.871376+00
442	/auth	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:16:55.757223+00
443	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:16:56.552239+00
444	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:16:58.671346+00
445	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:17:04.465812+00
446	/student/courses/5-3tz4p	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:18:10.014106+00
447	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:18:24.454351+00
448	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:19:40.357542+00
449	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:19:44.367767+00
450	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:19:46.017122+00
451	/student/courses/%D8%A7%D9%84%D8%A7%D9%84%D9%88-qzx0c	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:20:04.651209+00
452	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:20:35.721051+00
453	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:20:51.31949+00
454	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:21:02.019423+00
455	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:21:19.721486+00
456	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:21:22.01709+00
457	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 18:22:13.051808+00
458	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 20:54:46.956942+00
459	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 20:54:49.117517+00
460	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:24:55.590991+00
461	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:24:56.99338+00
462	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:25:00.420533+00
463	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:25:51.892606+00
464	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:32:59.490242+00
465	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:33:03.922528+00
466	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq/lessons/%D9%87%D9%8A-%D8%A8%D8%B3-%D9%85%D8%AD%D8%AA%D8%A7%D8%AC%D8%A9-highlight-%D8%B5-fna8s	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 21:33:07.026294+00
467	/student/courses/%D8%A7%D9%84%D8%A7%D8%B9%D8%AF%D8%A7%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D9%87-lf1aq/lessons/%D9%87%D9%8A-%D8%A8%D8%B3-%D9%85%D8%AD%D8%AA%D8%A7%D8%AC%D8%A9-highlight-%D8%B5-fna8s	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:44:25.520008+00
468	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:44:29.335725+00
469	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:45:46.915684+00
470	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:46:44.949494+00
471	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:46:51.04514+00
472	/student/settings	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:47:00.082295+00
473	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:47:03.590609+00
474	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:53:53.213795+00
475	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:53:55.844299+00
476	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 22:58:59.213376+00
477	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:00:11.575042+00
478	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:01:15.805222+00
479	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:01:17.157821+00
480	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:01:20.789074+00
481	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa/lessons/%D8%A7%D9%84%D8%B4%D8%B1%D8%AD-59162	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:01:24.288661+00
482	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:23.159553+00
483	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:27.703145+00
484	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-228sd/watch/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:32.14633+00
485	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-228sd	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:43.015163+00
486	/stages/sec-1/alg-identities/%D9%83%D9%88%D8%B1%D8%B3-%D8%A7%D9%84%D8%B4%D9%87%D8%B1-%D8%A7%D9%84%D8%A7%D9%88%D9%84-228sd/watch/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:44.294307+00
487	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:45.265732+00
488	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:02:53.327893+00
489	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:03:26.977939+00
490	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:03:40.702161+00
491	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:04:08.322836+00
492	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-%D8%A7%D9%84%D8%B4%D9%87-ja08h	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:04:11.963974+00
493	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-%D8%A7%D9%84%D8%B4%D9%87-ja08h/lessons/%D8%AA%D8%B3%D8%AA-49xkj	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:04:14.161717+00
494	/	03371ab4-5f02-49e9-b6e3-3d7d724495c4	desktop	2026-07-15 23:05:04.262524+00
495	/auth	03371ab4-5f02-49e9-b6e3-3d7d724495c4	desktop	2026-07-15 23:05:12.704086+00
496	/student	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:18:15.673107+00
497	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:18:19.472396+00
498	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:18:24.382872+00
499	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa/lessons/%D8%A7%D9%84%D8%B4%D8%B1%D8%AD-59162	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:18:26.630746+00
500	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:19:31.732033+00
501	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:31:29.300332+00
502	/student/exams/EX-MRMO6FQN	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:31:54.720069+00
503	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:31:55.605494+00
504	/student/exams/EX-MRMK62FB	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:31:57.003547+00
505	/student/exams	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:35:40.180738+00
506	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:35:48.827189+00
507	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:35:53.649812+00
508	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:37:28.159053+00
509	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:37:49.62614+00
510	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:37:53.102116+00
511	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:37:58.499893+00
512	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:38:23.772285+00
513	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:39:18.644757+00
514	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:39:29.199337+00
515	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:39:35.091038+00
516	/student/courses/%D8%AE%D9%86%D9%85-jx0ow	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:39:39.32597+00
517	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:39:42.245462+00
518	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:40:16.253997+00
519	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:40:21.08973+00
520	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-15 23:40:22.343762+00
521	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:08.05643+00
522	/student/billing	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:20.273232+00
523	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:22.331117+00
524	/student/messages	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:23.450297+00
525	/student/notifications	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:26.270286+00
526	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 00:08:38.366953+00
527	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 03:32:49.091235+00
528	/	03371ab4-5f02-49e9-b6e3-3d7d724495c4	desktop	2026-07-16 03:46:00.745027+00
529	/student/browse	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 12:10:21.933598+00
530	/student/brows	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 20:02:40.358819+00
531	/	10bc2084-23bf-4863-a8e7-11802115d879	desktop	2026-07-16 20:02:44.125916+00
532	/stages/sec-1	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:05:36.300211+00
533	/	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:05:53.406451+00
534	/auth	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:18:56.711903+00
535	/student	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:18:57.277493+00
536	/student/courses	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:19:05.187214+00
537	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:19:11.257822+00
538	/student/courses/%D9%85%D8%AD%D8%AA%D9%88%D9%8A-%D8%A7%D9%84%D8%A7%D8%B3%D8%A8%D9%88%D8%B9-%D8%A7%D9%84%D8%A7%D9%88%D9%84-7ncfa/lessons/%D8%A7%D9%84%D8%B4%D8%B1%D8%AD-59162	10bc2084-23bf-4863-a8e7-11802115d879	mobile	2026-07-16 20:19:15.491333+00
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."payments" ("id", "code", "student_name", "student_email", "student_phone", "course", "amount", "method", "receipt_url", "reference", "submitted_at", "status", "created_at", "student_id") FROM stdin;
4ad46d91-2a3a-456e-8422-2a45764da46e	PAY-2001	محمد إبراهيم	mohamed.ibrahim@email.com	0100 123 4567	البرمجة باستخدام Python	450	انستاباي	\N	INSTA-2001	منذ يومين	مقبول	2026-06-26 00:48:31.844982+00	625048f2-3bc5-4765-9ce8-fdf14b534ce5
e9bfff3e-1e42-455c-acc5-685750e29a83	PAY-2002	محمد إبراهيم	mohamed.ibrahim@email.com	0100 123 4567	تصميم واجهات المستخدم UI/UX	650	فودافون كاش	\N	VC-2002	منذ 3 ساعات	قيد المراجعة	2026-06-26 00:48:31.844982+00	625048f2-3bc5-4765-9ce8-fdf14b534ce5
2b0d597a-1ae5-40d2-8951-a53a3df5a28d	PAY-1001	فاطمة الزهراء	fatma.az@gmail.com	0111 987 6543	أساسيات تطوير الويب	450	انستاباي	/receipts/instapay-receipt.png	IPN-8842301	منذ 12 دقيقة	قيد المراجعة	2026-06-25 23:57:36.349584+00	99571d20-0630-4bfb-bb89-4dae4ef8e5c4
dcc76992-23de-42e7-b301-3376c58f058f	PAY-1002	يوسف محمد	youssef.mohamed@email.com	0122 456 7890	تصميم واجهات المستخدم UI/UX	650	فودافون كاش	/receipts/vodafone-receipt.png	VFC-552190	منذ 35 دقيقة	قيد المراجعة	2026-06-25 23:57:36.349584+00	d9cac849-cd6b-4b3d-b0e9-0bb7a5f67e3a
eba8b97d-5bf7-40eb-9cde-34c950923659	PAY-1003	سارة محمود	sara.mahmoud@email.com	0109 321 6547	البرمجة بلغة بايثون	500	انستاباي	/receipts/instapay-receipt.png	IPN-8842355	منذ ساعة	قيد المراجعة	2026-06-25 23:57:36.349584+00	b1f4d704-6007-4279-9900-295a693be228
c515dd81-1da9-4a0d-89f9-9781d1827aa6	PAY-1004	أحمد خالد	ahmed.khaled@email.com	0115 654 3210	التسويق الرقمي	400	فودافون كاش	/receipts/vodafone-receipt.png	VFC-552233	منذ 3 ساعات	مقبول	2026-06-25 23:57:36.349584+00	1474b992-b959-417f-a891-c9e221cd0744
700143ef-9856-4653-8aaf-c10ae7576f82	PAY-1005	نورهان السيد	nourhan.elsayed@email.com	0128 741 9630	تحليل البيانات	700	انستاباي	/receipts/instapay-receipt.png	IPN-8842401	منذ 5 ساعات	مقبول	2026-06-25 23:57:36.349584+00	be6af4e1-dd23-4962-9a1e-38371ccebedb
022ddb92-2660-4691-b97e-03da2e80e863	PAY-1006	محمود علي	mahmoud.ali@email.com	0106 852 7413	أساسيات تطوير الويب	450	فودافون كاش	/receipts/vodafone-receipt.png	VFC-552288	أمس	مرفوض	2026-06-25 23:57:36.349584+00	e02798d4-8108-4451-bf78-bc125c23d351
1afb7213-b904-47e2-8746-2b0ff60725f6	PAY-1007	مريم حسن	mariam.hassan@email.com	0114 369 2580	تطوير تطبيقات الموبايل	800	انستاباي	/receipts/instapay-receipt.png	IPN-8842460	أمس	مقبول	2026-06-25 23:57:36.349584+00	b7ac6501-4750-4144-8766-40c9e1fd2263
72fb3e54-b357-48f2-b325-a4368f0fdb6e	PAY-1008	عمر فاروق	omar.farouk@email.com	0127 159 7530	تصميم واجهات المستخدم UI/UX	650	فودافون كاش	/receipts/vodafone-receipt.png	VFC-552301	منذ يومين	قيد المراجعة	2026-06-25 23:57:36.349584+00	f5fc10fd-b136-4759-9ec7-90754626f907
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."platform_settings" ("id", "is_streaming_enabled", "updated_at", "worker_cpu_threads", "worker_ram_mb", "worker_concurrency", "segment_duration_sec") FROM stdin;
1	f	2026-07-13 19:50:03.686+00	2	2048	1	4
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."profiles" ("id", "email", "full_name", "phone", "grade", "role", "created_at", "color_preset", "notif_prefs", "avatar_url") FROM stdin;
7781f763-4944-457a-972f-50c57d7eda76	mr019722@gmail.com	عمار ابراهيم	01009771333	sec-1	student	2026-06-26 07:02:18.8993+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
9da04a2b-558b-48ba-a8c4-efcf7c5a850e	mr0192@gmail.com	عمار ابراهيم	01122556530	sec-1	student	2026-07-13 19:10:48.854558+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
80aeee02-e678-40f6-ace8-20a9a0b575cd	proahmedashraf0@gmail.com	ahmed ashraf	+201021257615	sec-3	student	2026-07-07 13:00:00.981794+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
5fe3265d-a754-42bb-834d-bd11969078d9	test-1783493236@example.com	\N	\N	\N	student	2026-07-08 06:47:16.927886+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
ce9addea-1f3d-4d98-91c2-0edd726365e4	sdktest-1783493277439@example.com	\N	\N	\N	student	2026-07-08 06:47:57.55742+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
0e75d9a3-ae1d-43cc-a75a-61c376542493	flk-def0-1783493329739@example.com	\N	\N	\N	student	2026-07-08 06:48:49.870669+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
89aa424f-2b05-4cbc-987c-c0a26e85a21c	flk-def1-1783493329947@example.com	\N	\N	\N	student	2026-07-08 06:48:50.035179+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
9d9c8b71-b81e-4422-853a-8f2c9a7fef68	mr0197222@gmail.com	عمار	+201009781898	sec-1	student	2026-06-27 01:57:52.171379+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
bf49ef9a-9c41-4c5f-8159-09a73bcaf1f3	flk-def2-1783493330102@example.com	\N	\N	\N	student	2026-07-08 06:48:50.190052+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
5f0cd85c-b0fa-4380-b2ad-f661992be965	flk-wrp0-1783493330257@example.com	\N	\N	\N	student	2026-07-08 06:48:50.343034+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
dd561d77-9b4f-49ed-addf-5c3213e2551a	flk-wrp1-1783493330411@example.com	\N	\N	\N	student	2026-07-08 06:48:50.49849+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
71bbe139-a35d-494b-b6a0-bddfbc8bc73a	student@platform.com	محمد إبراهيم	01000000000	sec-3	student	2026-06-25 20:54:40.946664+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
5635d05b-2963-4e59-9240-12beb45528dc	flk-wrp2-1783493330565@example.com	\N	\N	\N	student	2026-07-08 06:48:50.651781+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
79e42b41-dcf0-477b-9b19-2772b89a58ec	mr01972222@gmail.com	مم ulhv		sec-3	student	2026-06-26 07:43:12.157344+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
62c739a6-1a9b-40f4-9faf-77be78ef8431	mashwi@test.com	البتنجان المشوي	010101010	sec-2	student	2026-07-02 02:54:53.154115+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
eebff5bc-2e84-42a9-85e4-e305c519ecfa	sayed.s.elshazly@gmail.com	سيد	\N	\N	assistant	2026-07-08 07:18:49.700435+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
f1f8849a-ee21-4dc8-a807-ad2bea1704bd	test_assistant_err4@example.com	\N	\N	\N	student	2026-07-08 07:04:22.304097+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	mr019722222@gmail.com	عمار ابراهيم	01116013151	sec-2	student	2026-07-05 20:04:41.690426+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/avatars/1783501031525.jpg
3f20448a-10da-4ad9-84bc-9a1a5ed247ca	mr019711222@gmail.com	عمار	\N	\N	assistant	2026-07-13 19:50:56.421773+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
4a5158cf-7d80-4c83-9ec6-df3c82e2419c	mr01972e52d322@gmail.com	عمار	\N	\N	assistant	2026-07-08 09:22:04.2256+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	sayedxiv@gmail.com	سيد	01020962775	sec-1	student	2026-06-27 02:00:35.373622+00	green	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
6acccd5b-69ee-439e-86ab-dad4936ff251	admin@test.com	محمد أحمد	+20 100 123 4567	sec-3	admin	2026-06-25 20:54:40.781327+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/4dd8c6de-fa88-423c-b573-d2f8ecb3f54a.png
abbf0a7b-fcb9-41df-800c-b796c7fbe37f	mr01972222222@gmail.com	عمار ابرايهم	01009001898	sec-2	student	2026-07-13 15:22:00.759965+00	navy	{"smsNotif": false, "pushNotif": true, "emailNotif": true, "gradeAlerts": true, "marketingNotif": false, "lessonReminders": true}	\N
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."reports" ("id", "code", "title", "type", "created_by", "created_at", "status") FROM stdin;
fd469e6d-6673-4e41-bdb9-b18ccba7185a	REP-301	التقرير المالي لشهر مايو	مالي	أحمد سامي	2026-06-26 00:09:59.199819+00	جاهز
46dac945-4bad-432c-b200-62861b371f18	REP-302	أداء الطلاب الربع سنوي	أكاديمي	منى منصور	2026-06-26 00:09:59.199819+00	جاهز
9a31c9ee-357e-44cb-8c17-7f3c04ddba21	REP-303	غياب الطلاب خلال الأسبوع	حضور	نادر علي	2026-06-26 00:09:59.199819+00	قيد التجهيز
9e7170a5-cad8-4a22-b2ea-7f94ce71df49	REP-304	تقرير النظام والعمليات	نظام	المدير	2026-06-26 00:09:59.199819+00	جاهز
7f16eb42-2eaa-4429-b38c-42e15d2f83de	REP-305	التقرير المالي لشهر أبريل	مالي	أحمد سامي	2026-06-26 00:09:59.199819+00	جاهز
e7b52bb1-4463-4e05-b413-087e74da62a0	REP-697	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-06 14:25:55.025473+00	قيد التجهيز
52469568-b402-47ae-9a0b-dc69c3b3e4ec	REP-383	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-06 17:08:07.793747+00	قيد التجهيز
d746e692-cc84-4005-9ca8-29ad12847f9b	REP-359	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-08 09:24:10.214492+00	قيد التجهيز
a16099ef-b1e9-4080-829d-1385b8bb5cae	REP-467	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-08 12:30:24.800531+00	قيد التجهيز
3641b1c6-2549-4603-a5c2-dca91c6f02b5	REP-492	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-08 12:30:45.960922+00	قيد التجهيز
5c76f906-96df-4849-9f88-c8e33f19dbde	REP-673	تقرير مخصص جديد	أكاديمي	الأدمن	2026-07-13 19:48:34.569294+00	قيد التجهيز
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."settings" ("id", "key", "value", "updated_at") FROM stdin;
ae74dc5d-7b16-45d6-80d9-db76b24c801e	global	{"profile": {"bio": "مدير منصة تعليمية متخصصة في الدورات التقنية.", "email": "admin@test.com", "phone": "+20 100 123 4567", "lastName": "أحمد", "firstName": "محمد"}, "security": {"allowRegistrations": true, "requireEmailVerification": false}, "preferences": {"darkMode": false, "neonPreset": "cyan-blue", "activeColor": "rose", "autoPublish": false, "lightPreset": "navy-gold"}, "notifications": {"smsNotif": false, "pushNotif": true, "emailNotif": true, "weeklyReport": true, "marketingNotif": false}}	2026-07-13 19:50:03.047+00
\.


--
-- Data for Name: site_content; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."site_content" ("section", "value", "updated_at") FROM stdin;
hero	{"badge": "منصة الرياضيات الأولى للثانوية العامة", "cta1Href": "#stages", "cta1Text": "اختار مرحلتك الدراسية.", "cta2Href": "#features", "cta2Text": "اعرف أكتر عن المنصة.", "miniStats": [{"label": "سنة خبرة", "value": 25, "prefix": "+", "suffix": ""}, {"label": "طالب", "value": 48, "prefix": "+", "suffix": " ألف"}, {"label": "نسبة رضا", "value": 98, "prefix": "٪", "suffix": ""}], "pillLabels": ["تكامل.", "تفاضل.", "جبر.", "إحصاء.", "ادبي"], "titleLine1": "الرياضيات مش صعبة، ي ولاد", "titleLine2": "هي بس محتاجة {highlight} صح", "description": "مع الأستاذ محمد عبدالسلام هتفهم كل فكرة من جذورها، وتتدرّب لحد ما المسألة تبقى أسهل حاجة. اختار مرحلتك وابدأ رحلتك للتفوق.", "trustPoints": ["أول حصة مجانًا.", "إلغاء في أي وقت.", "متابعة مع ولي الأمر."], "titleHighlight": "مُعلّم", "teacherImageAlt": "الأستاذ عبد السلام، مدرس الرياضيات", "teacherImageDark": "/teacher-abdelsalam-dark.webp", "teacherImageLight": "https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/8979dd5b-a082-4ca3-8317-50155884e961.webp"}	2026-07-06 21:12:09.863+00
features	{"badge": "إزاي بنذاكر مع بعض.", "items": [{"icon": "lightbulb", "step": "٠١", "title": "شرح مبسّط ومتدرّج", "description": "كل فكرة بتتشرح من الصفر بأسلوب سهل يوصّل المعلومة لأي طالب مهما كان مستواه."}, {"icon": "video", "step": "٠٢", "title": "فيديوهات عالية الجودة", "description": "حصص مسجّلة بجودة عالية تقدر تتفرج عليها وتعيدها في أي وقت ومن أي مكان."}, {"icon": "clipboard", "step": "٠٣.", "title": "بنك أسئلة وامتحانات", "description": "آلاف المسائل والامتحانات التفاعلية مع تصحيح فوري يثبّت المعلومة بعد كل درس."}, {"icon": "chart", "step": "٠٤", "title": "متابعة وتقارير", "description": "تقارير دورية للطالب وولي الأمر توضّح التقدّم ونقاط القوة والضعف أول بأول."}], "title": "نظام تعليمي متكامل، مبني على خطوات واضحة..", "description": "مش مجرد فيديوهات؛ ده مسار متدرّج يمسكك من أول فكرة لحد ما تدخل الامتحان واثق من نفسك.."}	2026-07-06 21:12:52.665+00
footer	{"phone": "01111111111", "address": "القاهرة، جمهورية مصر العربية", "siteName": "محد عبد السلام", "copyright": "© {year} منصة الأستاذ عبد السلام للرياضيات — جميع الحقوق محفوظة ..", "quickLinks": [{"href": "#hero", "label": "الرئيسية"}, {"href": "#features", "label": "مميزاتنا"}, {"href": "#stages", "label": "المراحل الدراسية"}, {"href": "/student", "label": "تسجيل الدخول"}], "description": "منصة تعليمية متخصصة في الرياضيات لجميع المراحل الدراسية، بأسلوب شرح مبسّط ومتابعة مستمرة لضمان تفوّق كل طالب.", "siteTagline": "أستاذ الرياضيات", "socialLinks": [{"href": "#", "enabled": true, "platform": "website"}, {"href": "#", "enabled": true, "platform": "telegram"}, {"href": "#", "enabled": true, "platform": "whatsapp"}, {"href": "#", "enabled": true, "platform": "youtube"}, {"href": "#", "enabled": true, "platform": "facebook"}, {"href": "#", "enabled": true, "platform": "instagram"}, {"href": "", "enabled": true, "platform": "tiktok"}, {"href": "", "enabled": true, "platform": "twitter"}]}	2026-07-06 21:14:24.647+00
seo	{"title": "الأستاذ عبد السلام | منصة الرياضيات للثانوية العامة", "loaderText": "جاري تجهيز المنصة...", "description": "منصة تعليمية متكاملة لشرح مادة الرياضيات للمرحلة الثانوية. ابدأ الآن واضمن تفوقك.", "loaderEquation": "fgk"}	2026-07-08 10:01:05.414+00
navbar	{"links": [{"href": "#features", "label": "المنهج"}, {"href": "#stages", "label": "المراحل"}, {"href": "#stats", "label": "أرقامنا"}, {"href": "#testimonials", "label": "آراء الطلاب"}], "logoUrl": "https://ndfhplawpqsiktkwoyxd.supabase.co/storage/v1/object/public/media/images/83e56ed7-90ea-4232-95b3-56c6f19075e8.png", "siteName": "محمد عبد السلام", "ctaLoginText": "تسجيل الدخول", "ctaAccountText": "حسابي", "ctaRegisterText": "ابدأ الآن"}	2026-07-15 18:23:14.272+00
login_panel	{"badge": "منصة الرياضيات الأولى للثانوية العامة", "perks": ["شرح مبسّط لكل درس خطوة بخطوة", "امتحانات بعد كل درس تثبّت المعلومة", "متابعة مستمرة لمستواك ودرجاتك"], "stats": [{"label": "طالب وطالبة", "value": "+48k"}, {"label": "نسبة رضا", "value": "98%"}, {"label": "سنة خبرة", "value": "+25"}], "logoUrl": "", "headline": "الرياضيات مش صعبة، هي بس محتاجة مُعلّم صح.", "brandName": "محمد عبدالسلام"}	2026-07-15 23:06:34.77+00
\.


--
-- Data for Name: site_theme; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."site_theme" ("id", "active_color", "updated_at", "neon_preset", "light_preset") FROM stdin;
t	rose	2026-07-13 19:50:03.112+00	cyan-blue	navy-gold
\.


--
-- Data for Name: stages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."stages" ("id", "slug", "idx", "title", "subtitle", "rows", "formula", "image", "accent", "term_price", "term_old_price", "sort_order", "created_at") FROM stdin;
d95cbf45-9218-419b-a579-f47ee77eebc5	sec-1	٠١	الصف الأول الثانوي	الأساس المتين: جبر، حساب مثلثات، وهندسة تحليلية تبني بيها باقي السنين.	{"الجبر والمتطابقات","حساب المثلثات","الهندسة التحليلية"}	sin²θ + cos²θ = 1	/stages/sec-1.png	emerald	750	1100	1	2026-06-26 03:16:39.338668+00
47ba8d28-3fda-42bf-a9e6-9ed892379367	sec-2	٠٢	الصف الثاني الثانوي	نقطة التحول: تفاضل وتكامل، ميكانيكا، وإحصاء بأسلوب يخلّيها سهلة.	{"التفاضل والتكامل",الميكانيكا,"الإحصاء والاحتمالات"}	d/dx [xⁿ] = n·xⁿ⁻¹	/stages/sec-2.png	gold	850	1300	2	2026-06-26 03:16:39.338668+00
35cbe80b-5e06-4787-945e-2de7f8441459	sec-3	٠٣	الصف الثالث الثانوي	سنة الحسم: مراجعة شاملة واستعداد كامل لامتحان الثانوية العامة.	{"الرياضيات البحتة","الرياضيات التطبيقية",الديناميكا}	∫ₐᵇ f(x) dx	/stages/sec-3.png	emerald	1100	1600	3	2026-06-26 03:16:39.338668+00
\.


--
-- Data for Name: streaming_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."streaming_settings" ("id", "enabled", "worker_cpu_threads", "worker_ram_mb", "worker_concurrency", "renditions", "segment_duration_sec", "updated_at") FROM stdin;
1	t	2	2048	1	[{"name": "360p", "width": 640, "height": 360, "abitrate": "64k", "vbitrate": "600k"}, {"name": "480p", "width": 854, "height": 480, "abitrate": "96k", "vbitrate": "1200k"}, {"name": "720p", "width": 1280, "height": 720, "abitrate": "128k", "vbitrate": "2500k"}, {"name": "1080p", "width": 1920, "height": 1080, "abitrate": "192k", "vbitrate": "5000k"}]	4	2026-07-13 10:40:34.05604+00
\.


--
-- Data for Name: student_content_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."student_content_progress" ("id", "user_id", "item_type", "item_id", "status", "score", "created_at", "updated_at") FROM stdin;
0aa740d6-7033-4152-9477-a4587a4cf70c	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	lesson	554ef064-3f79-4865-90d9-e8ab802a1bb7	completed	\N	2026-07-03 05:16:42.618599+00	2026-07-03 05:16:42.579+00
2a3b772e-0d7f-4b66-962d-584559fdb1ef	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	eb5e198f-0be2-421d-b70a-8e8cb41a8385	completed	\N	2026-07-05 20:07:46.392752+00	2026-07-05 20:07:46.38+00
0db3e6e5-ebe4-45d6-808d-f57bf99bf9ee	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	ed4535ed-d695-4a64-b67c-272f8e610c1b	completed	\N	2026-07-05 20:15:35.78455+00	2026-07-05 20:15:35.776+00
7574e79a-439b-4e89-aad3-429577dcc0d3	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	46dfbab9-2038-4146-ae09-3cee2a1d11d1	completed	\N	2026-07-05 20:15:40.078529+00	2026-07-05 20:15:40.064+00
03af5032-1a63-4c0e-9cfc-93a5a1594c2a	80aeee02-e678-40f6-ace8-20a9a0b575cd	lesson	61e5b2cd-8a4e-478c-ac01-7a2823652845	completed	\N	2026-07-07 13:15:41.68919+00	2026-07-07 13:15:41.664+00
8815117a-9e12-495e-ad9a-795f4d1febae	80aeee02-e678-40f6-ace8-20a9a0b575cd	lesson	79ad4833-3a1e-455c-a832-167cdffefbde	completed	\N	2026-07-07 13:15:48.069023+00	2026-07-07 13:15:48.057+00
f4a73538-7d9f-40f6-ae2e-006de89c50ca	80aeee02-e678-40f6-ace8-20a9a0b575cd	lesson	bad3b376-641e-4427-9749-5698a2383035	completed	\N	2026-07-07 13:15:51.528583+00	2026-07-07 13:15:51.52+00
f9106554-e87f-440c-afb5-48b6d3a5516b	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	assignment	cd47b669-dafa-4a86-a35f-93a597139058	مصحّح	5	2026-07-08 08:58:05.273062+00	2026-07-08 08:58:05.256+00
82548acf-6e2c-4588-ac73-e6eb2501c6b4	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	assignment	5d82993c-f0d3-40e3-aa30-f8da0c9a4459	مصحّح	0	2026-07-08 08:58:24.704539+00	2026-07-08 08:58:24.696+00
195da52f-c769-442f-9b8f-9f53e12c02b8	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	13db3541-5e7b-4e5c-b646-f60c8e13e7bd	completed	\N	2026-07-08 09:05:41.998937+00	2026-07-08 09:05:41.989+00
16785b2b-ac24-4c83-83da-4dabb2a451a1	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	5c9a529f-afb2-4cb2-ba44-2be3d26f1f58	completed	\N	2026-07-08 09:05:46.797483+00	2026-07-08 09:05:46.764+00
9d18eb5a-e226-4187-9292-e9d38e5d0bfb	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	lesson	04b37bd4-b293-467f-a0a2-5048f9eeb6ab	completed	\N	2026-07-08 09:05:50.365555+00	2026-07-08 09:05:50.353+00
55402d5c-e186-4b3e-b64b-d8db79d7774a	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	assignment	da7b9c07-de54-4195-8b3a-fb48faf86da2	مصحّح	0	2026-07-08 09:06:01.451904+00	2026-07-08 09:06:01.442+00
0af6b823-f3af-4dce-b7ca-02c93026d788	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	assignment	135df3bc-9c2b-45cd-8723-218f4189e2f1	مصحّح	10	2026-07-08 09:06:09.839247+00	2026-07-08 09:06:09.832+00
\.


--
-- Data for Name: student_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."student_devices" ("id", "student_id", "browser", "os", "device_type", "ip", "city", "country", "last_active", "sessions", "created_at") FROM stdin;
906cd4ac-c07d-4a40-8ad0-a489d635860d	99571d20-0630-4bfb-bb89-4dae4ef8e5c4	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
b6778ad2-12a1-485b-9279-a6b4781d51a3	d9cac849-cd6b-4b3d-b0e9-0bb7a5f67e3a	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
d17137cb-6586-4032-b0d8-6afd61709b64	b1f4d704-6007-4279-9900-295a693be228	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
73cefcaf-78c6-4284-948f-f12a6d213327	1474b992-b959-417f-a891-c9e221cd0744	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
dfef728d-70b0-47bc-9557-960bb852f1e5	be6af4e1-dd23-4962-9a1e-38371ccebedb	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
7f4886a4-535e-4a99-89d4-71fd9e44bcbc	e02798d4-8108-4451-bf78-bc125c23d351	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
8dd4c534-a302-4175-b53b-1ea3ff39bb69	b7ac6501-4750-4144-8766-40c9e1fd2263	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
dbd600dc-21cf-49f9-a27d-42a8c187157b	a3caa1a8-00fe-452e-96e5-b826e5353024	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
93892e89-53da-44cd-b5d9-07be1a71a6c3	f5fc10fd-b136-4759-9ec7-90754626f907	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
1244bd97-de97-46d4-9da9-927423d65639	625048f2-3bc5-4765-9ce8-fdf14b534ce5	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
e456fcc7-c81c-47c6-8da6-52c86dd583f9	30dfe825-efa0-4329-b673-15f927348f69	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
9e1e47a2-b2cc-4e3c-bde8-d26e7b138b0d	4b49f94e-d2cd-43ad-88cf-affd409bada8	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
94a9198b-704f-40d0-b5ff-7d8a69713598	ffccb618-6637-4463-81c2-d8a97f94e63c	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
6bd1870c-71a0-43a1-b4a9-66fa73485b81	91b2644e-b3ff-4ea8-8b10-299d2204f2f3	Chrome 126	Windows 11	كمبيوتر مكتبي	156.200.1.45	القاهرة	مصر	2026-06-28 06:37:26.612803+00	45	2026-06-28 06:37:26.612803+00
\.


--
-- Data for Name: student_weekly_goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."student_weekly_goals" ("id", "student_id", "lessons_target", "hours_target", "assignments_target", "exams_target", "updated_at") FROM stdin;
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."students" ("id", "code", "user_id", "name", "email", "phone", "gender", "avatar", "courses", "progress", "spent", "status", "joined_at", "created_at", "stage_id", "last_seen_at") FROM stdin;
806700b9-4a98-48b5-9e2a-e19ff83b2647	STD-9114	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	عمار ابراهيم	mr0192@gmail.com	01122556530	ذكر	\N	0	0	0 ج.م	نشط	2026-07-13	2026-07-13 19:10:49.015555+00	d95cbf45-9218-419b-a579-f47ee77eebc5	2026-07-16 20:18:59.496+00
ffccb618-6637-4463-81c2-d8a97f94e63c	STD-9110	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	سيد	sayedxiv@gmail.com	01020962775	ذكر	\N	0	0	0 ج.م	نشط	2026-06-28	2026-06-28 03:21:39.137086+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	2026-07-12 16:23:14.185+00
b7ac6501-4750-4144-8766-40c9e1fd2263	STD-1035	\N	مريم حسن	mariam.hassan@email.com	0114 369 2580	أنثى	\N	6	88	3,100 ج.م	نشط	2024-05-25	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
d9cac849-cd6b-4b3d-b0e9-0bb7a5f67e3a	STD-1040	\N	يوسف محمد	youssef.mohamed@email.com	0122 456 7890	ذكر	\N	2	38	900 ج.م	نشط	2024-06-09	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
e02798d4-8108-4451-bf78-bc125c23d351	STD-1036	\N	محمود علي	mahmoud.ali@email.com	0106 852 7413	ذكر	\N	2	45	750 ج.م	نشط	2024-05-28	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
99571d20-0630-4bfb-bb89-4dae4ef8e5c4	STD-1041	\N	فاطمة الزهراء	fatma.az@gmail.com	0111 987 6543	أنثى	\N	3	64	1,350 ج.م	نشط	2024-06-11	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
b1f4d704-6007-4279-9900-295a693be228	STD-1039	\N	سارة محمود	sara.mahmoud@email.com	0109 321 6547	أنثى	\N	7	91	3,800 ج.م	نشط	2024-06-06	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
1474b992-b959-417f-a891-c9e221cd0744	STD-1038	\N	أحمد خالد	ahmed.khaled@email.com	0115 654 3210	ذكر	\N	1	12	450 ج.م	موقوف	2024-06-03	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
be6af4e1-dd23-4962-9a1e-38371ccebedb	STD-1037	\N	نورهان السيد	nourhan.elsayed@email.com	0128 741 9630	أنثى	\N	4	73	1,980 ج.م	نشط	2024-06-01	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
a3caa1a8-00fe-452e-96e5-b826e5353024	STD-1033	\N	ليلى عبد الله	laila.abdullah@email.com	0102 753 8520	أنثى	\N	1	8	300 ج.م	موقوف	2024-05-19	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
f5fc10fd-b136-4759-9ec7-90754626f907	STD-1034	\N	عمر فاروق	omar.farouk@email.com	0127 159 7530	ذكر	\N	3	57	1,200 ج.م	نشط	2024-05-22	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
625048f2-3bc5-4765-9ce8-fdf14b534ce5	STD-1042	71bbe139-a35d-494b-b6a0-bddfbc8bc73a	محمد إبراهيم	mohamed.ibrahim@email.com	01000000000	ذكر	\N	5	82	2,450 ج.م	نشط	2024-06-12	2026-06-25 20:54:18.865169+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
30dfe825-efa0-4329-b673-15f927348f69	STD-4901	7781f763-4944-457a-972f-50c57d7eda76	عمار ابراهيم	mr019722@gmail.com	01009771333	ذكر	\N	0	0	0 ج.م	نشط	2026-06-28	2026-06-28 03:21:38.751836+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
4b49f94e-d2cd-43ad-88cf-affd409bada8	STD-6147	9d9c8b71-b81e-4422-853a-8f2c9a7fef68	عمار	mr0197222@gmail.com	+201009781898	ذكر	\N	0	0	0 ج.م	نشط	2026-06-28	2026-06-28 03:21:38.950479+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
91b2644e-b3ff-4ea8-8b10-299d2204f2f3	STD-5111	79e42b41-dcf0-477b-9b19-2772b89a58ec	مم ulhv	mr01972222@gmail.com		ذكر	\N	0	0	0 ج.م	نشط	2026-06-28	2026-06-28 03:21:39.342761+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
f51b6eb3-e70d-4171-8d96-08384fe8cea9	STD-9111	62c739a6-1a9b-40f4-9faf-77be78ef8431	البتنجان المشوي	mashwi@test.com	010101010	ذكر	\N	0	0	0 ج.م	نشط	2026-07-02	2026-07-02 03:26:33.143541+00	47ba8d28-3fda-42bf-a9e6-9ed892379367	\N
d9ad65a0-8d21-4e42-97d3-2fc4fa8c6457	STD-9113	80aeee02-e678-40f6-ace8-20a9a0b575cd	ahmed ashraf	proahmedashraf0@gmail.com	+201021257615	ذكر	\N	0	0	0 ج.م	نشط	2026-07-07	2026-07-07 13:00:01.355041+00	35cbe80b-5e06-4787-945e-2de7f8441459	2026-07-07 13:25:09.403+00
\.


--
-- Data for Name: terms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."terms" ("id", "stage_id", "title", "price", "old_price", "sort_order", "created_at") FROM stdin;
\.


--
-- Data for Name: video_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."video_jobs" ("id", "video_id", "status", "attempts", "last_error", "claimed_by", "claimed_at", "completed_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY "public"."videos" ("id", "lesson_id", "r2_raw_key", "r2_hls_prefix", "status", "duration_sec", "error_message", "renditions", "file_size_bytes", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: page_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."page_views_id_seq"', 538, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");


--
-- Name: assignment_questions assignment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_questions"
    ADD CONSTRAINT "assignment_questions_pkey" PRIMARY KEY ("id");


--
-- Name: assignment_submissions assignment_submissions_assignment_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");


--
-- Name: assignment_submissions assignment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id");


--
-- Name: assignments assignments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_code_key" UNIQUE ("code");


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");


--
-- Name: assistant_permissions assistant_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assistant_permissions"
    ADD CONSTRAINT "assistant_permissions_pkey" PRIMARY KEY ("id");


--
-- Name: assistant_permissions assistant_permissions_profile_id_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assistant_permissions"
    ADD CONSTRAINT "assistant_permissions_profile_id_resource_key" UNIQUE ("profile_id", "resource");


--
-- Name: auth_logs auth_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id");


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");


--
-- Name: branches branches_stage_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_stage_id_slug_key" UNIQUE ("stage_id", "slug");


--
-- Name: calendar_events calendar_events_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_code_key" UNIQUE ("code");


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");


--
-- Name: cart_items cart_items_student_id_lecture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_student_id_lecture_id_key" UNIQUE ("student_id", "lecture_id");


--
-- Name: categories categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_code_key" UNIQUE ("code");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");


--
-- Name: coupon_lectures coupon_lectures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_lectures"
    ADD CONSTRAINT "coupon_lectures_pkey" PRIMARY KEY ("coupon_id", "lecture_id");


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");


--
-- Name: coupons coupons_display_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_display_code_key" UNIQUE ("display_code");


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");


--
-- Name: course_lessons course_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."course_lessons"
    ADD CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id");


--
-- Name: course_sections course_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."course_sections"
    ADD CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id");


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_code_key" UNIQUE ("code");


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");


--
-- Name: enrollments enrollments_student_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_course_id_key" UNIQUE ("student_id", "course_id");


--
-- Name: exam_answers exam_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id");


--
-- Name: exam_questions exam_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id");


--
-- Name: exam_submissions exam_submissions_exam_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_exam_id_student_id_key" UNIQUE ("exam_id", "student_id");


--
-- Name: exam_submissions exam_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_pkey" PRIMARY KEY ("id");


--
-- Name: exams exams_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_code_key" UNIQUE ("code");


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_pkey" PRIMARY KEY ("id");


--
-- Name: learning_activity learning_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."learning_activity"
    ADD CONSTRAINT "learning_activity_pkey" PRIMARY KEY ("id");


--
-- Name: learning_activity learning_activity_student_id_activity_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."learning_activity"
    ADD CONSTRAINT "learning_activity_student_id_activity_date_key" UNIQUE ("student_id", "activity_date");


--
-- Name: lecture_playback_sessions lecture_playback_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lecture_playback_sessions"
    ADD CONSTRAINT "lecture_playback_sessions_pkey" PRIMARY KEY ("user_id", "lesson_id");


--
-- Name: lectures lectures_branch_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_branch_id_slug_key" UNIQUE ("branch_id", "slug");


--
-- Name: lectures lectures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_pkey" PRIMARY KEY ("id");


--
-- Name: lesson_progress lesson_progress_enrollment_id_lesson_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_enrollment_id_lesson_id_key" UNIQUE ("enrollment_id", "lesson_id");


--
-- Name: lesson_progress lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id");


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");


--
-- Name: messages messages_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_code_key" UNIQUE ("code");


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");


--
-- Name: monthly_course_sections monthly_course_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_course_sections"
    ADD CONSTRAINT "monthly_course_sections_pkey" PRIMARY KEY ("id");


--
-- Name: monthly_courses monthly_courses_branch_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_courses"
    ADD CONSTRAINT "monthly_courses_branch_id_slug_key" UNIQUE ("branch_id", "slug");


--
-- Name: monthly_courses monthly_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_courses"
    ADD CONSTRAINT "monthly_courses_pkey" PRIMARY KEY ("id");


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "student_id");


--
-- Name: notifications notifications_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_code_key" UNIQUE ("code");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_code_key" UNIQUE ("code");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");


--
-- Name: payments payments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_code_key" UNIQUE ("code");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: reports reports_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_code_key" UNIQUE ("code");


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_key_key" UNIQUE ("key");


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("section");


--
-- Name: site_theme site_theme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."site_theme"
    ADD CONSTRAINT "site_theme_pkey" PRIMARY KEY ("id");


--
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_pkey" PRIMARY KEY ("id");


--
-- Name: stages stages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_slug_key" UNIQUE ("slug");


--
-- Name: streaming_settings streaming_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."streaming_settings"
    ADD CONSTRAINT "streaming_settings_pkey" PRIMARY KEY ("id");


--
-- Name: student_content_progress student_content_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_content_progress"
    ADD CONSTRAINT "student_content_progress_pkey" PRIMARY KEY ("id");


--
-- Name: student_content_progress student_content_progress_user_id_item_type_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_content_progress"
    ADD CONSTRAINT "student_content_progress_user_id_item_type_item_id_key" UNIQUE ("user_id", "item_type", "item_id");


--
-- Name: student_devices student_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_devices"
    ADD CONSTRAINT "student_devices_pkey" PRIMARY KEY ("id");


--
-- Name: student_devices student_devices_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_devices"
    ADD CONSTRAINT "student_devices_student_id_key" UNIQUE ("student_id");


--
-- Name: student_weekly_goals student_weekly_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_weekly_goals"
    ADD CONSTRAINT "student_weekly_goals_pkey" PRIMARY KEY ("id");


--
-- Name: student_weekly_goals student_weekly_goals_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_weekly_goals"
    ADD CONSTRAINT "student_weekly_goals_student_id_key" UNIQUE ("student_id");


--
-- Name: students students_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_code_key" UNIQUE ("code");


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");


--
-- Name: terms terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."terms"
    ADD CONSTRAINT "terms_pkey" PRIMARY KEY ("id");


--
-- Name: video_jobs video_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."video_jobs"
    ADD CONSTRAINT "video_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");


--
-- Name: cart_items_student_lecture_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cart_items_student_lecture_unique" ON "public"."cart_items" USING "btree" ("student_id", "lecture_id") WHERE ("lecture_id" IS NOT NULL);


--
-- Name: cart_items_student_monthly_course_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cart_items_student_monthly_course_unique" ON "public"."cart_items" USING "btree" ("student_id", "monthly_course_id") WHERE ("monthly_course_id" IS NOT NULL);


--
-- Name: courses_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "courses_branch_idx" ON "public"."courses" USING "btree" ("branch_id");


--
-- Name: exam_answers_question_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exam_answers_question_idx" ON "public"."exam_answers" USING "btree" ("question_id");


--
-- Name: exam_answers_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exam_answers_submission_idx" ON "public"."exam_answers" USING "btree" ("submission_id");


--
-- Name: exams_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "exams_branch_idx" ON "public"."exams" USING "btree" ("branch_id");


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activity_logs_action" ON "public"."activity_logs" USING "btree" ("action");


--
-- Name: idx_activity_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activity_logs_actor_id" ON "public"."activity_logs" USING "btree" ("actor_id");


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at" DESC);


--
-- Name: idx_activity_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activity_logs_resource" ON "public"."activity_logs" USING "btree" ("resource");


--
-- Name: idx_activity_logs_target_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_activity_logs_target_id" ON "public"."activity_logs" USING "btree" ("target_id");


--
-- Name: idx_assignments_lecture_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_lecture_id" ON "public"."assignments" USING "btree" ("lecture_id");


--
-- Name: idx_assistant_permissions_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assistant_permissions_profile" ON "public"."assistant_permissions" USING "btree" ("profile_id");


--
-- Name: idx_auth_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_logs_actor_id" ON "public"."auth_logs" USING "btree" ("actor_id");


--
-- Name: idx_auth_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_auth_logs_created_at" ON "public"."auth_logs" USING "btree" ("created_at" DESC);


--
-- Name: idx_branches_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_branches_stage" ON "public"."branches" USING "btree" ("stage_id");


--
-- Name: idx_cart_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cart_student" ON "public"."cart_items" USING "btree" ("student_id");


--
-- Name: idx_lectures_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lectures_branch" ON "public"."lectures" USING "btree" ("branch_id");


--
-- Name: idx_lessons_lecture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lessons_lecture" ON "public"."lessons" USING "btree" ("lecture_id");


--
-- Name: idx_lessons_lecture_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lessons_lecture_id" ON "public"."lessons" USING "btree" ("lecture_id");


--
-- Name: idx_messages_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_messages_student" ON "public"."messages" USING "btree" ("student_id");


--
-- Name: idx_notifications_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_branch" ON "public"."notifications" USING "btree" ("branch_id");


--
-- Name: idx_notifications_lecture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_lecture" ON "public"."notifications" USING "btree" ("lecture_id");


--
-- Name: idx_notifications_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_stage" ON "public"."notifications" USING "btree" ("stage_id");


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");


--
-- Name: idx_orders_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_student" ON "public"."orders" USING "btree" ("student_id");


--
-- Name: idx_page_views_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_page_views_created_at" ON "public"."page_views" USING "btree" ("created_at" DESC);


--
-- Name: idx_page_views_created_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_page_views_created_visitor" ON "public"."page_views" USING "btree" ("created_at", "visitor_id");


--
-- Name: idx_page_views_visitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_page_views_visitor_id" ON "public"."page_views" USING "btree" ("visitor_id");


--
-- Name: idx_scp_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_scp_user" ON "public"."student_content_progress" USING "btree" ("user_id");


--
-- Name: idx_students_last_seen_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_students_last_seen_at" ON "public"."students" USING "btree" ("last_seen_at" DESC);


--
-- Name: learning_activity_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "learning_activity_student_idx" ON "public"."learning_activity" USING "btree" ("student_id", "activity_date" DESC);


--
-- Name: lectures_is_free_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lectures_is_free_idx" ON "public"."lectures" USING "btree" ("is_free") WHERE ("is_free" = true);


--
-- Name: lectures_mcs_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lectures_mcs_idx" ON "public"."lectures" USING "btree" ("monthly_course_section_id");


--
-- Name: lectures_monthly_course_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lectures_monthly_course_sort_idx" ON "public"."lectures" USING "btree" ("monthly_course_id", "course_sort_order", "sort_order");


--
-- Name: lessons_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lessons_video_id_idx" ON "public"."lessons" USING "btree" ("video_id");


--
-- Name: mcs_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mcs_course_idx" ON "public"."monthly_course_sections" USING "btree" ("monthly_course_id");


--
-- Name: mcs_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mcs_sort_idx" ON "public"."monthly_course_sections" USING "btree" ("monthly_course_id", "sort_order");


--
-- Name: monthly_courses_branch_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "monthly_courses_branch_sort_idx" ON "public"."monthly_courses" USING "btree" ("branch_id", "sort_order", "created_at");


--
-- Name: students_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "students_stage_idx" ON "public"."students" USING "btree" ("stage_id");


--
-- Name: video_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "video_jobs_status_idx" ON "public"."video_jobs" USING "btree" ("status");


--
-- Name: video_jobs_video_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "video_jobs_video_id_idx" ON "public"."video_jobs" USING "btree" ("video_id");


--
-- Name: videos_lesson_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videos_lesson_id_idx" ON "public"."videos" USING "btree" ("lesson_id");


--
-- Name: videos_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "videos_status_idx" ON "public"."videos" USING "btree" ("status");


--
-- Name: streaming_settings streaming_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "streaming_settings_updated_at" BEFORE UPDATE ON "public"."streaming_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: lectures validate_lecture_monthly_course_branch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "validate_lecture_monthly_course_branch" BEFORE INSERT OR UPDATE OF "branch_id", "monthly_course_id" ON "public"."lectures" FOR EACH ROW EXECUTE FUNCTION "public"."validate_lecture_monthly_course_branch"();


--
-- Name: video_jobs video_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "video_jobs_set_updated_at" BEFORE UPDATE ON "public"."video_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: videos videos_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "videos_set_updated_at" BEFORE UPDATE ON "public"."videos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: assignment_questions assignment_questions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_questions"
    ADD CONSTRAINT "assignment_questions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: assignment_submissions assignment_submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: assignment_submissions assignment_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: assignments assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;


--
-- Name: assignments assignments_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: assignments assignments_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE SET NULL;


--
-- Name: assistant_permissions assistant_permissions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assistant_permissions"
    ADD CONSTRAINT "assistant_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: auth_logs auth_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;


--
-- Name: branches branches_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_monthly_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_monthly_course_id_fkey" FOREIGN KEY ("monthly_course_id") REFERENCES "public"."monthly_courses"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_term_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE SET NULL;


--
-- Name: certificates certificates_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: coupon_lectures coupon_lectures_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_lectures"
    ADD CONSTRAINT "coupon_lectures_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE;


--
-- Name: coupon_lectures coupon_lectures_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."coupon_lectures"
    ADD CONSTRAINT "coupon_lectures_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: course_lessons course_lessons_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."course_lessons"
    ADD CONSTRAINT "course_lessons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE CASCADE;


--
-- Name: course_sections course_sections_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."course_sections"
    ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;


--
-- Name: courses courses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: exam_answers exam_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE CASCADE;


--
-- Name: exam_answers exam_answers_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_answers"
    ADD CONSTRAINT "exam_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."exam_submissions"("id") ON DELETE CASCADE;


--
-- Name: exam_questions exam_questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;


--
-- Name: exam_submissions exam_submissions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;


--
-- Name: exam_submissions exam_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: exams exams_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;


--
-- Name: exams exams_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE SET NULL;


--
-- Name: learning_activity learning_activity_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."learning_activity"
    ADD CONSTRAINT "learning_activity_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: lectures lectures_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;


--
-- Name: lectures lectures_monthly_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_monthly_course_id_fkey" FOREIGN KEY ("monthly_course_id") REFERENCES "public"."monthly_courses"("id") ON DELETE SET NULL;


--
-- Name: lectures lectures_monthly_course_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lectures"
    ADD CONSTRAINT "lectures_monthly_course_section_id_fkey" FOREIGN KEY ("monthly_course_section_id") REFERENCES "public"."monthly_course_sections"("id") ON DELETE SET NULL;


--
-- Name: lesson_progress lesson_progress_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE CASCADE;


--
-- Name: lessons lessons_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: lessons lessons_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE SET NULL;


--
-- Name: messages messages_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: monthly_course_sections monthly_course_sections_monthly_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_course_sections"
    ADD CONSTRAINT "monthly_course_sections_monthly_course_id_fkey" FOREIGN KEY ("monthly_course_id") REFERENCES "public"."monthly_courses"("id") ON DELETE CASCADE;


--
-- Name: monthly_courses monthly_courses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_courses"
    ADD CONSTRAINT "monthly_courses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;


--
-- Name: monthly_courses monthly_courses_term_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_courses"
    ADD CONSTRAINT "monthly_courses_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE SET NULL;


--
-- Name: notification_reads notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE SET NULL;


--
-- Name: order_items order_items_monthly_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_monthly_course_id_fkey" FOREIGN KEY ("monthly_course_id") REFERENCES "public"."monthly_courses"("id") ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_term_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE SET NULL;


--
-- Name: orders orders_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: student_content_progress student_content_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_content_progress"
    ADD CONSTRAINT "student_content_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: student_devices student_devices_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_devices"
    ADD CONSTRAINT "student_devices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: student_weekly_goals student_weekly_goals_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."student_weekly_goals"
    ADD CONSTRAINT "student_weekly_goals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;


--
-- Name: students students_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE SET NULL;


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: terms terms_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."terms"
    ADD CONSTRAINT "terms_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE CASCADE;


--
-- Name: video_jobs video_jobs_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."video_jobs"
    ADD CONSTRAINT "video_jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;


--
-- Name: videos videos_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;


--
-- Name: platform_settings Admins can update platform_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update platform_settings" ON "public"."platform_settings" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));


--
-- Name: platform_settings Anyone can read platform_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read platform_settings" ON "public"."platform_settings" FOR SELECT USING (true);


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs activity_logs_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "activity_logs_admin_select" ON "public"."activity_logs" FOR SELECT USING ("public"."is_full_admin"());


--
-- Name: learning_activity admin reads all activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin reads all activity" ON "public"."learning_activity" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: student_weekly_goals admin reads all goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin reads all goals" ON "public"."student_weekly_goals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: streaming_settings admin_all_streaming_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_all_streaming_settings" ON "public"."streaming_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: video_jobs admin_all_video_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_all_video_jobs" ON "public"."video_jobs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: videos admin_all_videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin_all_videos" ON "public"."videos" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: assistant_permissions ap_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ap_admin_all" ON "public"."assistant_permissions" USING ("public"."is_full_admin"()) WITH CHECK ("public"."is_full_admin"());


--
-- Name: assistant_permissions ap_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ap_read_own" ON "public"."assistant_permissions" FOR SELECT USING (("profile_id" = "auth"."uid"()));


--
-- Name: assignments asg_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asg_admin_all" ON "public"."assignments" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: assignments asg_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asg_student_select" ON "public"."assignments" FOR SELECT USING (("public"."is_admin"() OR "public"."owns_lecture_via_order"("lecture_id") OR ("lecture_id" IN ( SELECT "en"."course_id"
   FROM ("public"."enrollments" "en"
     JOIN "public"."students" "st" ON (("st"."id" = "en"."student_id")))
  WHERE ("st"."user_id" = "auth"."uid"())))));


--
-- Name: assignment_questions asgq_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asgq_admin_all" ON "public"."assignment_questions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: assignment_questions asgq_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asgq_student_select" ON "public"."assignment_questions" FOR SELECT USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "assignment_questions"."assignment_id") AND ("public"."owns_lecture_via_order"("a"."lecture_id") OR ("a"."lecture_id" IN ( SELECT "en"."course_id"
           FROM ("public"."enrollments" "en"
             JOIN "public"."students" "st" ON (("st"."id" = "en"."student_id")))
          WHERE ("st"."user_id" = "auth"."uid"())))))))));


--
-- Name: assignment_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assignment_questions" ENABLE ROW LEVEL SECURITY;

--
-- Name: assignment_questions assignment_questions_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignment_questions_assistant_manage" ON "public"."assignment_questions" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: assignment_questions assignment_questions_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignment_questions_assistant_view" ON "public"."assignment_questions" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: assignment_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assignment_submissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: assignment_submissions assignment_submissions_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignment_submissions_assistant_manage" ON "public"."assignment_submissions" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: assignment_submissions assignment_submissions_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignment_submissions_assistant_view" ON "public"."assignment_submissions" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments assignments_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignments_assistant_manage" ON "public"."assignments" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: assignments assignments_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignments_assistant_view" ON "public"."assignments" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: assistant_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assistant_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."auth_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_logs auth_logs_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_logs_admin_select" ON "public"."auth_logs" FOR SELECT USING ("public"."is_full_admin"());


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches_admin_all" ON "public"."branches" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: branches branches_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches_assistant_manage" ON "public"."branches" USING ("public"."has_permission"('categories'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('categories'::"text", 'manage'::"text"));


--
-- Name: branches branches_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches_assistant_view" ON "public"."branches" FOR SELECT USING ("public"."has_permission"('categories'::"text", 'view'::"text"));


--
-- Name: branches branches_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches_public_read" ON "public"."branches" FOR SELECT USING (true);


--
-- Name: calendar_events calendar_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_admin_all" ON "public"."calendar_events" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events calendar_events_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events_assistant_manage" ON "public"."calendar_events" USING ("public"."has_permission"('calendar'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('calendar'::"text", 'manage'::"text"));


--
-- Name: calendar_events calendar_events_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_events_assistant_view" ON "public"."calendar_events" FOR SELECT USING ("public"."has_permission"('calendar'::"text", 'view'::"text"));


--
-- Name: calendar_events calendar_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "calendar_select_authenticated" ON "public"."calendar_events" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: cart_items cart_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart_admin_read" ON "public"."cart_items" FOR SELECT USING ("public"."is_admin"());


--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items cart_items_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart_items_assistant_manage" ON "public"."cart_items" USING ("public"."has_permission"('payments'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('payments'::"text", 'manage'::"text"));


--
-- Name: cart_items cart_items_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart_items_assistant_view" ON "public"."cart_items" FOR SELECT USING ("public"."has_permission"('payments'::"text", 'view'::"text"));


--
-- Name: cart_items cart_student_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart_student_all" ON "public"."cart_items" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories_admin_all" ON "public"."categories" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: categories categories_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories_assistant_manage" ON "public"."categories" USING ("public"."has_permission"('categories'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('categories'::"text", 'manage'::"text"));


--
-- Name: categories categories_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories_assistant_view" ON "public"."categories" FOR SELECT USING ("public"."has_permission"('categories'::"text", 'view'::"text"));


--
-- Name: categories categories_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories_select_authenticated" ON "public"."categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: certificates cert_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cert_admin_all" ON "public"."certificates" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: certificates cert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cert_own" ON "public"."certificates" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;

--
-- Name: certificates certificates_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "certificates_assistant_manage" ON "public"."certificates" USING ("public"."has_permission"('students'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('students'::"text", 'manage'::"text"));


--
-- Name: certificates certificates_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "certificates_assistant_view" ON "public"."certificates" FOR SELECT USING ("public"."has_permission"('students'::"text", 'view'::"text"));


--
-- Name: coupon_lectures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."coupon_lectures" ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_lectures coupon_lectures_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupon_lectures_admin_all" ON "public"."coupon_lectures" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: coupon_lectures coupon_lectures_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupon_lectures_assistant_manage" ON "public"."coupon_lectures" USING ("public"."has_permission"('coupons'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('coupons'::"text", 'manage'::"text"));


--
-- Name: coupon_lectures coupon_lectures_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupon_lectures_assistant_view" ON "public"."coupon_lectures" FOR SELECT USING ("public"."has_permission"('coupons'::"text", 'view'::"text"));


--
-- Name: coupon_lectures coupon_lectures_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupon_lectures_select_auth" ON "public"."coupon_lectures" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons coupons_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupons_admin_all" ON "public"."coupons" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: coupons coupons_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupons_assistant_manage" ON "public"."coupons" USING ("public"."has_permission"('coupons'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('coupons'::"text", 'manage'::"text"));


--
-- Name: coupons coupons_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupons_assistant_view" ON "public"."coupons" FOR SELECT USING ("public"."has_permission"('coupons'::"text", 'view'::"text"));


--
-- Name: coupons coupons_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coupons_select_auth" ON "public"."coupons" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: course_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."course_lessons" ENABLE ROW LEVEL SECURITY;

--
-- Name: course_lessons course_lessons_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "course_lessons_assistant_manage" ON "public"."course_lessons" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: course_lessons course_lessons_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "course_lessons_assistant_view" ON "public"."course_lessons" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: course_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."course_sections" ENABLE ROW LEVEL SECURITY;

--
-- Name: course_sections course_sections_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "course_sections_assistant_manage" ON "public"."course_sections" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: course_sections course_sections_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "course_sections_assistant_view" ON "public"."course_sections" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;

--
-- Name: courses courses_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "courses_admin_all" ON "public"."courses" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: courses courses_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "courses_assistant_manage" ON "public"."courses" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: courses courses_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "courses_assistant_view" ON "public"."courses" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: courses courses_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "courses_select_authenticated" ON "public"."courses" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: student_devices devices_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "devices_admin_all" ON "public"."student_devices" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: student_devices devices_student_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "devices_student_own" ON "public"."student_devices" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: enrollments enroll_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enroll_admin_all" ON "public"."enrollments" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: enrollments enroll_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enroll_delete_own" ON "public"."enrollments" FOR DELETE USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: enrollments enroll_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enroll_insert_own" ON "public"."enrollments" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: enrollments enroll_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enroll_select_own" ON "public"."enrollments" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments enrollments_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enrollments_assistant_manage" ON "public"."enrollments" USING ("public"."has_permission"('students'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('students'::"text", 'manage'::"text"));


--
-- Name: enrollments enrollments_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enrollments_assistant_view" ON "public"."enrollments" FOR SELECT USING ("public"."has_permission"('students'::"text", 'view'::"text"));


--
-- Name: exam_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."exam_answers" ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_answers exam_answers_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_answers_admin_all" ON "public"."exam_answers" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: exam_answers exam_answers_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_answers_assistant_manage" ON "public"."exam_answers" USING ("public"."has_permission"('exams'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('exams'::"text", 'manage'::"text"));


--
-- Name: exam_answers exam_answers_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_answers_assistant_view" ON "public"."exam_answers" FOR SELECT USING ("public"."has_permission"('exams'::"text", 'view'::"text"));


--
-- Name: exam_answers exam_answers_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_answers_student_insert" ON "public"."exam_answers" FOR INSERT WITH CHECK (("submission_id" IN ( SELECT "s"."id"
   FROM ("public"."exam_submissions" "s"
     JOIN "public"."students" "st" ON (("st"."id" = "s"."student_id")))
  WHERE ("st"."user_id" = "auth"."uid"()))));


--
-- Name: exam_answers exam_answers_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_answers_student_select" ON "public"."exam_answers" FOR SELECT USING (("submission_id" IN ( SELECT "s"."id"
   FROM ("public"."exam_submissions" "s"
     JOIN "public"."students" "st" ON (("st"."id" = "s"."student_id")))
  WHERE ("st"."user_id" = "auth"."uid"()))));


--
-- Name: exam_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."exam_questions" ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_questions exam_questions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_questions_admin_all" ON "public"."exam_questions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: exam_questions exam_questions_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_questions_assistant_manage" ON "public"."exam_questions" USING ("public"."has_permission"('exams'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('exams'::"text", 'manage'::"text"));


--
-- Name: exam_questions exam_questions_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_questions_assistant_view" ON "public"."exam_questions" FOR SELECT USING ("public"."has_permission"('exams'::"text", 'view'::"text"));


--
-- Name: exam_questions exam_questions_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_questions_student_select" ON "public"."exam_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."exams" "e"
  WHERE (("e"."id" = "exam_questions"."exam_id") AND ("e"."status" = 'منشور'::"text") AND (("e"."branch_id" IS NULL) OR ("e"."branch_id" IN ( SELECT "l"."branch_id"
           FROM (("public"."enrollments" "en"
             JOIN "public"."lectures" "l" ON (("l"."id" = "en"."course_id")))
             JOIN "public"."students" "st" ON (("st"."id" = "en"."student_id")))
          WHERE (("st"."user_id" = "auth"."uid"()) AND ("l"."branch_id" IS NOT NULL)))))))));


--
-- Name: exam_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."exam_submissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_submissions exam_submissions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_admin_all" ON "public"."exam_submissions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: exam_submissions exam_submissions_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_assistant_manage" ON "public"."exam_submissions" USING ("public"."has_permission"('exams'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('exams'::"text", 'manage'::"text"));


--
-- Name: exam_submissions exam_submissions_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_assistant_view" ON "public"."exam_submissions" FOR SELECT USING ("public"."has_permission"('exams'::"text", 'view'::"text"));


--
-- Name: exam_submissions exam_submissions_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_student_insert" ON "public"."exam_submissions" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: exam_submissions exam_submissions_student_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_student_own" ON "public"."exam_submissions" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: exam_submissions exam_submissions_student_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exam_submissions_student_update" ON "public"."exam_submissions" FOR UPDATE USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))) WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."exams" ENABLE ROW LEVEL SECURITY;

--
-- Name: exams exams_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exams_admin_all" ON "public"."exams" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: exams exams_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exams_assistant_manage" ON "public"."exams" USING ("public"."has_permission"('exams'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('exams'::"text", 'manage'::"text"));


--
-- Name: exams exams_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exams_assistant_view" ON "public"."exams" FOR SELECT USING ("public"."has_permission"('exams'::"text", 'view'::"text"));


--
-- Name: exams exams_select_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exams_select_published" ON "public"."exams" FOR SELECT USING (("status" <> 'مسودة'::"text"));


--
-- Name: learning_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."learning_activity" ENABLE ROW LEVEL SECURITY;

--
-- Name: lecture_playback_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lecture_playback_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: lectures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lectures" ENABLE ROW LEVEL SECURITY;

--
-- Name: lectures lectures_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lectures_admin_all" ON "public"."lectures" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: lectures lectures_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lectures_assistant_manage" ON "public"."lectures" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: lectures lectures_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lectures_assistant_view" ON "public"."lectures" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: lectures lectures_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lectures_public_read" ON "public"."lectures" FOR SELECT USING (true);


--
-- Name: lesson_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lesson_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_progress lesson_progress_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lesson_progress_assistant_manage" ON "public"."lesson_progress" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: lesson_progress lesson_progress_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lesson_progress_assistant_view" ON "public"."lesson_progress" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;

--
-- Name: course_lessons lessons_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_admin_all" ON "public"."course_lessons" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: lessons lessons_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_admin_all" ON "public"."lessons" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: lessons lessons_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_assistant_manage" ON "public"."lessons" USING ("public"."has_permission"('courses'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('courses'::"text", 'manage'::"text"));


--
-- Name: lessons lessons_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_assistant_view" ON "public"."lessons" FOR SELECT USING ("public"."has_permission"('courses'::"text", 'view'::"text"));


--
-- Name: lessons lessons_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_public_read" ON "public"."lessons" FOR SELECT USING (true);


--
-- Name: course_lessons lessons_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lessons_select_auth" ON "public"."course_lessons" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: monthly_course_sections mcs_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mcs_admin_delete" ON "public"."monthly_course_sections" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: monthly_course_sections mcs_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mcs_admin_insert" ON "public"."monthly_course_sections" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: monthly_course_sections mcs_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mcs_admin_update" ON "public"."monthly_course_sections" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: monthly_course_sections mcs_readable_by_everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mcs_readable_by_everyone" ON "public"."monthly_course_sections" FOR SELECT USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_admin_all" ON "public"."messages" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: messages messages_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_assistant_manage" ON "public"."messages" USING ("public"."has_permission"('messages'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('messages'::"text", 'manage'::"text"));


--
-- Name: messages messages_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_assistant_view" ON "public"."messages" FOR SELECT USING ("public"."has_permission"('messages'::"text", 'view'::"text"));


--
-- Name: messages messages_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_student_insert" ON "public"."messages" FOR INSERT WITH CHECK (("student_id" = "auth"."uid"()));


--
-- Name: messages messages_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_student_select" ON "public"."messages" FOR SELECT USING (("auth"."uid"() = "student_id"));


--
-- Name: messages messages_student_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages_student_update" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));


--
-- Name: monthly_course_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."monthly_course_sections" ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."monthly_courses" ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_courses monthly_courses_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "monthly_courses_admin_all" ON "public"."monthly_courses" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: monthly_courses monthly_courses_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "monthly_courses_public_read" ON "public"."monthly_courses" FOR SELECT USING (("is_published" OR "public"."is_admin"()));


--
-- Name: notification_reads notif_reads_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif_reads_admin" ON "public"."notification_reads" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: notification_reads notif_reads_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif_reads_own" ON "public"."notification_reads" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))) WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: notification_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_reads" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_reads notification_reads_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_reads_assistant_manage" ON "public"."notification_reads" USING ("public"."has_permission"('notifications'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('notifications'::"text", 'manage'::"text"));


--
-- Name: notification_reads notification_reads_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_reads_assistant_view" ON "public"."notification_reads" FOR SELECT USING ("public"."has_permission"('notifications'::"text", 'view'::"text"));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_admin_all" ON "public"."notifications" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: notifications notifications_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_assistant_manage" ON "public"."notifications" USING ("public"."has_permission"('notifications'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('notifications'::"text", 'manage'::"text"));


--
-- Name: notifications notifications_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_assistant_view" ON "public"."notifications" FOR SELECT USING ("public"."has_permission"('notifications'::"text", 'view'::"text"));


--
-- Name: notifications notifications_student; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_student" ON "public"."notifications" FOR SELECT USING ((("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))) OR ("student_id" IS NULL)));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_admin_all" ON "public"."order_items" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: order_items order_items_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_assistant_manage" ON "public"."order_items" USING ("public"."has_permission"('payments'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('payments'::"text", 'manage'::"text"));


--
-- Name: order_items order_items_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_assistant_view" ON "public"."order_items" FOR SELECT USING ("public"."has_permission"('payments'::"text", 'view'::"text"));


--
-- Name: order_items order_items_student_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_student_delete" ON "public"."order_items" FOR DELETE USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."student_id" = "auth"."uid"()))));


--
-- Name: order_items order_items_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_student_insert" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."student_id" = "auth"."uid"())))));


--
-- Name: order_items order_items_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items_student_select" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."student_id" = "auth"."uid"())))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders_admin_all" ON "public"."orders" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: orders orders_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders_assistant_manage" ON "public"."orders" USING ("public"."has_permission"('payments'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('payments'::"text", 'manage'::"text"));


--
-- Name: orders orders_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders_assistant_view" ON "public"."orders" FOR SELECT USING ("public"."has_permission"('payments'::"text", 'view'::"text"));


--
-- Name: orders orders_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders_student_insert" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));


--
-- Name: orders orders_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders_student_select" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "student_id"));


--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views page_views_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "page_views_admin_select" ON "public"."page_views" FOR SELECT USING ("public"."is_full_admin"());


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_admin_all" ON "public"."payments" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: payments payments_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_assistant_manage" ON "public"."payments" USING ("public"."has_permission"('payments'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('payments'::"text", 'manage'::"text"));


--
-- Name: payments payments_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_assistant_view" ON "public"."payments" FOR SELECT USING ("public"."has_permission"('payments'::"text", 'view'::"text"));


--
-- Name: payments payments_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_insert_own" ON "public"."payments" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: payments payments_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: payments payments_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments_update_own" ON "public"."payments" FOR UPDATE USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))) WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_assistant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_assistant_read" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."has_permission"('students'::"text", 'view'::"text")));


--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: profiles profiles_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));


--
-- Name: profiles profiles_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_update_own_or_admin" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR "public"."is_admin"()));


--
-- Name: lesson_progress progress_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "progress_admin_all" ON "public"."lesson_progress" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: lesson_progress progress_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "progress_own" ON "public"."lesson_progress" USING (("enrollment_id" IN ( SELECT "e"."id"
   FROM ("public"."enrollments" "e"
     JOIN "public"."students" "s" ON (("s"."id" = "e"."student_id")))
  WHERE ("s"."user_id" = "auth"."uid"())))) WITH CHECK (("enrollment_id" IN ( SELECT "e"."id"
   FROM ("public"."enrollments" "e"
     JOIN "public"."students" "s" ON (("s"."id" = "e"."student_id")))
  WHERE ("s"."user_id" = "auth"."uid"()))));


--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: reports reports_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reports_admin_all" ON "public"."reports" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: reports reports_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reports_assistant_manage" ON "public"."reports" USING ("public"."has_permission"('reports'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('reports'::"text", 'manage'::"text"));


--
-- Name: reports reports_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reports_assistant_view" ON "public"."reports" FOR SELECT USING ("public"."has_permission"('reports'::"text", 'view'::"text"));


--
-- Name: student_content_progress scp insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scp insert own" ON "public"."student_content_progress" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: student_content_progress scp select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scp select own" ON "public"."student_content_progress" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: student_content_progress scp update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scp update own" ON "public"."student_content_progress" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: course_sections sections_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sections_admin_all" ON "public"."course_sections" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: course_sections sections_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sections_select_auth" ON "public"."course_sections" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: settings settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "settings_admin_all" ON "public"."settings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: settings settings_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "settings_assistant_manage" ON "public"."settings" USING ("public"."has_permission"('settings'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('settings'::"text", 'manage'::"text"));


--
-- Name: settings settings_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "settings_assistant_view" ON "public"."settings" FOR SELECT USING ("public"."has_permission"('settings'::"text", 'view'::"text"));


--
-- Name: site_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_content site_content admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_content admin write" ON "public"."site_content" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: site_content site_content read public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_content read public" ON "public"."site_content" FOR SELECT USING (true);


--
-- Name: site_content site_content_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_content_assistant_manage" ON "public"."site_content" USING ("public"."has_permission"('settings'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('settings'::"text", 'manage'::"text"));


--
-- Name: site_content site_content_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_content_assistant_view" ON "public"."site_content" FOR SELECT USING ("public"."has_permission"('settings'::"text", 'view'::"text"));


--
-- Name: site_theme; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."site_theme" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_theme site_theme admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_theme admin write" ON "public"."site_theme" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: site_theme site_theme read public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_theme read public" ON "public"."site_theme" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: site_theme site_theme_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_theme_assistant_manage" ON "public"."site_theme" USING ("public"."has_permission"('settings'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('settings'::"text", 'manage'::"text"));


--
-- Name: site_theme site_theme_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "site_theme_assistant_view" ON "public"."site_theme" FOR SELECT USING ("public"."has_permission"('settings'::"text", 'view'::"text"));


--
-- Name: stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stages" ENABLE ROW LEVEL SECURITY;

--
-- Name: stages stages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stages_admin_all" ON "public"."stages" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: stages stages_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stages_assistant_manage" ON "public"."stages" USING ("public"."has_permission"('categories'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('categories'::"text", 'manage'::"text"));


--
-- Name: stages stages_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stages_assistant_view" ON "public"."stages" FOR SELECT USING ("public"."has_permission"('categories'::"text", 'view'::"text"));


--
-- Name: stages stages_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stages_public_read" ON "public"."stages" FOR SELECT USING (true);


--
-- Name: streaming_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."streaming_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_activity student reads own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student reads own activity" ON "public"."learning_activity" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: student_weekly_goals student reads own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student reads own goals" ON "public"."student_weekly_goals" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: learning_activity student updates own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student updates own activity" ON "public"."learning_activity" FOR UPDATE USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: student_weekly_goals student updates own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student updates own goals" ON "public"."student_weekly_goals" FOR UPDATE USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: learning_activity student writes own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student writes own activity" ON "public"."learning_activity" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: student_weekly_goals student writes own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student writes own goals" ON "public"."student_weekly_goals" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: student_content_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."student_content_progress" ENABLE ROW LEVEL SECURITY;

--
-- Name: student_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."student_devices" ENABLE ROW LEVEL SECURITY;

--
-- Name: student_devices student_devices_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student_devices_assistant_manage" ON "public"."student_devices" USING ("public"."has_permission"('students'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('students'::"text", 'manage'::"text"));


--
-- Name: student_devices student_devices_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "student_devices_assistant_view" ON "public"."student_devices" FOR SELECT USING ("public"."has_permission"('students'::"text", 'view'::"text"));


--
-- Name: student_weekly_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."student_weekly_goals" ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;

--
-- Name: students students_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students_admin_all" ON "public"."students" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: students students_assistant_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students_assistant_manage" ON "public"."students" USING ("public"."has_permission"('students'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('students'::"text", 'manage'::"text"));


--
-- Name: students students_assistant_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students_assistant_view" ON "public"."students" FOR SELECT USING ("public"."has_permission"('students'::"text", 'view'::"text"));


--
-- Name: students students_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students_select_own" ON "public"."students" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: students students_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students_update_own" ON "public"."students" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: assignment_submissions sub_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sub_admin_all" ON "public"."assignment_submissions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: assignment_submissions sub_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sub_own" ON "public"."assignment_submissions" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))) WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: assignment_submissions sub_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sub_student_select" ON "public"."assignment_submissions" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));


--
-- Name: terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."terms" ENABLE ROW LEVEL SECURITY;

--
-- Name: terms terms_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "terms_admin_all" ON "public"."terms" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: terms terms_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "terms_public_read" ON "public"."terms" FOR SELECT USING (true);


--
-- Name: video_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."video_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 3xUNXoScKC49axhrUTb5H4U0pxuCzlS4yvH7SHgJZ6xQGzyyxBVlcuf1OV7zdUV

