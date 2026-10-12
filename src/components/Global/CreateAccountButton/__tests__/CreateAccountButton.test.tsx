import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import CreateAccountButton from '..'

const mockIntercept = jest.fn()
let mockHandoffActive = true

jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({
        interceptGuestCta: (...args: unknown[]) => mockIntercept(...args),
        storeHandoffModal: mockHandoffActive ? <div data-testid="scan-modal" /> : null,
        handoffActive: mockHandoffActive,
    }),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockHandoffActive = true
})

describe('CreateAccountButton', () => {
    it('asks a guest to download the app instead of opening web signup', () => {
        mockIntercept.mockReturnValue(true)
        const onClick = jest.fn()
        renderWithIntl(<CreateAccountButton onClick={onClick} />)

        expect(screen.getByRole('button')).toHaveTextContent('Download Peanut')
        fireEvent.click(screen.getByRole('button'))

        expect(mockIntercept).toHaveBeenCalled()
        expect(onClick).not.toHaveBeenCalled()
    })

    // The copy must never promise a download the click cannot deliver: flag off
    // or native app means the old signup CTA, unchanged.
    it('keeps the signup CTA when the store hand-off is not active', () => {
        mockHandoffActive = false
        mockIntercept.mockReturnValue(false)
        const onClick = jest.fn()
        renderWithIntl(<CreateAccountButton onClick={onClick} />)

        expect(screen.getByRole('button')).not.toHaveTextContent('Download Peanut')
        fireEvent.click(screen.getByRole('button'))

        expect(onClick).toHaveBeenCalled()
    })
})
