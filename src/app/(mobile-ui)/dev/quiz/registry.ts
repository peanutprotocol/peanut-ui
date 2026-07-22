import { funnelQuiz } from './quizzes/funnel-quiz'
import type { QuizDefinition } from './types'

// One entry per quiz. New quizzes: add a file under quizzes/ and list it here
// (the quiz-creator skill in mono/skills/quiz-creator automates this).
export const QUIZZES: QuizDefinition[] = [funnelQuiz]
