export type QuizLevel = 'easy' | 'mid' | 'hard'

/** Points awarded per correct answer, by level. Streak bonus lives in the engine. */
export const LEVEL_POINTS: Record<QuizLevel, number> = { easy: 100, mid: 200, hard: 300 }

export interface QuizQuestion {
    /** Difficulty tier — the quiz plays easy → mid → hard. */
    level: QuizLevel
    /** The question text. Keep it concrete — quote a real scenario where possible. */
    prompt: string
    /** 2-4 answer options. Distractors should be plausible, not jokes (jokes go in quips). */
    options: string[]
    /** Index into options of the correct answer. */
    correctIndex: number
    /** Shown after answering — THE teaching moment. Explain why, not just what. */
    explanation: string
    /** Optional mascot one-liner shown when the user gets this one wrong. */
    wrongQuip?: string
}

export interface QuizDefinition {
    /** URL slug — quiz lives at /dev/quiz/<slug> */
    slug: string
    title: string
    /** One-liner shown on the hub card and start screen. */
    description: string
    /** Emoji shown next to the title. */
    emoji: string
    questions: QuizQuestion[]
    /** Grade titles by score fraction, checked top-down (first match wins). */
    grades: { minFraction: number; title: string; subtitle: string }[]
}
