import { deriveProviderRejectionInfo } from '../useProviderRejectionStatus'
import type { IUserKycVerification, IUserRail } from '@/interfaces'

const bridgeRail = (metadata: IUserRail['metadata'], status: IUserRail['status'] = 'REJECTED'): IUserRail => ({
    id: 'rail-1',
    railId: 'bridge-eur',
    status,
    metadata,
    rail: {
        id: 'rail-def-1',
        provider: { code: 'BRIDGE', name: 'Bridge' },
        method: { code: 'sepa', name: 'SEPA', country: 'EU', currency: 'EUR' },
    },
})

const bridgeVerification = (metadata: IUserKycVerification['metadata']): IUserKycVerification => ({
    provider: 'BRIDGE',
    status: 'rejected',
    providerUserId: 'customer-1',
    providerRawStatus: 'rejected',
    metadata,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
})

describe('deriveProviderRejectionInfo', () => {
    it('marks Bridge RFI customer-field remediation as fixable even when Bridge rejected the customer', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'AWAITING_INPUT',
                        nextAction: {
                            payloadType: 'BRIDGE_CUSTOMER_FIELDS',
                            requirementKey: 'source_of_funds_questionnaire',
                            maxAttempts: 3,
                        },
                    },
                }),
            ],
            [bridgeVerification({ selfHealAttempt: 1 })]
        )

        expect(info.state).toBe('fixable')
        expect(info.requiredAction).toBe('BRIDGE_CUSTOMER_FIELDS')
        expect(info.actionLabel).toBe('Provide details')
        expect(info.userMessage).toContain('more details')
        expect(info.selfHealAttempt).toBe(1)
        expect(info.maxAttempts).toBe(3)
    })

    it('marks Bridge terminal remediation as blocked', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'TERMINAL',
                        reason: 'This region is not available.',
                    },
                }),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('blocked')
        expect(info.userMessage).toBe('This region is not available.')
        expect(info.actionLabel).toBeNull()
    })

    it('surfaces Bridge extra-info rails as fixable when remediation metadata is on the rail', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail(
                    {
                        bridgeRemediation: {
                            status: 'AWAITING_INPUT',
                            nextAction: {
                                payloadType: 'BRIDGE_DOCUMENT',
                                requirementKey: 'proof_of_source_of_funds',
                                maxAttempts: 3,
                            },
                        },
                    },
                    'REQUIRES_EXTRA_INFORMATION'
                ),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('fixable')
        expect(info.requiredAction).toBe('BRIDGE_DOCUMENT')
        expect(info.actionLabel).toBe('Upload document')
    })
})
