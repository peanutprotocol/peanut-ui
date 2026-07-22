'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import {
    PeanutCheering,
    PeanutCrying,
    PeanutSad,
    PeanutThinking,
    PeanutTooCool,
    PeanutWavingHello,
    PeanutWhistling,
} from '@/assets/mascot'
import { shootDoubleStarConfetti, shootStarConfetti } from '@/utils/confetti'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { renderShareCard } from './shareCard'
import { LEVEL_POINTS, type QuizDefinition, type QuizLevel } from './types'

type Stage = 'start' | 'playing' | 'done'
type ShareState = 'idle' | 'busy' | 'copied' | 'downloaded' | 'failed'

const MASCOT_CYCLE = [PeanutWavingHello, PeanutWhistling, PeanutTooCool, PeanutCheering, PeanutThinking]

const LEVEL_ORDER: QuizLevel[] = ['easy', 'mid', 'hard']
const LEVEL_LABEL: Record<QuizLevel, string> = { easy: 'EASY', mid: 'MID 🌶️', hard: 'HARD 💀' }
const LEVEL_CHIP_CLASS: Record<QuizLevel, string> = { easy: 'bg-green-1', mid: 'bg-yellow-1', hard: 'bg-primary-1' }
const STREAK_BONUS = 50

function shuffle<T>(arr: T[]): T[] {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

export default function QuizEngine({ quiz }: { quiz: QuizDefinition }) {
    const [stage, setStage] = useState<Stage>('start')
    // order = indices into quiz.questions for this run (shuffled; retry-missed narrows it)
    const [order, setOrder] = useState<number[]>([])
    const [optionOrders, setOptionOrders] = useState<Record<number, number[]>>({})
    const [position, setPosition] = useState(0)
    const [chosen, setChosen] = useState<number | null>(null) // original option index chosen for current question
    const [correctCount, setCorrectCount] = useState(0)
    const [missed, setMissed] = useState<number[]>([])
    const [streak, setStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [mascotClicks, setMascotClicks] = useState(0)
    const [scoreClicks, setScoreClicks] = useState(0)
    const [points, setPoints] = useState(0)
    const [shareState, setShareState] = useState<ShareState>('idle')

    const questionIndex = order[position]
    const question = quiz.questions[questionIndex]
    const total = order.length
    const answeredCorrectly = chosen !== null && chosen === question?.correctIndex

    const beginRun = (questionIndices: number[]) => {
        // easy → mid → hard, shuffled within each level
        const runOrder = LEVEL_ORDER.flatMap((level) =>
            shuffle(questionIndices.filter((qi) => quiz.questions[qi].level === level))
        )
        const opts: Record<number, number[]> = {}
        for (const qi of runOrder) {
            opts[qi] = shuffle(quiz.questions[qi].options.map((_, i) => i))
        }
        setOrder(runOrder)
        setOptionOrders(opts)
        setPosition(0)
        setChosen(null)
        setCorrectCount(0)
        setMissed([])
        setStreak(0)
        setBestStreak(0)
        setScoreClicks(0)
        setPoints(0)
        setShareState('idle')
        setStage('playing')
    }

    const answer = (originalIndex: number) => {
        if (chosen !== null) return
        setChosen(originalIndex)
        setMascotClicks(0) // hand the mascot back to answer reactions after easter-egg taps
        if (originalIndex === question.correctIndex) {
            setCorrectCount((c) => c + 1)
            const newStreak = streak + 1
            setStreak(newStreak)
            setBestStreak((b) => Math.max(b, newStreak))
            setPoints((p) => p + LEVEL_POINTS[question.level] + (newStreak >= 3 ? STREAK_BONUS : 0))
            shootStarConfetti({ particleCount: newStreak >= 5 ? 40 : 15, origin: { x: 0.5, y: 0.4 } })
            if (newStreak === 5) shootDoubleStarConfetti()
        } else {
            setMissed((m) => [...m, questionIndex])
            setStreak(0)
        }
    }

    const next = () => {
        if (position + 1 >= total) {
            setStage('done')
            if (missed.length === 0) shootDoubleStarConfetti()
        } else {
            setPosition((p) => p + 1)
            setChosen(null)
        }
    }

    const share = async (mode: 'copy' | 'download') => {
        setShareState('busy')
        try {
            const blob = await renderShareCard({
                quizTitle: quiz.title,
                emoji: quiz.emoji,
                score: correctCount,
                total,
                points,
                gradeTitle: grade.title,
                bestStreak,
                mascotSrc: mascot.src,
            })
            if (mode === 'copy' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                setShareState('copied')
            } else {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `peanut-quiz-${quiz.slug}-${correctCount}-${total}.png`
                a.click()
                URL.revokeObjectURL(url)
                setShareState('downloaded')
            }
        } catch {
            setShareState('failed')
        }
    }

    const onMascotClick = () => {
        const clicks = mascotClicks + 1
        setMascotClicks(clicks)
        if (clicks % 5 === 0) shootDoubleStarConfetti()
        else shootStarConfetti({ particleCount: 8 })
    }

    const scoreFraction = total > 0 ? correctCount / total : 0
    const grade = useMemo(
        () =>
            [...quiz.grades]
                .sort((a, b) => b.minFraction - a.minFraction)
                .find((g) => scoreFraction >= g.minFraction) ?? quiz.grades[quiz.grades.length - 1],
        [quiz.grades, scoreFraction]
    )

    const mascot = (() => {
        if (mascotClicks > 0 && stage !== 'done') return MASCOT_CYCLE[mascotClicks % MASCOT_CYCLE.length]
        if (stage === 'start') return PeanutWavingHello
        if (stage === 'done')
            return scoreFraction >= 0.8 ? PeanutCheering : scoreFraction >= 0.5 ? PeanutWhistling : PeanutCrying
        if (chosen === null) return PeanutThinking
        if (answeredCorrectly) return streak >= 3 ? PeanutTooCool : PeanutCheering
        return bestStreak >= 3 && streak === 0 ? PeanutCrying : PeanutSad
    })()

    const mascotImg = (
        <button type="button" onClick={onMascotClick} aria-label="Peanut mascot" className="mx-auto block outline-none">
            <Image src={mascot.src} unoptimized alt="Peanut mascot" width={120} height={120} />
        </button>
    )

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="px-4 pt-4">
                <NavHeader title={quiz.title} />
            </div>

            <div className="flex flex-col gap-4 px-4 pb-8">
                {stage === 'start' && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-4"
                    >
                        {mascotImg}
                        <Card className="p-4 text-center">
                            <h2 className="text-lg font-bold">
                                {quiz.emoji} {quiz.title}
                            </h2>
                            <p className="mt-1 text-sm text-grey-1">{quiz.description}</p>
                            <p className="mt-2 text-xs text-grey-1">
                                {quiz.questions.length} questions · no timer · the explanations are the point
                            </p>
                        </Card>
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="w-full"
                            onClick={() => beginRun(quiz.questions.map((_, i) => i))}
                        >
                            Crack me open 🥜
                        </Button>
                    </motion.div>
                )}

                {stage === 'playing' && question && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold" aria-label={`Question ${position + 1} of ${total}`}>
                                {order.map((_, i) => (
                                    <span key={i} className={i <= position ? '' : 'opacity-25'}>
                                        🥜
                                    </span>
                                ))}
                            </span>
                            <span className="rounded-sm border border-n-1 bg-white px-2 py-0.5 text-xs font-bold">
                                ⭐ {points}
                            </span>
                            <AnimatePresence>
                                {streak >= 3 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                        className="rounded-sm border border-n-1 bg-yellow-1 px-2 py-0.5 text-xs font-bold"
                                    >
                                        🔥 {streak} streak{streak >= 5 ? ' — UNSHELLED' : ''}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        {mascotImg}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={questionIndex}
                                initial={{ opacity: 0, x: 24 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -24 }}
                                className="flex flex-col gap-3"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`rounded-sm border border-n-1 px-2 py-0.5 text-xs font-bold ${LEVEL_CHIP_CLASS[question.level]}`}
                                    >
                                        {LEVEL_LABEL[question.level]}
                                    </span>
                                    <span className="text-xs text-grey-1">+{LEVEL_POINTS[question.level]} pts</span>
                                </div>
                                <Card className="p-4">
                                    <p className="text-sm font-bold">{question.prompt}</p>
                                </Card>

                                <div className="flex flex-col gap-2">
                                    {(optionOrders[questionIndex] ?? question.options.map((_, i) => i)).map(
                                        (originalIndex) => {
                                            const isCorrect = originalIndex === question.correctIndex
                                            const isChosen = originalIndex === chosen
                                            const revealed = chosen !== null
                                            return (
                                                <motion.button
                                                    key={originalIndex}
                                                    type="button"
                                                    whileTap={revealed ? undefined : { scale: 0.97 }}
                                                    onClick={() => answer(originalIndex)}
                                                    disabled={revealed}
                                                    className={`rounded-sm border border-n-1 p-3 text-left text-sm transition-colors ${
                                                        revealed && isCorrect
                                                            ? 'bg-green-1 font-bold'
                                                            : revealed && isChosen
                                                              ? 'bg-primary-1'
                                                              : revealed
                                                                ? 'opacity-50'
                                                                : 'bg-white hover:bg-primary-3'
                                                    }`}
                                                >
                                                    {question.options[originalIndex]}
                                                    {revealed && isCorrect && ' ✅'}
                                                    {revealed && isChosen && !isCorrect && ' ❌'}
                                                </motion.button>
                                            )
                                        }
                                    )}
                                </div>

                                {chosen !== null && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                        <Card
                                            className={`p-3 ${answeredCorrectly ? 'bg-green-1/30' : 'bg-primary-3/40'}`}
                                        >
                                            {!answeredCorrectly && question.wrongQuip && (
                                                <p className="mb-1 text-xs font-bold">🥜 {question.wrongQuip}</p>
                                            )}
                                            <p className="text-xs">{question.explanation}</p>
                                        </Card>
                                        <Button variant="purple" shadowSize="4" className="mt-3 w-full" onClick={next}>
                                            {position + 1 >= total ? 'See my score' : 'Next 🥜'}
                                        </Button>
                                    </motion.div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}

                {stage === 'done' && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-4"
                    >
                        {mascotImg}
                        <Card className="p-4 text-center">
                            <button
                                type="button"
                                className="text-3xl font-bold outline-none"
                                onClick={() => setScoreClicks((c) => c + 1)}
                            >
                                {correctCount}/{total}
                            </button>
                            <h2 className="mt-1 text-lg font-bold">{grade.title}</h2>
                            <p className="text-sm text-grey-1">{grade.subtitle}</p>
                            <p className="mt-2 rounded-sm border border-n-1 bg-primary-3 p-2 text-sm font-bold">
                                ⭐ {points} points
                            </p>
                            {missed.length === 0 && (
                                <p className="mt-2 rounded-sm border border-n-1 bg-yellow-1 p-2 text-xs font-bold">
                                    ✨ FLAWLESS — not a single shell dropped
                                </p>
                            )}
                            {bestStreak >= 5 && (
                                <p className="mt-2 text-xs text-grey-1">Best streak: {bestStreak} 🔥</p>
                            )}
                            {scoreClicks >= 3 && (
                                <p className="mt-2 text-xs italic text-grey-1">
                                    …the real funnel was the definitions we learned along the way.
                                </p>
                            )}
                        </Card>

                        <div className="flex gap-2">
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                disabled={shareState === 'busy'}
                                onClick={() => share('copy')}
                            >
                                {shareState === 'copied' ? 'Copied! 📋' : 'Copy share card'}
                            </Button>
                            <Button
                                variant="stroke"
                                className="w-full"
                                disabled={shareState === 'busy'}
                                onClick={() => share('download')}
                            >
                                {shareState === 'downloaded' ? 'Saved! 💾' : 'Download'}
                            </Button>
                        </div>
                        {shareState === 'failed' && (
                            <p className="text-center text-xs text-grey-1">
                                Could not build the share card — screenshot me instead 🥜
                            </p>
                        )}
                        {missed.length > 0 && (
                            <Button variant="purple" shadowSize="4" className="w-full" onClick={() => beginRun(missed)}>
                                Retry the {missed.length} I missed
                            </Button>
                        )}
                        <Button
                            variant="stroke"
                            className="w-full"
                            onClick={() => beginRun(quiz.questions.map((_, i) => i))}
                        >
                            Play again from the top
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
