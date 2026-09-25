import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import HomeCarouselCTA from '../index'

const mockDismissCTA = jest.fn()
let mockCTAs: Array<Record<string, unknown>> = []
jest.mock('@/hooks/useHomeCarouselCTAs', () => ({
    useHomeCarouselCTAs: () => ({ carouselCTAs: mockCTAs, dismissCTA: mockDismissCTA }),
}))
const mockStart = jest.fn()
let mockFlow: { start: jest.Mock; startedTaskKey: string | null; isLoading: boolean; error: string | null }
jest.mock('@/hooks/useDocumentRequestFlow', () => ({
    useDocumentRequestFlow: () => ({ ...mockFlow, modals: null }),
}))
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))

const documentRequest: NextAction = {
    key: 'sumsub:eea_uplift',
    kind: 'sumsub',
    purpose: 'unlock-bridge-sepa',
    effectiveDate: '2099-10-01',
    requirementKey: 'nationalities',
}

describe('HomeCarouselCTA — document request slide', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockCTAs = [{ id: 'invite-friends', title: 'Invite friends', description: 'Earn together', icon: 'gift' }]
        mockFlow = { start: mockStart, startedTaskKey: null, isLoading: false, error: null }
    })

    it('leads the carousel with the deadline, has no close button, and a tap starts the document flow', () => {
        render(<HomeCarouselCTA documentRequest={documentRequest} />)

        const titles = screen.getAllByText(/One more document needed|Invite friends/)
        expect(titles[0]).toHaveTextContent('One more document needed')
        expect(screen.getByText('Due October 1, 2099 to keep bank transfers running.')).toBeInTheDocument()
        // one close button: the invite slide's, not the document request's
        expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1)

        fireEvent.click(screen.getByText('One more document needed'))
        expect(mockStart).toHaveBeenCalledWith(documentRequest)
    })

    it('renders the slide even when no other carousel item qualifies', () => {
        mockCTAs = []
        render(<HomeCarouselCTA documentRequest={documentRequest} />)
        expect(screen.getByText('One more document needed')).toBeInTheDocument()
    })

    it('a failed start shows an error toast instead of doing nothing', () => {
        const view = render(<HomeCarouselCTA documentRequest={documentRequest} />)
        mockFlow = {
            ...mockFlow,
            startedTaskKey: documentRequest.key,
            error: 'This verification step could not start.',
        }
        view.rerender(<HomeCarouselCTA documentRequest={documentRequest} />)
        expect(mockToastError).toHaveBeenCalledWith('This verification step could not start.')
    })

    it('without a document request the carousel is unchanged', () => {
        render(<HomeCarouselCTA />)
        expect(screen.queryByText('One more document needed')).not.toBeInTheDocument()
        expect(screen.getByText('Invite friends')).toBeInTheDocument()
    })
})
