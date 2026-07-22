'use client'

import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import Link from 'next/link'
import { QUIZZES } from './registry'

export default function QuizHubPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <div className="px-4 pt-4">
                <NavHeader title="Peanut Quizzes" />
            </div>

            <div className="flex h-full flex-col space-y-4 px-4 pb-8">
                <p className="text-sm text-grey-1">
                    Learn the definitions we use every day — or at least lose to a peanut trying.
                </p>

                <div className="space-y-2">
                    {QUIZZES.map((quiz) => (
                        <Link key={quiz.slug} href={`/dev/quiz/${quiz.slug}`}>
                            <Card className="cursor-pointer p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-10 items-center justify-center rounded-sm border border-n-1 bg-primary-3 text-xl">
                                            {quiz.emoji}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold">{quiz.title}</h3>
                                            <p className="text-xs text-grey-1">{quiz.description}</p>
                                        </div>
                                    </div>
                                    <Icon name="arrow-up-right" size={16} className="text-grey-1" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
