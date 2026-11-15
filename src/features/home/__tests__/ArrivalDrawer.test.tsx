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
const mockSetScannerOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsQRScannerOpen: mockSetScannerOpen }),
}))
let mockArrival: Arrival | null = null
const mockDismissArrival = jest.fn(() => {
    mockArrival = null
})
jest.mock('../arrival-session', () => ({
    currentArrival: () => mockArrival,
    subscribeArrival: () => () => {},
    dismissArrival: () => mockDismissArrival(),
}))
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

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

import ArrivalDrawer from '../components/ArrivalDrawer'
import { run } from '@/features/attention/__tests__/legacy-manager.fixture'

const surfaceProps = (onActed = jest.fn(), onDismissed = jest.fn()) => ({
    askId: 'arrival' as const,
    presentation: 'drawer' as const,
    onActed,
    onDismissed,
    onSnoozed: jest.fn(),
})

const arrival = (prompt: Arrival['prompt'], country: string): Arrival => ({ userId: 'u1', country, prompt })

beforeEach(() => {
    jest.clearAllMocks()
    mockArrival = null
})

it.each([
    ['qr_ar', 'AR', '/flags/ar.svg'],
    ['pix_br', 'BR', '/flags/br.svg'],
    ['card', 'ES', null],
] as const)('renders the %s variant and tracks it once with country and prompt', (prompt, country, flag) => {
    const shown = arrival(prompt, country)
    mockArrival = shown
    const { container, rerender } = render(<ArrivalDrawer {...surfaceProps()} />)
    expect(screen.getByRole('heading')).toHaveTextContent(`home.arrival.${prompt}.title`)
    expect(screen.getByText(`home.arrival.${prompt}.description`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `home.arrival.${prompt}.cta` })).toBeInTheDocument()
    // Argentina and Brazil show their flag in place of the QR bubble; the card keeps its bubble
    if (flag) {
        expect(container.querySelector('img')?.getAttribute('src')).toBe(flag)
        expect(screen.queryByTestId('icon')).toBeNull()
    } else {
        expect(screen.getByTestId('icon')).toHaveTextContent('credit-card')
        expect(container.querySelector('img')).toBeNull()
    }
    rerender(<ArrivalDrawer {...surfaceProps()} />)
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_shown', { country, prompt })
})

it('a QR prompt opens the scanner and closes itself', () => {
    const onActed = jest.fn()
    mockArrival = arrival('pix_br', 'BR')
    render(<ArrivalDrawer {...surfaceProps(onActed)} />)
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.pix_br.cta' }))
    expect(mockSetScannerOpen).toHaveBeenCalledWith(true)
    expect(mockPush).not.toHaveBeenCalled()
    // the scanner opens first, so Home never sees a cleared prompt with the scanner shut
    expect(mockSetScannerOpen.mock.invocationCallOrder[0]).toBeLessThan(onActed.mock.invocationCallOrder[0])
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_cta_clicked', { country: 'BR', prompt: 'pix_br' })
})

it('the card prompt opens the card screen', () => {
    mockArrival = arrival('card', 'ES')
    render(<ArrivalDrawer {...surfaceProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.card.cta' }))
    expect(mockPush).toHaveBeenCalledWith('/card')
    expect(mockSetScannerOpen).not.toHaveBeenCalled()
})

it('not now dismisses without a CTA event', () => {
    const onDismiss = jest.fn()
    mockArrival = arrival('qr_ar', 'AR')
    render(<ArrivalDrawer {...surfaceProps(jest.fn(), onDismiss)} />)
    fireEvent.click(screen.getByText('home.arrival.notNow'))
    expect(onDismiss).toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalledWith('arrival_prompt_cta_clicked', expect.anything())
})

it.each([
    ['a higher Home prompt is up', { isNative: false, migration: { on: true }, arrival: 'raised' }, {}],
    ['another drawer or modal is open', { arrival: 'raised' }, { busy: true }],
    ['the QR scanner is open', { arrival: 'raised' }, { busy: true }],
] as const)('the manager does not select arrival while %s', (_, facts, session) => {
    const result = run(facts, session)
    expect(result.interrupt).not.toBe('arrival')
    expect(mockCapture).not.toHaveBeenCalled()
})
