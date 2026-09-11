import React, { useEffect, useMemo, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { WithdrawFlowProvider, useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import InitialWithdrawView from '../../views/InitialWithdrawView'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'

jest.mock('@/lib/validation/recipient', () => ({
    validateAndResolveRecipient: jest.fn(),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        disabled,
        onClick,
    }: {
        children: React.ReactNode
        disabled: boolean
        onClick: () => void
    }) => (
        <button disabled={disabled} onClick={onClick}>
            {children}
        </button>
    ),
}))

jest.mock('@/components/Global/GeneralRecipientInput', () => ({
    __esModule: true,
    default: ({ onUpdate }: { onUpdate: (update: unknown) => void }) => (
        <button
            onClick={() =>
                onUpdate({
                    recipient: { name: 'alice.eth', address: '0x1111111111111111111111111111111111111111' },
                    isValid: true,
                    isChanging: false,
                    errorMessage: '',
                })
            }
        >
            set ENS recipient
        </button>
    ),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 1, name: 'Ethereum' },
    PEANUT_WALLET_TOKEN: '0x0000000000000000000000000000000000000000',
}))

const mockValidateAndResolveRecipient = validateAndResolveRecipient as jest.MockedFunction<
    typeof validateAndResolveRecipient
>

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

const supportedChainsAndTokens = {
    '1': { chainId: '1', networkName: 'Ethereum', chainIconURI: '', tokens: [] },
    '8453': { chainId: '8453', networkName: 'Base', chainIconURI: '', tokens: [] },
}

function TestHarness() {
    const [selectedChainID, setSelectedChainID] = useState('1')
    const tokenContext = useMemo(
        () =>
            ({
                selectedTokenData: { address: '0x0000000000000000000000000000000000000000' },
                selectedChainID,
                supportedChainsAndTokens,
                setSelectedChainID: jest.fn(),
                setSelectedTokenAddress: jest.fn(),
            }) as unknown as React.ContextType<typeof tokenSelectorContext>,
        [selectedChainID]
    )

    return (
        <WithdrawFlowProvider>
            <tokenSelectorContext.Provider value={tokenContext}>
                <button onClick={() => setSelectedChainID('8453')}>switch network</button>
                <InitialWithdrawView amount="1" onReview={jest.fn()} />
            </tokenSelectorContext.Provider>
        </WithdrawFlowProvider>
    )
}

/**
 * Mount-effect harness: optionally seeds a valid prefilled recipient (an
 * address-book tap) into the real flow context BEFORE the view mounts, and
 * exposes the token-context setters so the default reset can be asserted.
 */
function MountSeeder({
    prefillAddress,
    setSelectedChainID,
    setSelectedTokenAddress,
}: {
    prefillAddress?: string
    setSelectedChainID: jest.Mock
    setSelectedTokenAddress: jest.Mock
}) {
    const { setRecipient, setIsValidRecipient } = useWithdrawFlow()
    const [ready, setReady] = useState(!prefillAddress)
    useEffect(() => {
        if (!prefillAddress) return
        setRecipient({ name: undefined, address: prefillAddress })
        setIsValidRecipient(true)
        setReady(true)
    }, [prefillAddress, setRecipient, setIsValidRecipient])
    const tokenContext = useMemo(
        () =>
            ({
                selectedTokenData: { address: '0x0000000000000000000000000000000000000000' },
                selectedChainID: prefillAddress ? '8453' : '1',
                supportedChainsAndTokens,
                setSelectedChainID,
                setSelectedTokenAddress,
            }) as unknown as React.ContextType<typeof tokenSelectorContext>,
        [prefillAddress, setSelectedChainID, setSelectedTokenAddress]
    )
    if (!ready) return null
    return (
        <tokenSelectorContext.Provider value={tokenContext}>
            <InitialWithdrawView amount="1" onReview={jest.fn()} />
        </tokenSelectorContext.Provider>
    )
}

const renderMountHarness = (prefillAddress?: string) => {
    const setSelectedChainID = jest.fn()
    const setSelectedTokenAddress = jest.fn()
    render(
        <IntlWrapper>
            <WithdrawFlowProvider>
                <MountSeeder
                    prefillAddress={prefillAddress}
                    setSelectedChainID={setSelectedChainID}
                    setSelectedTokenAddress={setSelectedTokenAddress}
                />
            </WithdrawFlowProvider>
        </IntlWrapper>
    )
    return { setSelectedChainID, setSelectedTokenAddress }
}

describe('InitialWithdrawView', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('resets chain + token to the defaults on a fresh entry', async () => {
        const { setSelectedChainID, setSelectedTokenAddress } = renderMountHarness()
        await waitFor(() => expect(setSelectedChainID).toHaveBeenCalledWith('1'))
        expect(setSelectedTokenAddress).toHaveBeenCalledWith('0x0000000000000000000000000000000000000000')
    })

    it('keeps the address-book selection when the destination arrives prefilled', async () => {
        // an address-book tap selects the saved chain (+ its USDC) before
        // navigating here — the mount default must not move the withdraw back
        // onto the Peanut wallet chain (Chip: preserve the saved destination
        // network)
        const { setSelectedChainID, setSelectedTokenAddress } = renderMountHarness(
            '0x9999999999999999999999999999999999999999'
        )
        await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument())
        expect(setSelectedChainID).not.toHaveBeenCalled()
        expect(setSelectedTokenAddress).not.toHaveBeenCalled()
    })

    it('keeps Review disabled while an ENS name resolves for a new chain', async () => {
        const resolution = deferred<{ identifier: string; recipientType: 'ENS'; resolvedAddress: string }>()
        mockValidateAndResolveRecipient.mockReturnValue(resolution.promise)

        render(
            <IntlWrapper>
                <TestHarness />
            </IntlWrapper>
        )

        fireEvent.click(screen.getByRole('button', { name: 'set ENS recipient' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'switch network' }))

        await waitFor(() =>
            expect(mockValidateAndResolveRecipient).toHaveBeenCalledWith('alice.eth', true, 'evm', '8453')
        )
        expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()

        resolution.resolve({
            identifier: 'alice.eth',
            recipientType: 'ENS',
            resolvedAddress: '0x2222222222222222222222222222222222222222',
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled())
    })
})
