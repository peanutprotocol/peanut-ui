import { formatBaseUnitAmount, formatRelationshipAmount } from '../format'
import type { ExplorerRelationship, RelationshipAsset } from '../types'

const asset: RelationshipAsset = { code: 'USDC:42161', displayCode: 'USDC', decimals: 6, chainId: '42161' }

function movement(state: ExplorerRelationship['state']): ExplorerRelationship {
    return {
        id: state,
        source: 'a',
        target: 'b',
        provider: 'PEANUT',
        method: 'P2P',
        rail: 'PEANUT_DIRECT',
        kind: 'TRANSFER',
        direction: 'OUTGOING',
        state,
        evidence: state === 'SETTLED' ? 'POSTED_PRINCIPAL' : 'INTENT_STATUS',
        timeBasis: state === 'SETTLED' ? 'COMPLETED_AT' : 'STATUS_EVENT_AT',
        asset,
        count: 1,
        settledPaymentCount: state === 'SETTLED' ? 1 : 0,
        nativeAmount: '9007199254740993123456',
        overlayNativeAmount: '1250000',
        firstAt: '2026-08-01T00:00:00.000Z',
        lastAt: '2026-08-01T00:00:00.000Z',
        bidirectional: false,
    }
}

describe('native payment formatting', () => {
    it('uses base-unit strings without Number precision loss', () => {
        expect(formatBaseUnitAmount('9007199254740993123456', asset)).toBe('9,007,199,254,740,993.123456 USDC')
    })

    it('keeps settled principal separate from refund and reversal overlays', () => {
        expect(formatRelationshipAmount(movement('SETTLED'))).toBe('9,007,199,254,740,993.123456 USDC')
        expect(formatRelationshipAmount(movement('REFUNDED'))).toBe('1.25 USDC')
        expect(formatRelationshipAmount(movement('REVERSED'))).toBe('1.25 USDC')
        expect(formatRelationshipAmount(movement('FAILED'))).toBe('—')
        expect(formatRelationshipAmount(movement('PENDING'))).toBe('—')
    })
})
