jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Arrival } from '../arrival.types'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('next-intl', () => ({ useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockScannerOpen = false
const mockSetScannerOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isQRScannerOpen: mockScannerOpen, setIsQRScannerOpen: mockSetScannerOpen }),
}))
let mockOtherOverlayOpen = false
jest.mock('@/utils/overlay-visibility', () => ({ useOtherOpenOverlays: () => mockOtherOverlayOpen }))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({
    IconBubble: ({ icon }: { icon: string }) => <span data-testid="icon">{icon}</span>,
}))
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: (props: { open: boolean; children: React.ReactNode }) =>
        props.open ? <div data-testid="drawer">{props.children}</div> : null,
    DrawerContent: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
    DrawerHeader: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
    DrawerTitle: (props: { children: React.ReactNode }) => <h2>{props.children}</h2>,
    DrawerDescription: (props: { children: React.ReactNode }) => <p>{props.children}</p>,
}))

import ArrivalDrawer from '../components/ArrivalDrawer'

const arrival = (prompt: Arrival['prompt'], country: string): Arrival => ({ userId: 'u1', country, prompt })

beforeEach(() => {
    jest.clearAllMocks()
    mockScannerOpen = false
    mockOtherOverlayOpen = false
})

it.each([
    ['qr_ar', 'AR', 'qr-code'],
    ['pix_br', 'BR', 'qr-code'],
    ['card', 'ES', 'credit-card'],
] as const)('renders the %s variant and tracks it once with country and prompt', (prompt, country, icon) => {
    const shown = arrival(prompt, country)
    const { rerender } = render(<ArrivalDrawer arrival={shown} blocked={false} onDismiss={jest.fn()} />)
    expect(screen.getByRole('heading')).toHaveTextContent(`home.arrival.${prompt}.title`)
    expect(screen.getByText(`home.arrival.${prompt}.description`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `home.arrival.${prompt}.cta` })).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toHaveTextContent(icon)
    rerender(<ArrivalDrawer arrival={shown} blocked={false} onDismiss={jest.fn()} />)
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_shown', { country, prompt })
})

it('a QR prompt opens the scanner and closes itself', () => {
    const onDismiss = jest.fn()
    render(<ArrivalDrawer arrival={arrival('pix_br', 'BR')} blocked={false} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.pix_br.cta' }))
    expect(mockSetScannerOpen).toHaveBeenCalledWith(true)
    expect(mockPush).not.toHaveBeenCalled()
    // the scanner opens first, so Home never sees a cleared prompt with the scanner shut
    expect(mockSetScannerOpen.mock.invocationCallOrder[0]).toBeLessThan(onDismiss.mock.invocationCallOrder[0])
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_cta_clicked', { country: 'BR', prompt: 'pix_br' })
})

it('the card prompt opens the card screen', () => {
    render(<ArrivalDrawer arrival={arrival('card', 'ES')} blocked={false} onDismiss={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.card.cta' }))
    expect(mockPush).toHaveBeenCalledWith('/card')
    expect(mockSetScannerOpen).not.toHaveBeenCalled()
})

it('not now dismisses without a CTA event', () => {
    const onDismiss = jest.fn()
    render(<ArrivalDrawer arrival={arrival('qr_ar', 'AR')} blocked={false} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('home.arrival.notNow'))
    expect(onDismiss).toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalledWith('arrival_prompt_cta_clicked', expect.anything())
})

it.each([
    ['a higher Home prompt is up', () => ({ blocked: true })],
    ['another drawer or modal is open', () => ((mockOtherOverlayOpen = true), { blocked: false })],
    ['the QR scanner is open', () => ((mockScannerOpen = true), { blocked: false })],
])('shows nothing and tracks nothing while %s', (_, setup) => {
    const { blocked } = setup()
    render(<ArrivalDrawer arrival={arrival('qr_ar', 'AR')} blocked={blocked} onDismiss={jest.fn()} />)
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
    expect(mockCapture).not.toHaveBeenCalled()
})
