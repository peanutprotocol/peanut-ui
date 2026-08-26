import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import Footer from '@/components/LandingPage/Footer'
import QuestsPage from '../page'

jest.mock('next/font/google', () => ({
    Roboto_Flex: () => ({ className: 'roboto-flex' }),
}))

describe('Quests footer composition', () => {
    it('retains the server footer, including its SEO site directory', () => {
        const page = QuestsPage() as ReactElement<{ children: ReactNode }>
        const children = Children.toArray(page.props.children)

        expect(children.some((child) => isValidElement(child) && child.type === Footer)).toBe(true)
    })
})
