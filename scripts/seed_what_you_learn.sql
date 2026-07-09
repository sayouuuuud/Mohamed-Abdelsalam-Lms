UPDATE lectures
SET what_you_learn = ARRAY[
  'فهم المفاهيم الأساسية للموضوع',
  'حل المسائل خطوة بخطوة',
  'تطبيقات على نماذج الامتحانات',
  'مراجعة شاملة قبل الاختبار'
]
WHERE what_you_learn IS NULL OR array_length(what_you_learn, 1) = 0;
