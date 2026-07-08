-- SQL Migration: Advanced Analytics Function

drop function if exists public.get_advanced_analytics();

create or replace function public.get_advanced_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
