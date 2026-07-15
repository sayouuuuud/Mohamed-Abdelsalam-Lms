// app/admin/exams/[id]/page.tsx
'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { ExamDetailsHeader } from '@/components/exams/exam-details-header'
import { ExamStats } from '@/components/exams/exam-stats'
import { ExamQuestionsList } from '@/components/exams/exam-questions-list'
import { ExamSubmissionsTable } from '@/components/exams/exam-submissions-table'
import { ExamCharts } from '@/components/exams/exam-charts'
import { getExamDetails } from './actions'
import { motion } from 'framer-motion'
import { useEffect } from 'react'

export default function ExamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [exam, setExam] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    getExamDetails(id).then((data) => {
      if (!data) notFound()
      setExam(data)
    })
  }, [id])

  if (!exam) return null

  const tabs = [
    { id: 'overview', label: 'نظرة عامة وإحصائيات' },
    { id: 'submissions', label: `إجابات الطلاب (${exam.submissions.length})` },
    { id: 'questions', label: `الأسئلة (${exam.questionsCount})` },
  ]

  return (
    <div className="space-y-6 font-sans">
      <ExamDetailsHeader
        exam={{
          code: exam.code,
          title: exam.title,
          status: exam.status,
          course: exam.course,
          description: exam.description,
          duration: exam.duration,
          passMark: exam.passMark,
          createdAt: exam.createdAt,
          submissions: exam.submissions,
        }}
      />
      
      <div className="flex w-full overflow-x-auto scrollbar-hide pb-2">
        <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1.5 shadow-inner dark:bg-muted/20">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 outline-none ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-pill"
                    className="absolute inset-0 z-0 rounded-full bg-background shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-muted dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      
      <div className="mt-6 outline-none">
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ExamStats data={exam} />
            <ExamCharts submissions={exam.submissions} />
          </motion.div>
        )}

        {activeTab === 'submissions' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <ExamSubmissionsTable submissions={exam.submissions} examCode={exam.code} />
          </motion.div>
        )}
        
        {activeTab === 'questions' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <ExamQuestionsList questions={exam.questions} />
          </motion.div>
        )}
      </div>
    </div>
  )
}
