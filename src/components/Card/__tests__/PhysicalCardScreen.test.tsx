/**
 * PhysicalCardScreen — waitlist "on the list" copy contract.
 *
 * The joined branch is gated on joinedAt, but the API types position as
 * nullable, so a joined user can have no queue position. Interpolating it
 * blindly renders "You are #null on the list."
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import PhysicalCardScreen from '@/components/Card/PhysicalCardScreen'
import { rainApi } from '@/services/rain'

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { getPhysicalWaitlist: jest.fn(), joinPhysicalWaitlist: jest.fn() },
}))

const mockGet = rainApi.getPhysicalWaitlist as jest.Mock

const renderScreen = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
            <QueryClientProvider client={queryClient}>
                <PhysicalCardScreen cardId="card-1" last4="4242" />
            </QueryClientProvider>
        </NextIntlClientProvider>
    )
}

describe('PhysicalCardScreen — joined waitlist copy', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the queue position when the API returns one', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: 42 })
        renderScreen()
        expect(await screen.findByText(/You are #42 on the list\./)).toBeInTheDocument()
    })

    it('omits the position rather than rendering "#null" when there is none', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: null })
        renderScreen()
        const body = await screen.findByText(/You are on the list\./)
        expect(body).toBeInTheDocument()
        expect(body.textContent).not.toMatch(/#/)
    })

    // Derived rather than hardcoded: the separator is locale-dependent, and the
    // contract is that the copy delegates to toLocaleString, not that it says "1,234".
    it('formats large positions with thousands separators', async () => {
        mockGet.mockResolvedValue({ joinedAt: '2026-01-01T00:00:00Z', position: 1234 })
        renderScreen()
        const body = await screen.findByText(/on the list\./)
        expect(body.textContent).toContain(`You are #${(1234).toLocaleString()} on the list.`)
    })
})
