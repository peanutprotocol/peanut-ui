import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import QuizEngine from '../QuizEngine'
import type { QuizDefinition } from '../types'

jest.mock('@/assets/mascot', () => ({
    PeanutCheering: { src: 'cheer' },
    PeanutCrying: { src: 'cry' },
    PeanutSad: { src: 'sad' },
    PeanutThinking: { src: 'think' },
    PeanutTooCool: { src: 'cool' },
    PeanutWavingHello: { src: 'wave' },
    PeanutWhistling: { src: 'whistle' },
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/utils/confetti', () => ({
    shootStarConfetti: jest.fn(),
    shootDoubleStarConfetti: jest.fn(),
}))
jest.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
        {},
        {
            get:
                (_target, tag: string | symbol) =>
                // strip motion-only props before rendering the plain element
                ({ initial, animate, exit, whileTap, children, ...props }: Record<string, unknown>) =>
                    createElement(String(tag), props, children as ReactNode),
        }
    ),
}))

const quiz: QuizDefinition = {
    slug: 'test-quiz',
    title: 'Test Quiz',
    emoji: '🥜',
    description: 'test',
    grades: [
        { minFraction: 1, title: 'Perfect', subtitle: 'perfect' },
        { minFraction: 0, title: 'Raw', subtitle: 'raw' },
    ],
    questions: [
        {
            prompt: 'Only question?',
            options: ['Right answer', 'Wrong answer'],
            correctIndex: 0,
            explanation: 'Because reasons.',
        },
    ],
}

describe('QuizEngine', () => {
    it('plays a full run: start → answer correctly → explanation → grade', () => {
        render(<QuizEngine quiz={quiz} />)

        fireEvent.click(screen.getByRole('button', { name: /crack me open/i }))
        expect(screen.getByText('Only question?')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /right answer/i }))
        expect(screen.getByText('Because reasons.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /see my score/i }))
        expect(screen.getByText('Perfect')).toBeInTheDocument()
        expect(screen.getByText('1/1')).toBeInTheDocument()
    })

    it('offers retry-missed after a wrong answer', () => {
        render(<QuizEngine quiz={quiz} />)

        fireEvent.click(screen.getByRole('button', { name: /crack me open/i }))
        fireEvent.click(screen.getByRole('button', { name: /wrong answer/i }))
        expect(screen.getByText('Because reasons.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /see my score/i }))
        expect(screen.getByText('Raw')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry the 1 i missed/i })).toBeInTheDocument()
    })
})
