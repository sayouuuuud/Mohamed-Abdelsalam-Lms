// A single lesson inside a lecture
export type Lesson = {
  id: string
  title: string
  duration: string
  // free preview lessons
  isFree?: boolean
  // youtube video url
  videoUrl?: string | null
}

// A lecture belongs to a branch. The PRICE lives here (not on the branch).
export type Lecture = {
  id: string
  // real database UUID (present when loaded from the DB; used by the cart)
  dbId?: string
  title: string
  description: string
  price: number
  oldPrice?: number
  badge?: string
  // optional admin-uploaded artwork; falls back to /lessons/<slug>.png
  image?: string
  lessons: Lesson[]
  // التصنيف اللي المحاضرة تابعة له داخل الكورس (null = بدون تصنيف)
  sectionId?: string | null
  // محاضرة مجانية: أي زائر يقدر يتفرج عليها ودروسها حتى بدون اشتراك
  isFree?: boolean
}

// تصنيف داخل الكورس يجمّع ويرتّب مجموعة محاضرات (مثال: المراجعة النهائية)
export type CourseSection = {
  id: string
  title: string
}

export type MonthlyCourse = {
  id: string
  dbId?: string
  title: string
  description: string
  image?: string
  price: number
  oldPrice?: number
  badge?: string
  isPublished: boolean
  lectures: Lecture[]
  sections?: CourseSection[]
}

// A branch of the subject (e.g. الجبر). No price — it groups lectures and monthly courses.
export type Branch = {
  id: string
  title: string
  description: string
  image: string
  topics: string[]
  lectures: Lecture[]
  monthlyCourses?: MonthlyCourse[]
}

// A purchasable term that bundles all courses in a stage (ترم أول / ترم تاني)
export type Term = {
  id: string          // DB uuid
  title: string       // e.g. "ترم أول"
  price: number
  oldPrice?: number
}

export type Stage = {
  id: string
  index: string
  title: string
  subtitle: string
  rows: string[]
  formula: string
  image: string
  accent: 'gold' | 'emerald'
  // full-term price for the whole grade (subscribe to everything) — legacy
  termPrice: number
  termOldPrice?: number
  terms?: Term[]      // structured terms (ترم أول, ترم تاني…)
  branches: Branch[]
}

// ── helpers ────────────────────────────────────────────────────────────────
export function getStage(id: string) {
  return stages.find((s) => s.id === id)
}

export function getBranch(stageId: string, branchId: string) {
  return getStage(stageId)?.branches.find((b) => b.id === branchId)
}

export function countLessons(branch: Branch) {
  return branch.lectures.reduce((sum, l) => sum + l.lessons.length, 0)
}

export const stages: Stage[] = [
  {
    id: 'sec-1',
    index: '٠١',
    title: 'الصف الأول الثانوي',
    subtitle: 'الأساس المتين: جبر، حساب مثلثات، وهندسة تحليلية تبني بيها باقي السنين.',
    rows: ['الجبر والمتطابقات', 'حساب المثلثات', 'الهندسة التحليلية'],
    formula: 'sin²θ + cos²θ = 1',
    image: '/stages/sec-1.png',
    accent: 'emerald',
    termPrice: 750,
    termOldPrice: 1100,
    branches: [
      {
        id: 'alg-identities',
        title: 'الجبر والمتطابقات',
        description: 'تأسيس كامل للأعداد والمتطابقات وحل المعادلات بأنواعها خطوة بخطوة.',
        image: '/lectures/alg-identities.png',
        topics: ['الأعداد المركّبة', 'المتطابقات الشهيرة', 'المعادلات والمتباينات', 'الأسس واللوغاريتمات'],
        lectures: [
          {
            id: 'complex-numbers',
            title: 'الأعداد المركّبة',
            description: 'مدخل كامل للأعداد المركّبة والعمليات عليها وتمثيلها على المستوى.',
            price: 120,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'مقدمة عن الأعداد المركّبة', duration: '14:30', isFree: true },
              { id: 'l2', title: 'جمع وطرح الأعداد المركّبة', duration: '11:20' },
              { id: 'l3', title: 'الضرب والقسمة', duration: '16:05' },
              { id: 'l4', title: 'المرافق والمقياس', duration: '13:45' },
            ],
          },
          {
            id: 'famous-identities',
            title: 'المتطابقات الشهيرة',
            description: 'كل المتطابقات الجبرية المهمة مع تطبيقات على المسائل.',
            price: 100,
            lessons: [
              { id: 'l1', title: 'مربع ومكعب ذات الحدين', duration: '12:10', isFree: true },
              { id: 'l2', title: 'الفرق بين مربعين ومكعبين', duration: '10:35' },
              { id: 'l3', title: 'تطبيقات على المتطابقات', duration: '15:50' },
            ],
          },
          {
            id: 'equations',
            title: 'المعادلات والمتباينات',
            description: 'حل المعادلات والمتباينات بأنواعها بطريقة منظّمة وسهلة.',
            price: 110,
            lessons: [
              { id: 'l1', title: 'المعادلات التربيعية', duration: '17:20' },
              { id: 'l2', title: 'المتباينات', duration: '13:15' },
              { id: 'l3', title: 'الأسس واللوغاريتمات', duration: '18:40' },
            ],
          },
        ],
      },
      {
        id: 'trigonometry',
        title: 'حساب المثلثات',
        description: 'من الزاوية والدائرة المثلثية لحد حل المثلث وقوانين الجيب وجيب التمام.',
        image: '/lectures/trigonometry.png',
        topics: ['الدائرة المثلثية', 'النسب المثلثية', 'قانون الجيب وجيب التمام', 'حل المثلث'],
        lectures: [
          {
            id: 'trig-circle',
            title: 'الدائرة المثلثية والنسب',
            description: 'الزوايا والدائرة المثلثية والنسب المثلثية الأساسية.',
            price: 130,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'قياس الزوايا', duration: '12:00', isFree: true },
              { id: 'l2', title: 'الدائرة المثلثية', duration: '15:30' },
              { id: 'l3', title: 'النسب المثلثية', duration: '14:10' },
            ],
          },
          {
            id: 'trig-laws',
            title: 'قوانين الجيب وحل المثلث',
            description: 'قانون الجيب وجيب التمام وتطبيقاتهم في حل المثلث.',
            price: 120,
            lessons: [
              { id: 'l1', title: 'قانون الجيب', duration: '13:25' },
              { id: 'l2', title: 'قانون جيب التمام', duration: '14:55' },
              { id: 'l3', title: 'حل المثلث', duration: '16:30' },
            ],
          },
        ],
      },
      {
        id: 'analytic-geometry',
        title: 'الهندسة التحليلية',
        description: 'المستقيم والمنحنيات على المستوى الإحداثي بأسلوب بصري سهل.',
        image: '/lectures/analytic-geometry.png',
        topics: ['الإحداثيات والمسافة', 'ميل المستقيم', 'معادلة المستقيم', 'القطع المكافئ'],
        lectures: [
          {
            id: 'coordinates',
            title: 'الإحداثيات والمستقيم',
            description: 'الإحداثيات والمسافة وميل ومعادلة المستقيم.',
            price: 125,
            lessons: [
              { id: 'l1', title: 'الإحداثيات والمسافة', duration: '11:40', isFree: true },
              { id: 'l2', title: 'ميل المستقيم', duration: '12:50' },
              { id: 'l3', title: 'معادلة المستقيم', duration: '15:20' },
            ],
          },
          {
            id: 'parabola',
            title: 'القطع المكافئ',
            description: 'دراسة القطع المكافئ ومعادلاته وخواصه.',
            price: 115,
            lessons: [
              { id: 'l1', title: 'تعريف القطع المكافئ', duration: '13:10' },
              { id: 'l2', title: 'معادلة القطع المكافئ', duration: '16:00' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sec-2',
    index: '٠٢',
    title: 'الصف الثاني الثانوي',
    subtitle: 'نقطة التحول: تفاضل وتكامل، ميكانيكا، وإحصاء بأسلوب يخلّيها سهلة.',
    rows: ['التفاضل والتكامل', 'الميكانيكا', 'الإحصاء والاحتمالات'],
    formula: 'd/dx [xⁿ] = n·xⁿ⁻¹',
    image: '/stages/sec-2.png',
    accent: 'gold',
    termPrice: 850,
    termOldPrice: 1300,
    branches: [
      {
        id: 'calculus',
        title: 'التفاضل والتكامل',
        description: 'النهايات والاتصال والتفاضل والتكامل بتطبيقات حياتية تخلّيها سهلة.',
        image: '/lectures/calculus.png',
        topics: ['النهايات والاتصال', 'قواعد الاشتقاق', 'تطبيقات التفاضل', 'التكامل وحساب المساحات'],
        lectures: [
          {
            id: 'limits',
            title: 'النهايات والاتصال',
            description: 'مفهوم النهاية والاتصال وطرق حساب النهايات.',
            price: 140,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'مفهوم النهاية', duration: '15:00', isFree: true },
              { id: 'l2', title: 'حساب النهايات', duration: '17:30' },
              { id: 'l3', title: 'الاتصال', duration: '14:20' },
            ],
          },
          {
            id: 'derivatives',
            title: 'التفاضل وتطبيقاته',
            description: 'قواعد الاشتقاق وتطبيقات التفاضل على المسائل.',
            price: 150,
            lessons: [
              { id: 'l1', title: 'قواعد الاشتقاق', duration: '18:10' },
              { id: 'l2', title: 'اشتقاق الدوال المثلثية', duration: '16:40' },
              { id: 'l3', title: 'تطبيقات التفاضل', duration: '19:25' },
            ],
          },
          {
            id: 'integration',
            title: 'التكامل',
            description: 'التكامل وحساب المساحات تحت المنحنيات.',
            price: 145,
            lessons: [
              { id: 'l1', title: 'التكامل غير المحدود', duration: '16:15' },
              { id: 'l2', title: 'التكامل المحدود', duration: '17:50' },
              { id: 'l3', title: 'حساب المساحات', duration: '15:30' },
            ],
          },
        ],
      },
      {
        id: 'mechanics',
        title: 'الميكانيكا',
        description: 'القوى والاتزان والحركة بشرح مبسّط مدعوم بالرسومات والأمثلة.',
        image: '/lectures/mechanics.png',
        topics: ['القوى والاتزان', 'الاحتكاك', 'الحركة في خط مستقيم', 'قوانين نيوتن'],
        lectures: [
          {
            id: 'forces',
            title: 'القوى والاتزان',
            description: 'القوى وتركيبها وشرط الاتزان والاحتكاك.',
            price: 135,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'تركيب القوى', duration: '14:00', isFree: true },
              { id: 'l2', title: 'اتزان القوى', duration: '16:20' },
              { id: 'l3', title: 'الاحتكاك', duration: '15:10' },
            ],
          },
          {
            id: 'motion',
            title: 'الحركة وقوانين نيوتن',
            description: 'الحركة في خط مستقيم وقوانين نيوتن للحركة.',
            price: 130,
            lessons: [
              { id: 'l1', title: 'الحركة في خط مستقيم', duration: '17:00' },
              { id: 'l2', title: 'قوانين نيوتن', duration: '18:30' },
            ],
          },
        ],
      },
      {
        id: 'statistics',
        title: 'الإحصاء والاحتمالات',
        description: 'تحليل البيانات والتوزيعات والاحتمالات بطريقة عملية وواضحة.',
        image: '/lectures/statistics.png',
        topics: ['مقاييس النزعة المركزية', 'التشتت', 'الاحتمال', 'التوزيع الطبيعي'],
        lectures: [
          {
            id: 'descriptive',
            title: 'الإحصاء الوصفي',
            description: 'مقاييس النزعة المركزية والتشتت.',
            price: 110,
            lessons: [
              { id: 'l1', title: 'النزعة المركزية', duration: '13:00', isFree: true },
              { id: 'l2', title: 'مقاييس التشتت', duration: '14:45' },
            ],
          },
          {
            id: 'probability',
            title: 'الاحتمالات',
            description: 'الاحتمال والتوزيع الطبيعي.',
            price: 120,
            lessons: [
              { id: 'l1', title: 'مبادئ الاحتمال', duration: '15:20' },
              { id: 'l2', title: 'التوزيع الطبيعي', duration: '16:50' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sec-3',
    index: '٠٣',
    title: 'الصف الثالث الثانوي',
    subtitle: 'سنة الحسم: مراجعة شاملة واستعداد كامل لامتحان الثانوية العامة.',
    rows: ['الرياضيات البحتة', 'الرياضيات التطبيقية', 'الديناميكا'],
    formula: '∫ₐᵇ f(x) dx',
    image: '/stages/sec-3.png',
    accent: 'emerald',
    termPrice: 1100,
    termOldPrice: 1600,
    branches: [
      {
        id: 'pure-math',
        title: 'الرياضيات البحتة',
        description: 'الجبر والتفاضل والتكامل المتقدّم باستعداد كامل لامتحان الثانوية.',
        image: '/lectures/pure-math.png',
        topics: ['الأعداد المركّبة', 'المحدّدات والمصفوفات', 'التفاضل المتقدّم', 'التكامل وتطبيقاته'],
        lectures: [
          {
            id: 'algebra-adv',
            title: 'الجبر المتقدّم',
            description: 'الأعداد المركّبة والمحدّدات والمصفوفات بعمق.',
            price: 170,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'الأعداد المركّبة', duration: '18:00', isFree: true },
              { id: 'l2', title: 'المحدّدات', duration: '16:30' },
              { id: 'l3', title: 'المصفوفات', duration: '19:10' },
            ],
          },
          {
            id: 'calculus-adv',
            title: 'التفاضل والتكامل المتقدّم',
            description: 'التفاضل والتكامل المتقدّم وتطبيقاته في الامتحان.',
            price: 180,
            lessons: [
              { id: 'l1', title: 'الت��اضل المتقدّم', duration: '20:00' },
              { id: 'l2', title: 'التكامل وتطبيقاته', duration: '21:30' },
            ],
          },
        ],
      },
      {
        id: 'applied-math',
        title: 'الرياضيات التطبيقية',
        description: 'الاستاتيكا والديناميكا بمسائل على نمط الامتحان الفعلي.',
        image: '/lectures/applied-math.png',
        topics: ['الاتزان والعزوم', 'الأطر والقضبان', 'الحركة والمقذوفات', 'الشغل والطاقة'],
        lectures: [
          {
            id: 'statics',
            title: 'الاستاتيكا',
            description: 'الاتزان والعزوم والأطر والقضبان.',
            price: 160,
            badge: 'الأكثر طلبًا',
            lessons: [
              { id: 'l1', title: 'الاتزان والعزوم', duration: '17:40', isFree: true },
              { id: 'l2', title: 'الأطر والقضبان', duration: '18:20' },
            ],
          },
          {
            id: 'dynamics',
            title: 'الديناميكا',
            description: 'الحركة والمقذوفات والشغل ��الطاقة.',
            price: 165,
            lessons: [
              { id: 'l1', title: 'الحركة والمقذوفات', duration: '19:00' },
              { id: 'l2', title: 'الشغل والطاقة', duration: '17:15' },
            ],
          },
        ],
      },
      {
        id: 'final-revision',
        title: 'المراجعة النهائية',
        description: 'مراجعة مركّزة وحل امتحانات السنوات السابقة قبل الامتحان مباشرة.',
        image: '/lectures/final-revision.png',
        topics: ['ملخّصات سريعة', 'نماذج امتحانات', 'أخطاء شائعة', 'استراتيجيات الحل'],
        lectures: [
          {
            id: 'revision',
            title: 'المراجعة وحل الامتحانات',
            description: 'ملخّصات سريعة ونماذج امتحانات واستراتيجيات الحل.',
            price: 200,
            badge: 'قبل الامتحان',
            lessons: [
              { id: 'l1', title: 'ملخّصات سريعة', duration: '22:00', isFree: true },
              { id: 'l2', title: 'نماذج امتحانات محلولة', duration: '25:30' },
              { id: 'l3', title: 'أخطاء شائعة واستراتيجيات', duration: '18:45' },
            ],
          },
        ],
      },
    ],
  },
]

export type Feature = {
  step: string
  title: string
  description: string
  icon: string
}

export const features: Feature[] = [
  {
    step: '٠١',
    title: 'شرح مبسّط ومتدرّج',
    description: 'كل فكرة بتتشرح من الصفر بأسلوب سهل يوصّل المعلومة لأي طالب مهما كان مستواه.',
    icon: 'lightbulb',
  },
  {
    step: '٠٢',
    title: 'فيديوهات عالية الجودة',
    description: 'حصص مسجّلة بجودة عالية تقدر تتفرج عليها وتعيدها في أي وقت ومن أي مكان.',
    icon: 'video',
  },
  {
    step: '٠٣',
    title: 'بنك أسئلة وامتحانات',
    description: 'آلاف المسائل والامتحانات التفاعلية مع تصحيح فوري يثبّت المعلومة بعد كل درس.',
    icon: 'clipboard',
  },
  {
    step: '٠٤',
    title: 'متابعة وتقارير',
    description: 'تقارير دورية للطالب وولي الأمر توضّح التقدّم ونقاط القوة والضعف أول بأول.',
    icon: 'chart',
  },
]

export type Stat = {
  value: number
  suffix: string
  label: string
}

export const stats: Stat[] = [
  { value: 25, suffix: '+', label: 'سنة خبرة في تدريس الرياضيات' },
  { value: 48000, suffix: '+', label: 'طالب وطالبة على المنصة' },
  { value: 1200, suffix: '+', label: 'فيديو ودرس تعليمي' },
  { value: 98, suffix: '%', label: 'نسبة رضا الطلاب' },
]

export type Testimonial = {
  name: string
  grade: string
  subject: string
  quote: string
  before: number
  after: number
  // monthly grade progression (%) — plotted as a rising math curve
  journey: { month: string; score: number }[]
}

export const testimonials: Testimonial[] = [
  {
    name: 'مريم أحمد',
    grade: 'الثالث الثانوي',
    subject: 'الرياضيات البحتة',
    quote:
      'مستر عبد السلام غيّر علاقتي بالرياضيات تمامًا، بقيت بفهم المسألة قبل ما أحلّها. جبت أعلى درجة في حياتي!',
    before: 42,
    after: 98,
    journey: [
      { month: 'سبتمبر', score: 42 },
      { month: 'أكتوبر', score: 51 },
      { month: 'نوفمبر', score: 60 },
      { month: 'ديسمبر', score: 68 },
      { month: 'يناير', score: 79 },
      { month: 'فبراير', score: 88 },
      { month: 'مارس', score: 93 },
      { month: 'الامتحان', score: 98 },
    ],
  },
  {
    name: 'يوسف خالد',
    grade: 'الثاني الثانوي',
    subject: 'التفاضل والتكامل',
    quote:
      'طريقة الشرح بسيطة جدًا والامتحانات بعد كل درس بتثبّت المعلومة. التفاضل بقى أسهل حاجة عندي.',
    before: 55,
    after: 95,
    journey: [
      { month: 'سبتمبر', score: 55 },
      { month: 'أكتوبر', score: 58 },
      { month: 'نوفمبر', score: 66 },
      { month: 'ديسمبر', score: 72 },
      { month: 'يناير', score: 81 },
      { month: 'فبراير', score: 87 },
      { month: 'مارس', score: 91 },
      { month: 'الامتحان', score: 95 },
    ],
  },
  {
    name: 'حبيبة محمود',
    grade: 'الأول الثانوي',
    subject: 'الجبر والهندسة',
    quote: 'المنصة منظمة وكل المواد مرتبة، بحس إن فيه حد ماسكني خطوة بخطوة لحد الامتحان.',
    before: 48,
    after: 96,
    journey: [
      { month: 'سبتمبر', score: 48 },
      { month: 'أكتوبر', score: 54 },
      { month: 'نوفمبر', score: 63 },
      { month: 'ديسمبر', score: 71 },
      { month: 'يناير', score: 80 },
      { month: 'فبراير', score: 86 },
      { month: 'مارس', score: 92 },
      { month: 'الامتحان', score: 96 },
    ],
  },
]

// Equations used in the background marquee + decorative layers.
export const equations: string[] = [
  'f(x) = ax² + bx + c',
  'sin²θ + cos²θ = 1',
  'd/dx [xⁿ] = n·xⁿ⁻¹',
  '∫ₐᵇ f(x) dx',
  'e^{iπ} + 1 = 0',
  'lim_{x→∞} 1/x = 0',
  'a² + b² = c²',
  'Σ_{k=1}^{n} k = n(n+1)/2',
  'Δ = b² − 4ac',
  'log_a(xy) = log_a x + log_a y',
]
