import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { encodeFunctionData, erc20Abi } from 'viem'
import { EurcMoneyReviewView, checkedCurrencyCall } from '../EurcMoneyReviewView'
import { currencyAccountsApi, type CurrencyOperation } from '@/services/currency-accounts'
const mockEnsure = jest.fn(),
    mockSign = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: () => ({ ensureClientForChain: mockEnsure }) }))
jest.mock('@/hooks/wallet/useSignUserOp', () => ({ useSignUserOp: () => ({ signCallsUserOp: mockSign }) }))
jest.mock('@/services/currency-accounts', () => ({
    currencyAccountsApi: { operation: jest.fn(), submit: jest.fn(), cancel: jest.fn() },
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/dev/fixtures/active', () => ({ peekActiveFixture: () => undefined }))
jest.mock('viem/account-abstraction', () => ({ formatUserOperationRequest: (op: unknown) => op }))
const recipient = `0x${'22'.repeat(20)}` as `0x${string}`
const operation: CurrencyOperation = {
    id: 'operation',
    kind: 'SEND',
    sourceAsset: 'EURC',
    amount: '1.000001',
    status: 'READY',
    userOpHash: null,
    txHash: null,
    errorCode: null,
    bankInstructions: null,
    call: {
        chainId: '8453',
        to: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
        value: '0',
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 1000001n] }),
    },
}
beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(currencyAccountsApi.operation).mockResolvedValue(operation)
    mockEnsure.mockResolvedValue(undefined)
    mockSign.mockResolvedValue({ signedUserOp: { signature: '0xaaaa' } })
})
it('signs only the canonical Base EURC transfer and submits after signing', async () => {
    const onSubmitted = jest.fn()
    jest.mocked(currencyAccountsApi.submit).mockResolvedValue({ ...operation, status: 'SUBMITTED' })
    render(<EurcMoneyReviewView operation={operation} onSubmitted={onSubmitted} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(mockEnsure).toHaveBeenCalledWith('8453')
    expect(mockSign).toHaveBeenCalledWith([{ to: operation.call!.to, data: operation.call!.data, value: 0n }], '8453')
})
it('reuses signed bytes after an ambiguous response without signing a second payment', async () => {
    jest.mocked(currencyAccountsApi.submit)
        .mockRejectedValueOnce(new Error('lost response'))
        .mockResolvedValueOnce({ ...operation, status: 'SUBMITTED' })
    render(<EurcMoneyReviewView operation={operation} onSubmitted={jest.fn()} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('actionError')
    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(currencyAccountsApi.submit).toHaveBeenCalledTimes(2))
    expect(mockSign).toHaveBeenCalledTimes(1)
    expect(jest.mocked(currencyAccountsApi.submit).mock.calls[0][1]).toBe(
        jest.mocked(currencyAccountsApi.submit).mock.calls[1][1]
    )
})
it('recovers an already submitted operation without another signature', async () => {
    jest.mocked(currencyAccountsApi.operation).mockResolvedValue({ ...operation, status: 'SUBMITTED' })
    const onSubmitted = jest.fn()
    render(<EurcMoneyReviewView operation={operation} onSubmitted={onSubmitted} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(mockSign).not.toHaveBeenCalled()
    expect(currencyAccountsApi.submit).not.toHaveBeenCalled()
})
it.each([
    { chainId: '42161' },
    { to: recipient },
    { value: '1' },
    { data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [recipient, 1000001n] }) },
])('rejects substituted signing calls %j', (change) => {
    expect(() => checkedCurrencyCall({ ...operation, call: { ...operation.call!, ...change } })).toThrow()
})
it('rejects an amount mismatch', () => {
    expect(() => checkedCurrencyCall({ ...operation, amount: '2' })).toThrow()
})
