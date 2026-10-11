import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import YourCardScreen from '@/components/Card/YourCardScreen'
import { renderWithIntl } from '@/test-utils/intl'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

const mockPush = jest.fn()
const mockAdd = jest.fn()
let mockPlatform = 'android'
let mockProvisioning = { nativeAvailable: true, alreadyInWallet: false, isAdding: false }
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => mockPlatform }))
jest.mock('@/hooks/usePushProvisioning', () => ({
    usePushProvisioning: () => ({ ...mockProvisioning, addToWallet: mockAdd }),
}))
jest.mock('@/hooks/useCardReveal', () => ({
    useCardReveal: () => ({ revealed: null, isLoading: false, toggle: jest.fn() }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }))
jest.mock('@/components/Card/CardFace', () => ({ __esModule: true, default: () => <div>Card ending 0420</div> }))
jest.mock('@/components/Card/LockCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CancelCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
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
    mockProvisioning = { nativeAvailable: true, alreadyInWallet: false, isAdding: false }
    mockAdd.mockResolvedValue({ added: false, canceled: true })
})

it('starts Android provisioning only from the official Google button', () => {
    renderScreen()
    const button = screen.getByRole('button', { name: 'Add to Google Wallet' })
    expect(button.querySelector('img')).toHaveAttribute('src', '/wallet/google/en.svg')
    expect(screen.getAllByRole('button', { name: 'Add to Google Wallet' })).toHaveLength(1)
    fireEvent.click(button)
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
})

it('preserves manual instructions when the Google flag or native SDK is unavailable', () => {
    mockProvisioning.nativeAvailable = false
    renderScreen()
    const row = screen.getByRole('button', { name: 'Add to Google Wallet' })
    expect(row.querySelector('img')).toBeNull()
    fireEvent.click(row)
    expect(mockPush).toHaveBeenCalledWith('/card/add-to-wallet')
    expect(mockAdd).not.toHaveBeenCalled()
})

it('replaces the Google action with a status once the card is provisioned', () => {
    mockProvisioning = { nativeAvailable: false, alreadyInWallet: true, isAdding: false }
    renderScreen()
    expect(screen.getByText('Added to Google Wallet')).toHaveTextContent('Added to Google Wallet')
    expect(screen.queryByRole('button', { name: 'Add to Google Wallet' })).not.toBeInTheDocument()
})

it('disables the Google control during provisioning', () => {
    mockProvisioning.isAdding = true
    renderScreen()
    expect(screen.getByRole('button', { name: 'Add to Google Wallet' })).toBeDisabled()
})

it('keeps Apple on its existing platform control', () => {
    mockPlatform = 'ios'
    renderScreen()
    expect(screen.queryByRole('button', { name: 'Add to Google Wallet' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }))
    expect(mockAdd).toHaveBeenCalledTimes(1)
})
