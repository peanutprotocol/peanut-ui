import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ContactsView from '../Contacts.view'

const mockCheckUsername = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/send',
}))
jest.mock('@/hooks/useContacts', () => ({
    useContacts: () => ({
        contacts: [],
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn(),
    }),
}))
jest.mock('@/services/users', () => ({
    usersApi: { checkUsername: (...args: unknown[]) => mockCheckUsername(...args) },
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => ({ loaderRef: { current: null } }) }))
jest.mock('@/components/Global/ValidatedInput', () => ({
    __esModule: true,
    default: ({
        onUpdate,
        validate,
    }: {
        onUpdate: (update: { value: string; isValid: boolean; isChanging: boolean }) => void
        validate: (value: string) => Promise<boolean>
    }) => (
        <>
            <button
                type="button"
                onClick={() => {
                    onUpdate({ value: 'alice1', isValid: false, isChanging: true })
                    void validate('alice1')
                }}
            >
                Start username check
            </button>
            <button type="button" onClick={() => onUpdate({ value: '', isValid: false, isChanging: false })}>
                Clear username
            </button>
        </>
    ),
}))

describe('ContactsView clearing an exact username', () => {
    it('ignores a late lookup failure after the clear callback', async () => {
        let rejectLookup: (reason: Error) => void = () => undefined
        mockCheckUsername.mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejectLookup = reject
                })
        )

        renderWithIntl(<ContactsView onPrev={jest.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Start username check' }))
        expect(mockCheckUsername).toHaveBeenCalledWith('alice1')
        fireEvent.click(screen.getByRole('button', { name: 'Clear username' }))

        await act(async () => rejectLookup(new Error('timeout')))

        expect(screen.queryByText("We couldn't check that username. Please try again.")).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })
})
