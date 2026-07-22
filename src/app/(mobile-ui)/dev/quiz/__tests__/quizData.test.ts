import { QUIZZES } from '../registry'

describe('quiz registry data', () => {
    it('has unique slugs', () => {
        const slugs = QUIZZES.map((q) => q.slug)
        expect(new Set(slugs).size).toBe(slugs.length)
    })

    it.each(QUIZZES.map((q) => [q.slug, q] as const))('%s is well-formed', (_slug, quiz) => {
        expect(quiz.questions.length).toBeGreaterThan(0)
        expect(quiz.grades.some((g) => g.minFraction === 0)).toBe(true)
        for (const question of quiz.questions) {
            expect(question.options.length).toBeGreaterThanOrEqual(2)
            expect(question.options.length).toBeLessThanOrEqual(4)
            expect(question.correctIndex).toBeGreaterThanOrEqual(0)
            expect(question.correctIndex).toBeLessThan(question.options.length)
            expect(question.explanation.length).toBeGreaterThan(0)
            // duplicate option text makes the shuffled reveal ambiguous
            expect(new Set(question.options).size).toBe(question.options.length)
        }
    })
})
