-- Seed data for Dashboard & Reports

-- 1. Insert Categories
INSERT INTO public.categories (id, name, slug) VALUES 
('cat-101', 'البرمجة', 'programming'),
('cat-102', 'التصميم', 'design'),
('cat-103', 'التسويق', 'marketing'),
('cat-104', 'اللغات', 'languages'),
('cat-105', 'الأعمال', 'business')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Courses
INSERT INTO public.courses (id, title, status, revenue, students, category_id, image_url, created_at) VALUES 
('crs-201', 'البرمجة باستخدام Python', 'منشور', 32450, 1250, 'cat-101', '/courses/python.png', now() - interval '2 months'),
('crs-202', 'تصميم واجهات المستخدم UI/UX', 'منشور', 24300, 980, 'cat-102', '/courses/uiux.png', now() - interval '1 month'),
('crs-203', 'التسويق الرقمي الشامل', 'منشور', 18600, 760, 'cat-103', '/courses/marketing.png', now() - interval '3 months'),
('crs-204', 'تعلم اللغة الإنجليزية', 'منشور', 15200, 650, 'cat-104', '/courses/english.png', now() - interval '4 months'),
('crs-205', 'تحليل البيانات باستخدام Excel', 'منشور', 12800, 540, 'cat-105', '/courses/excel.png', now() - interval '1 month'),
('crs-206', 'أساسيات الذكاء الاصطناعي', 'منشور', 11900, 430, 'cat-101', '/courses/ai.png', now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Students
INSERT INTO public.students (id, code, name, email, phone, gender, courses, progress, spent, status, joined_at, created_at) VALUES
('b2345678-1234-5678-1234-567812345671', 'STD-901', 'محمد إبراهيم', 'mohamed@example.com', '01012345678', 'ذكر', 2, 45, '1200', 'نشط', current_date, now() - interval '5 days'),
('b2345678-1234-5678-1234-567812345672', 'STD-902', 'فاطمة الزهراء', 'fatma@example.com', '01012345679', 'أنثى', 1, 20, '450', 'نشط', current_date, now() - interval '15 days'),
('b2345678-1234-5678-1234-567812345673', 'STD-903', 'يوسف محمد', 'youssef@example.com', '01012345680', 'ذكر', 3, 80, '2500', 'نشط', current_date, now() - interval '1 month'),
('b2345678-1234-5678-1234-567812345674', 'STD-904', 'سارة أحمد', 'sara@example.com', '01012345681', 'أنثى', 1, 10, '350', 'موقوف', current_date, now() - interval '3 months')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Payments (mix of statuses and dates)
INSERT INTO public.payments (id, code, student_name, student_email, student_phone, course, amount, method, reference, submitted_at, status, created_at) VALUES
('c3456789-1234-5678-1234-567812345671', '#PAY-901', 'محمد إبراهيم', 'mohamed@example.com', '01012345678', 'البرمجة باستخدام Python', 1200, 'فودافون كاش', 'REF-001', '2026-06-20', 'مقبول', now() - interval '2 days'),
('c3456789-1234-5678-1234-567812345672', '#PAY-902', 'فاطمة الزهراء', 'fatma@example.com', '01012345679', 'تصميم واجهات المستخدم UI/UX', 450, 'تحويل بنكي', 'REF-002', '2026-06-15', 'مقبول', now() - interval '10 days'),
('c3456789-1234-5678-1234-567812345673', '#PAY-903', 'يوسف محمد', 'youssef@example.com', '01012345680', 'التسويق الرقمي الشامل', 1500, 'بطاقة ائتمان', 'REF-003', '2026-05-15', 'مقبول', now() - interval '40 days'),
('c3456789-1234-5678-1234-567812345674', '#PAY-904', 'سارة أحمد', 'sara@example.com', '01012345681', 'أساسيات الذكاء الاصطناعي', 350, 'فودافون كاش', 'REF-004', '2026-06-25', 'قيد المراجعة', now() - interval '5 hours'),
('c3456789-1234-5678-1234-567812345675', '#PAY-905', 'أحمد خالد', 'ahmed@example.com', '01012345682', 'تحليل البيانات باستخدام Excel', 600, 'فودافون كاش', 'REF-005', '2026-06-26', 'مرفوض', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Enrollments
INSERT INTO public.enrollments (id, code, student_id, course_id, status, joined_at, progress, current_lesson, completed_lessons) VALUES
('d4567890-1234-5678-1234-567812345671', 'ENR-901', 'b2345678-1234-5678-1234-567812345671', 'crs-201', 'مستمر', now(), 45, 'مقدمة', 5),
('d4567890-1234-5678-1234-567812345672', 'ENR-902', 'b2345678-1234-5678-1234-567812345672', 'crs-202', 'مستمر', now(), 20, 'الأساسيات', 2)
ON CONFLICT (id) DO NOTHING;
