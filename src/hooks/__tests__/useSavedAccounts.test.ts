import { renderHook } from '@testing-library/react'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { AccountType } from '@/interfaces'

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const acct = (type: AccountType, identifier: string) => ({ type, identifier, id: identifier })

beforeEach(() => mockUseAuth.mockReset())

describe('useSavedAccounts', () => {
    it('returns [] when there is no user', () => {
        mockUseAuth.mockReturnValue({ user: undefined })
        const { result } = renderHook(() => useSavedAccounts())
        expect(result.current).toEqual([])
    })

    it('includes Manteca (AR CBU/CVU, BR PIX) accounts alongside Bridge bank types', () => {
        // Regression: Manteca accounts (projected by the backend as type
        // 'manteca') were dropped, so AR/BR users saw an empty saved-accounts
        // list and had to re-enter their bank account every time.
        mockUseAuth.mockReturnValue({
            user: {
                accounts: [
                    acct(AccountType.PEANUT_WALLET, '0xabc'),
                    acct(AccountType.EVM_ADDRESS, '0xdef'),
                    acct(AccountType.IBAN, 'DE00'),
                    acct(AccountType.MANTECA, '0070075730004135153296'),
                ],
            },
        })
        const { result } = renderHook(() => useSavedAccounts())
        expect(result.current.map((a) => a.type)).toEqual([AccountType.IBAN, AccountType.MANTECA])
    })

    it('excludes wallets and other non-bank account types', () => {
        mockUseAuth.mockReturnValue({
            user: { accounts: [acct(AccountType.PEANUT_WALLET, '0xabc'), acct(AccountType.EVM_ADDRESS, '0xdef')] },
        })
        const { result } = renderHook(() => useSavedAccounts())
        expect(result.current).toEqual([])
    })
})
