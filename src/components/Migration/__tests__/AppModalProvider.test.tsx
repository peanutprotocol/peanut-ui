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
    default: ({ surface, handoff }: { surface: string; handoff?: { dest?: string } }) => (
        <div data-testid="qr-modal" data-handoff={handoff?.dest ?? ''}>
            {surface}
        </div>
    ),
}))

let handled: boolean | undefined

function Consumer() {
    const interceptAppCta = useAppModal()
    return (
        <button
            onClick={() => {
                handled = interceptAppCta(MIGRATION_SURFACES.LANDING_RATES)
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
