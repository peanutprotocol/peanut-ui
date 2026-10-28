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
    useModalsContext: () => ({ isQRScannerOpen: false, setIsQRScannerOpen: mockSetScannerOpen }),
}))
let mockArrival: Arrival | null = null
const mockDismissArrival = jest.fn()
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

const arrival = (prompt: Arrival['prompt'], country: string): Arrival => ({ userId: 'u1', country, prompt })

const onActed = jest.fn()
const onDismissed = jest.fn()
const surface = () => (
    <ArrivalDrawer
        presentation="drawer"
        askId="arrival"
        onActed={onActed}
        onDismissed={onDismissed}
        onSnoozed={jest.fn()}
    />
)

beforeEach(() => {
    jest.clearAllMocks()
    mockArrival = null
})

it.each([
    ['qr_ar', 'AR', '/flags/ar.svg'],
    ['pix_br', 'BR', '/flags/br.svg'],
    ['card', 'ES', null],
] as const)('renders the %s variant and tracks it once with country and prompt', (prompt, country, flag) => {
    mockArrival = arrival(prompt, country)
    const { container, rerender } = render(surface())
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
    rerender(surface())
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_shown', { country, prompt })
})

it('a QR prompt opens the scanner, clears the arrival and reports acted', () => {
    mockArrival = arrival('pix_br', 'BR')
    render(surface())
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.pix_br.cta' }))
    expect(mockSetScannerOpen).toHaveBeenCalledWith(true)
    expect(mockPush).not.toHaveBeenCalled()
    // the scanner opens first, so the manager never sees a cleared prompt with the scanner shut
    expect(mockSetScannerOpen.mock.invocationCallOrder[0]).toBeLessThan(onActed.mock.invocationCallOrder[0])
    expect(mockSetScannerOpen.mock.invocationCallOrder[0]).toBeLessThan(mockDismissArrival.mock.invocationCallOrder[0])
    expect(onDismissed).not.toHaveBeenCalled()
    expect(mockCapture).toHaveBeenCalledWith('arrival_prompt_cta_clicked', { country: 'BR', prompt: 'pix_br' })
})

it('the card prompt opens the card screen', () => {
    mockArrival = arrival('card', 'ES')
    render(surface())
    fireEvent.click(screen.getByRole('button', { name: 'home.arrival.card.cta' }))
    expect(mockPush).toHaveBeenCalledWith('/card')
    expect(mockSetScannerOpen).not.toHaveBeenCalled()
    expect(onActed).toHaveBeenCalledTimes(1)
})

it('not now clears the arrival and reports dismissed, without a CTA event', () => {
    mockArrival = arrival('qr_ar', 'AR')
    render(surface())
    fireEvent.click(screen.getByText('home.arrival.notNow'))
    expect(mockDismissArrival).toHaveBeenCalledTimes(1)
    expect(onDismissed).toHaveBeenCalledTimes(1)
    expect(onActed).not.toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalledWith('arrival_prompt_cta_clicked', expect.anything())
})

it('renders and tracks nothing once the arrival is gone', () => {
    render(surface())
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
    expect(mockCapture).not.toHaveBeenCalled()
})
