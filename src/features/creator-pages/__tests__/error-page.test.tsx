/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import CreatorPageError from '@/app/c/[username]/error'
import { captureException } from '@/utils/sentry-lazy'

jest.mock('next/navigation', () => ({ useParams: () => ({ username: 'JuanAcervio' }) }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))

describe('/c/<username> error page', () => {
    it('links to the creator invite and reports the error to Sentry', () => {
        const error = new Error('page threw')
        jest.spyOn(console, 'error').mockImplementation(() => {})
        render(<CreatorPageError error={error} />)
        expect(screen.getByRole('link', { name: 'Continue to Peanut' })).toHaveAttribute(
            'href',
            '/invite?code=juanacervio'
        )
        expect(captureException).toHaveBeenCalledWith(error)
    })
})
