// tests for native-routes url helpers

import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(),
}))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

import {
    profileUrl,
    sendUrl,
    requestUrl,
    qrClaimUrl,
    qrSuccessUrl,
    chargePayUrl,
    requestPotUrl,
    addMoneyCountryUrl,
    withdrawCountryUrl,
    withdrawBankUrl,
    rewriteMethodPath,
} from '../native-routes'

describe('native-routes', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('capacitor mode', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
        })

        describe('profileUrl', () => {
            it('should return /send with recipient query param', () => {
                expect(profileUrl('alice')).toBe('/send?recipient=alice')
            })
        })

        describe('sendUrl', () => {
            it('should return /send with recipient query param', () => {
                expect(sendUrl('bob')).toBe('/send?recipient=bob')
            })
        })

        describe('requestUrl', () => {
            it('should return /request with recipient query param', () => {
                expect(requestUrl('charlie')).toBe('/request?recipient=charlie')
            })
        })

        describe('qrClaimUrl', () => {
            it('should return /qr with code query param', () => {
                expect(qrClaimUrl('abc123')).toBe('/qr?code=abc123')
            })
        })

        describe('qrSuccessUrl', () => {
            it('should return /qr with code and view=success query params', () => {
                expect(qrSuccessUrl('abc123')).toBe('/qr?code=abc123&view=success')
            })
        })

        describe('addMoneyCountryUrl', () => {
            it('should return /add-money with country query param', () => {
                expect(addMoneyCountryUrl('belgium')).toBe('/add-money?country=belgium')
            })
        })

        describe('withdrawCountryUrl', () => {
            it('should return /withdraw with country query param', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw?country=be')
            })

            it('should append extra query params', () => {
                expect(withdrawCountryUrl('be', '?method=ach')).toBe('/withdraw?country=be&method=ach')
            })

            it('should handle query params without leading ?', () => {
                expect(withdrawCountryUrl('be', 'method=ach')).toBe('/withdraw?country=be&method=ach')
            })
        })

        describe('withdrawBankUrl', () => {
            it('should return /withdraw with country and view=bank query params', () => {
                expect(withdrawBankUrl('be')).toBe('/withdraw?country=be&view=bank')
            })

            it('should append extra query params after view=bank', () => {
                expect(withdrawBankUrl('be', '?method=ach')).toBe('/withdraw?country=be&view=bank&method=ach')
            })

            it('should handle query params without leading ?', () => {
                expect(withdrawBankUrl('be', 'method=ach')).toBe('/withdraw?country=be&view=bank&method=ach')
            })
        })

        describe('rewriteMethodPath', () => {
            it('should rewrite /add-money/belgium/bank to query params', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank')).toBe('/add-money?country=belgium&view=bank')
            })

            it('should rewrite /add-money/argentina/manteca to query params', () => {
                expect(rewriteMethodPath('/add-money/argentina/manteca')).toBe(
                    '/add-money?country=argentina&view=manteca'
                )
            })

            it('should rewrite /add-money/belgium (no sub-view) to query params', () => {
                expect(rewriteMethodPath('/add-money/belgium')).toBe('/add-money?country=belgium')
            })

            it('should rewrite /withdraw/be/bank to query params', () => {
                expect(rewriteMethodPath('/withdraw/be/bank')).toBe('/withdraw?country=be&view=bank')
            })

            it('should rewrite /withdraw/be (no sub-view) to query params', () => {
                expect(rewriteMethodPath('/withdraw/be')).toBe('/withdraw?country=be')
            })

            it('should not rewrite /withdraw/manteca (static route)', () => {
                expect(rewriteMethodPath('/withdraw/manteca')).toBe('/withdraw/manteca')
            })

            it('should not rewrite /withdraw/manteca with query params (static route)', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should not rewrite /withdraw/crypto (static route)', () => {
                expect(rewriteMethodPath('/withdraw/crypto')).toBe('/withdraw/crypto')
            })

            it('should rewrite /add-money/crypto as dynamic (no static exception for add-money)', () => {
                // note: add-money does NOT have a static route exception for crypto
                expect(rewriteMethodPath('/add-money/crypto')).toBe('/add-money?country=crypto')
            })

            it('should append extraParams to rewritten add-money path', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank', 'method=bank')).toBe(
                    '/add-money?country=belgium&view=bank&method=bank'
                )
            })

            it('should append extraParams to rewritten withdraw path', () => {
                expect(rewriteMethodPath('/withdraw/be/bank', 'method=sepa')).toBe(
                    '/withdraw?country=be&view=bank&method=sepa'
                )
            })

            it('should append extraParams to static withdraw routes', () => {
                expect(rewriteMethodPath('/withdraw/manteca', 'method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should append extraParams to non-matching paths', () => {
                expect(rewriteMethodPath('/some/other/path', 'key=val')).toBe('/some/other/path?key=val')
            })

            it('should append extraParams with & when path already has query', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix', 'foo=bar')).toBe(
                    '/withdraw/manteca?method=pix&foo=bar'
                )
            })
        })
    })

    describe('web mode', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(false)
        })

        describe('profileUrl', () => {
            it('should return /{username} path', () => {
                expect(profileUrl('alice')).toBe('/alice')
            })
        })

        describe('sendUrl', () => {
            it('should return /send/{username} path', () => {
                expect(sendUrl('bob')).toBe('/send/bob')
            })
        })

        describe('requestUrl', () => {
            it('should return /request/{username} path', () => {
                expect(requestUrl('charlie')).toBe('/request/charlie')
            })
        })

        describe('qrClaimUrl', () => {
            it('should return /qr/{code} path', () => {
                expect(qrClaimUrl('abc123')).toBe('/qr/abc123')
            })
        })

        describe('qrSuccessUrl', () => {
            it('should return /qr/{code}/success path', () => {
                expect(qrSuccessUrl('abc123')).toBe('/qr/abc123/success')
            })
        })

        describe('addMoneyCountryUrl', () => {
            it('should return /add-money/{country} path', () => {
                expect(addMoneyCountryUrl('belgium')).toBe('/add-money/belgium')
            })
        })

        describe('withdrawCountryUrl', () => {
            it('should return /withdraw/{country} path', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw/be')
            })

            it('should append query params', () => {
                expect(withdrawCountryUrl('be', '?method=ach')).toBe('/withdraw/be?method=ach')
            })

            it('should return path without query params when none provided', () => {
                expect(withdrawCountryUrl('be')).toBe('/withdraw/be')
            })
        })

        describe('withdrawBankUrl', () => {
            it('should return /withdraw/{country}/bank path', () => {
                expect(withdrawBankUrl('be')).toBe('/withdraw/be/bank')
            })

            it('should append query params', () => {
                expect(withdrawBankUrl('be', '?method=ach')).toBe('/withdraw/be/bank?method=ach')
            })
        })

        describe('rewriteMethodPath', () => {
            it('should return /add-money/belgium/bank unchanged', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank')).toBe('/add-money/belgium/bank')
            })

            it('should return /add-money/argentina/manteca unchanged', () => {
                expect(rewriteMethodPath('/add-money/argentina/manteca')).toBe('/add-money/argentina/manteca')
            })

            it('should return /withdraw/be/bank unchanged', () => {
                expect(rewriteMethodPath('/withdraw/be/bank')).toBe('/withdraw/be/bank')
            })

            it('should return /withdraw/manteca?method=pix unchanged', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix')).toBe('/withdraw/manteca?method=pix')
            })

            it('should return /withdraw/crypto unchanged', () => {
                expect(rewriteMethodPath('/withdraw/crypto')).toBe('/withdraw/crypto')
            })

            it('should return /add-money/crypto unchanged', () => {
                expect(rewriteMethodPath('/add-money/crypto')).toBe('/add-money/crypto')
            })

            it('should append extraParams on web with ? separator', () => {
                expect(rewriteMethodPath('/add-money/belgium/bank', 'method=bank')).toBe(
                    '/add-money/belgium/bank?method=bank'
                )
            })

            it('should append extraParams on web with & when path already has query', () => {
                expect(rewriteMethodPath('/withdraw/manteca?method=pix', 'foo=bar')).toBe(
                    '/withdraw/manteca?method=pix&foo=bar'
                )
            })
        })
    })

    // chargePayUrl and requestPotUrl are native-only (no isCapacitor branching)
    describe('native-only helpers', () => {
        describe('chargePayUrl', () => {
            it('should return /pay-request with chargeId query param', () => {
                expect(chargePayUrl('charge-123')).toBe('/pay-request?chargeId=charge-123')
            })

            it('should include context param when provided', () => {
                expect(chargePayUrl('charge-123', 'home')).toBe('/pay-request?chargeId=charge-123&context=home')
            })

            it('should omit context param when not provided', () => {
                expect(chargePayUrl('charge-456')).toBe('/pay-request?chargeId=charge-456')
            })
        })

        describe('requestPotUrl', () => {
            it('should return /pay-request with id query param', () => {
                expect(requestPotUrl('pot-789')).toBe('/pay-request?id=pot-789')
            })
        })
    })
})
