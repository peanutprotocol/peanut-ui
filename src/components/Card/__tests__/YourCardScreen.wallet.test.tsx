import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import YourCardScreen from '@/components/Card/YourCardScreen'
import { renderWithIntl } from '@/test-utils/intl'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

const mockPush = jest.fn()
const mockAdd = jest.fn()
let mockPlatform = 'android'
const available = {
    nativeAvailable: true,
    pushDisabled: false,
    alreadyInWallet: false,
    isChecking: false,
    isAdding: false,
}
let mockProvisioning = { ...available }
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => mockPlatform }))
jest.mock('@/hooks/usePushProvisioning', () => ({
    usePushProvisioning: () => ({ ...mockProvisioning, addToWallet: mockAdd }),
}))
jest.mock('@/hooks/useCardReveal', () => ({
    useCardReveal: () => ({ revealed: null, isLoading: false, toggle: jest.fn() }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}))
jest.mock('@/components/Card/CardFace', () => ({ __esModule: true, default: () => <div>Card ending 0420</div> }))
jest.mock('@/components/Card/LockCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CancelCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/ModalsContext', () => {
    const modals = { setIsSupportModalOpen: jest.fn() }
    return { useModalsContext: () => modals, useModalsContextOptional: () => modals }
})
jest.mock('@/hooks/wallet/useCardCollateralReturn', () => ({
    useCardCollateralReturn: () => ({ returnCollateral: jest.fn(), isReturning: false, lastError: null }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/hooks/useCardFundingAccess', () => ({ useCardFundingAccess: () => ({ access: undefined }) }))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({
        unoptimized: _unoptimized,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} />,
}))

const card = { id: 'card-1', last4: '0420', status: 'ACTIVE', expiryMonth: 12, expiryYear: 2030 } as RainCardSummary
const overview = { balance: {} } as RainCardOverview
const renderScreen = () => renderWithIntl(<YourCardScreen card={card} overview={overview} />)

beforeEach(() => {
    jest.clearAllMocks()
    mockPlatform = 'android'
    mockProvisioning = { ...available }
    mockAdd.mockResolvedValue({ added: false, canceled: true })
})

it('starts Android provisioning only from the official Google button', () => {
    renderScreen()
    const button = screen.getByRole('button', { name: 'Add to Google Wallet' })
    expect(Array.from(button.querySelectorAll('img'), (image) => image.getAttribute('src'))).toEqual([
        '/wallet/google/one-line/en.svg',
        '/wallet/google/two-line/en.svg',
    ])
    expect(screen.getAllByRole('button', { name: 'Add to Google Wallet' })).toHaveLength(1)
    fireEvent.click(button)
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it.each([
    ['a new add', { added: true }],
    ['a card already in the wallet', { added: false, alreadyInWallet: true }],
])('confirms %s with an "Added to Google Wallet" toast', async (_name, result) => {
    mockAdd.mockResolvedValue(result)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Add to Google Wallet' }))
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Added to Google Wallet'))
    expect(mockToastError).not.toHaveBeenCalled()
})

describe.each([
    ['android', 'Google'],
    ['ios', 'Apple'],
])('%s wallet controls', (platform, wallet) => {
    const addLabel = `Add to ${wallet} Wallet`
    const controls = () => screen.queryAllByRole('button', { name: addLabel })

    beforeEach(() => {
        mockPlatform = platform
    })

    it.each([
        ['checking', { isChecking: true }],
        ['already in the wallet', { alreadyInWallet: true, nativeAvailable: false }],
    ])('shows neither control nor a status when %s', (_state, fields) => {
        mockProvisioning = { ...available, ...fields }
        renderScreen()
        expect(controls()).toHaveLength(0)
        expect(screen.queryByText(`Added to ${wallet} Wallet`)).not.toBeInTheDocument()
    })

    it.each([
        ['push unavailable', { nativeAvailable: false }],
        ['push disabled', { pushDisabled: true }],
    ])('shows only the manual row with %s', (_state, fields) => {
        mockProvisioning = { ...available, ...fields }
        renderScreen()
        expect(controls()).toHaveLength(1)
        const row = screen.getByRole('button', { name: addLabel })
        expect(row.querySelector('img')).toBeNull()
        fireEvent.click(row)
        expect(mockPush).toHaveBeenCalledWith('/card/add-to-wallet')
        expect(mockAdd).not.toHaveBeenCalled()
    })

    it.each([false, true])('shows the failure toast and one control when pushDisabled is %s', async (pushDisabled) => {
        mockAdd.mockResolvedValue({ added: false, error: 'Push failed' })
        const { rerender } = renderScreen()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: addLabel }))
        })
        mockProvisioning.pushDisabled = pushDisabled
        rerender(<YourCardScreen card={card} overview={overview} />)

        expect(mockToastError).toHaveBeenCalledWith("Couldn't add the card to your wallet. Please try again.")
        expect(mockToastSuccess).not.toHaveBeenCalled()
        expect(controls()).toHaveLength(1)
        expect(Boolean(controls()[0].querySelector('img'))).toBe(!pushDisabled)
    })

    it('keeps the official control and stays quiet when the sheet is closed', async () => {
        renderScreen()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: addLabel }))
        })
        expect(mockAdd).toHaveBeenCalledTimes(1)
        expect(mockToastSuccess).not.toHaveBeenCalled()
        expect(mockToastError).not.toHaveBeenCalled()
        expect(controls()).toHaveLength(1)
        expect(controls()[0].querySelector('img')).toBeInTheDocument()
    })
})

it('disables the Google control during provisioning', () => {
    mockProvisioning.isAdding = true
    renderScreen()
    expect(screen.getByRole('button', { name: 'Add to Google Wallet' })).toBeDisabled()
})

it('starts Apple provisioning only from the Apple Pay row', () => {
    mockPlatform = 'ios'
    renderScreen()
    expect(screen.queryByRole('button', { name: 'Add to Google Wallet' })).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Add to Apple Wallet' })
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/wallet/apple/apple-pay-mark.svg')
    expect(screen.getAllByRole('button', { name: 'Add to Apple Wallet' })).toHaveLength(1)
    fireEvent.click(button)
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it('disables the Apple control during provisioning', () => {
    mockPlatform = 'ios'
    mockProvisioning.isAdding = true
    renderScreen()
    const row = screen.getByRole('button', { name: 'Add to Apple Wallet' })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(row)
    expect(mockAdd).not.toHaveBeenCalled()
})

it.each(['android', 'ios'])(
    '%s: the button sits below Card management, above Pay as credit and Red zone',
    (platform) => {
        mockPlatform = platform
        renderScreen()
        const name = platform === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet'
        const order = [
            screen.getByText('Card management'),
            screen.getByRole('button', { name }),
            screen.getByText('Pay as credit'),
            screen.getByText('Red zone'),
        ]
        for (let i = 1; i < order.length; i++) {
            expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        }
    }
)

it('puts PIN then Freeze beside the card, above Card management', () => {
    renderScreen()
    const order = [
        screen.getByRole('button', { name: 'PIN' }),
        screen.getByRole('button', { name: 'Freeze' }),
        screen.getByText('Spending limit'),
        screen.getByText('Red zone'),
        screen.getByText('Cancel card'),
    ]
    for (let i = 1; i < order.length; i++) {
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
})

it('offers no physical-card list to join', () => {
    renderScreen()
    expect(screen.queryByText('Physical card')).not.toBeInTheDocument()
})

it('opens the PIN page from its control', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'PIN' }))
    expect(mockPush).toHaveBeenCalledWith('/card/pin')
})

it('a frozen card offers Unfreeze, pressed', () => {
    renderWithIntl(<YourCardScreen card={{ ...card, status: 'LOCKED' }} overview={overview} />)
    const control = screen.getByRole('button', { name: 'Unfreeze' })
    expect(control).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Freeze' })).toBeNull()
})
