import { formatNetworkFee, isWithdrawFeeDisproportionate } from '@/utils/cross-chain-fee.utils'

describe('formatNetworkFee', () => {
    it('is sponsored (null) when the transfer is same-chain, unquoted, or quoted at zero', () => {
        expect(formatNetworkFee(0.51, false)).toBeNull()
        expect(formatNetworkFee(undefined, true)).toBeNull()
        expect(formatNetworkFee(0, true)).toBeNull()
        expect(formatNetworkFee(-0.01, true)).toBeNull()
        expect(formatNetworkFee(NaN, true)).toBeNull()
    })

    it('shows a quoted fee verbatim, to the cent', () => {
        expect(formatNetworkFee(0.51, true)).toBe('$0.51')
        expect(formatNetworkFee(1.5, true)).toBe('$1.50')
    })

    it('shows sub-cent fees as < $0.01 instead of $0.00', () => {
        expect(formatNetworkFee(0.004, true)).toBe('< $0.01')
    })
})

describe('isWithdrawFeeDisproportionate', () => {
    it('is quiet for a zero quote and loud when the fee dominates a small amount', () => {
        expect(isWithdrawFeeDisproportionate(0, 10)).toBe(false)
        expect(isWithdrawFeeDisproportionate(undefined, 10)).toBe(false)
        expect(isWithdrawFeeDisproportionate(1.5, 10)).toBe(true)
        expect(isWithdrawFeeDisproportionate(0.04, 10)).toBe(false)
    })
})
