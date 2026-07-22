'use client'

import { notFound, useParams } from 'next/navigation'
import QuizEngine from '../QuizEngine'
import { QUIZZES } from '../registry'

export default function QuizPage() {
    const params = useParams<{ slug: string }>()
    const quiz = QUIZZES.find((q) => q.slug === params?.slug)
    if (!quiz) notFound()
    return <QuizEngine quiz={quiz} />
}
