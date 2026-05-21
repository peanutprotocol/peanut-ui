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
                        reason: 'terminal_bridge_issue',
                        terminalKeys: ['endorsement_not_available_in_customers_region'],
                    },
                }),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('blocked')
        expect(info.userMessage).toBe(
            "We can't enable payments for your region right now. Contact support if you need help."
        )
        expect(info.actionLabel).toBeNull()
    })

    it('maps Bridge terminal identity document flags to support copy', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'TERMINAL',
                        reason: 'terminal_bridge_issue',
                        terminalKeys: ['tampering_detected'],
                    },
                }),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('blocked')
        expect(info.userMessage).toBe(
            "We couldn't accept the identity document you submitted. Contact support if you need help."
        )
    })

    it('uses generic blocked copy for unknown Bridge terminal reasons', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'TERMINAL',
                        reason: 'terminal_bridge_issue',
                        terminalKeys: ['unknown_terminal_reason'],
                    },
                }),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('blocked')
        expect(info.userMessage).toBe(
            "We couldn't enable payments for your account. Please contact support for assistance."
        )
    })

    it('marks Bridge awaiting-provider remediation as processing', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail(
                    {
                        bridgeRemediation: {
                            status: 'AWAITING_PROVIDER',
                            reason: 'no_retryable_bridge_requirements',
                            terminalKeys: [],
                            retryableActions: [],
                        },
                    },
                    'REQUIRES_EXTRA_INFORMATION'
                ),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('processing')
        expect(info.userMessage).toBe(
            "We're reviewing your documents. We'll update your payment setup when the review is complete."
        )
        expect(info.rejectedRails).toHaveLength(1)
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
