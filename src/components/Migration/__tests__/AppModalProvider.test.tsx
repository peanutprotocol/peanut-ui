import { fireEvent, render, screen } from '@testing-library/react'
import { AppModalProvider, useAppModal } from '../AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType } from '@/hooks/useGetDeviceType'
import type { MarketingQrContext } from '@/features/marketing-qr/contract'

const mockMigrationOn = jest.fn(() => true)
const mockDeviceType = jest.fn(() => DeviceType.WEB)
const mockOpenStore = jest.fn()

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType() }),
}))
jest.mock('@/utils/migration.utils', () => ({
    storeForDevice: jest.requireActual('@/utils/migration.utils').storeForDevice,
    storeIcon: jest.requireActual('@/utils/migration.utils').storeIcon,
    openStore: (...args: unknown[]) => mockOpenStore(...args),
}))
jest.mock('@/components/Migration/ScanToDownloadModal', () => ({
    __esModule: true,
    default: ({
        surface,
        handoff,
        marketingQr,
    }: {
        surface: string
        handoff?: { dest?: string }
        marketingQr?: MarketingQrContext
    }) => (
        <div
            data-testid="qr-modal"
            data-handoff={handoff?.dest ?? ''}
            data-marketing={marketingQr ? JSON.stringify(marketingQr) : ''}
        >
            {surface}
        </div>
    ),
}))

let handled: boolean | undefined

function Consumer({ placement }: { placement?: string } = {}) {
    const interceptAppCta = useAppModal()
    return (
        <button
            onClick={() => {
                handled = interceptAppCta(MIGRATION_SURFACES.LANDING_RATES, placement)
            }}
        >
            cta
        </button>
    )
}

const renderCta = () =>
    render(
        <AppModalProvider>
            <Consumer />
        </AppModalProvider>
    )

beforeEach(() => {
    handled = undefined
    mockMigrationOn.mockReturnValue(true)
    mockDeviceType.mockReturnValue(DeviceType.WEB)
    mockOpenStore.mockClear()
})

describe('AppModalProvider', () => {
    it('opens one modal, tagged with the calling surface, on desktop', async () => {
        renderCta()
        expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'cta' }))

        expect(handled).toBe(true)
        expect(await screen.findByTestId('qr-modal')).toHaveTextContent('landing_rates')
        expect(screen.getByTestId('qr-modal')).toHaveAttribute('data-handoff', '')
        expect(mockOpenStore).not.toHaveBeenCalled()
    })

    it('opens the phone store with the calling surface', () => {
        mockDeviceType.mockReturnValue(DeviceType.ANDROID)
        renderCta()

        fireEvent.click(screen.getByRole('button', { name: 'cta' }))

        expect(handled).toBe(true)
        expect(mockOpenStore).toHaveBeenCalledWith('android', 'landing_rates')
        expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
    })

    it('does nothing with the flag off, so the CTA keeps its own behaviour', () => {
        mockMigrationOn.mockReturnValue(false)
        renderCta()

        fireEvent.click(screen.getByRole('button', { name: 'cta' }))

        expect(handled).toBe(false)
        expect(mockOpenStore).not.toHaveBeenCalled()
        expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
    })

    it('is inert outside a provider', () => {
        render(<Consumer />)
        fireEvent.click(screen.getByRole('button', { name: 'cta' }))
        expect(handled).toBe(false)
    })
})

it('adds marketing context only when both provider and caller opt in', async () => {
    render(
        <AppModalProvider marketingPage="home" marketingLocale="pt-BR">
            <Consumer placement="rates" />
        </AppModalProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'cta' }))
    expect(await screen.findByTestId('qr-modal')).toHaveAttribute(
        'data-marketing',
        JSON.stringify({ page: 'home', placement: 'rates', locale: 'pt-BR' })
    )
})

it.each([undefined, 'rates'])(
    'does not infer marketing eligibility outside an opted-in page (%s)',
    async (placement) => {
        render(
            <AppModalProvider>
                <Consumer placement={placement} />
            </AppModalProvider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'cta' }))
        expect(await screen.findByTestId('qr-modal')).toHaveAttribute('data-marketing', '')
    }
)

it('does not add marketing context to an unregistered caller inside a marketing page', async () => {
    render(
        <AppModalProvider marketingPage="home">
            <Consumer />
        </AppModalProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'cta' }))
    expect(await screen.findByTestId('qr-modal')).toHaveAttribute('data-marketing', '')
})
