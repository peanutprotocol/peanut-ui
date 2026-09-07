import { fireEvent, render, screen } from '@testing-library/react'
import { AppModalProvider, useAppModal } from '../AppModalProvider'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType } from '@/hooks/useGetDeviceType'

const mockMigrationOn = jest.fn(() => true)
const mockDeviceType = jest.fn(() => DeviceType.WEB)
const mockOpenStore = jest.fn()

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: mockDeviceType() }),
}))
jest.mock('@/utils/migration.utils', () => ({
    openStore: (...args: unknown[]) => mockOpenStore(...args),
}))
jest.mock('@/components/Migration/ScanToDownloadModal', () => ({
    __esModule: true,
    default: ({ surface }: { surface: string }) => <div data-testid="qr-modal">{surface}</div>,
}))

let handled: boolean | undefined

function Consumer() {
    const interceptAppCta = useAppModal()
    return (
        <button
            onClick={() => {
                handled = interceptAppCta(MIGRATION_SURFACES.LANDING_RATES, { dest: '/send' })
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

describe('AppModalProvider', () => {
    beforeEach(() => {
        handled = undefined
        mockMigrationOn.mockReturnValue(true)
        mockDeviceType.mockReturnValue(DeviceType.WEB)
        mockOpenStore.mockClear()
    })

    it('opens one modal, tagged with the calling surface, on desktop', () => {
        renderCta()
        expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'cta' }))

        expect(handled).toBe(true)
        expect(screen.getByTestId('qr-modal')).toHaveTextContent('landing_rates')
        expect(mockOpenStore).not.toHaveBeenCalled()
    })

    it('bounces a phone straight to its store, carrying the hand-off', () => {
        mockDeviceType.mockReturnValue(DeviceType.ANDROID)
        renderCta()

        fireEvent.click(screen.getByRole('button', { name: 'cta' }))

        expect(handled).toBe(true)
        expect(mockOpenStore).toHaveBeenCalledWith('android', 'landing_rates', { dest: '/send' })
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
