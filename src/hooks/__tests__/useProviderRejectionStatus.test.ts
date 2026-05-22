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
    it('shows EEA uplift for an approved Bridge user as a Sumsub details action', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail(
                    {
                        bridgeRemediation: {
                            status: 'AWAITING_INPUT',
                            nextAction: {
                                payloadType: 'BRIDGE_CUSTOMER_FIELDS',
                                requirementKey: 'sof_individual_primary_purpose',
                                questionnaireCluster: 'eea_uplift',
                                effectiveDate: '2026-06-29',
                                maxAttempts: 3,
                            },
                        },
                    },
                    'REQUIRES_EXTRA_INFORMATION'
                ),
            ],
            [
                {
                    ...bridgeVerification({
                        bridgeRemediation: {
                            status: 'AWAITING_INPUT',
                            nextAction: {
                                payloadType: 'BRIDGE_CUSTOMER_FIELDS',
                                requirementKey: 'sof_individual_primary_purpose',
                                questionnaireCluster: 'eea_uplift',
                                effectiveDate: '2026-06-29',
                                maxAttempts: 3,
                            },
                        },
                    }),
                    status: 'approved',
                    providerRawStatus: 'active',
                    rejectType: null,
                    rejectLabels: null,
                },
            ]
        )

        expect(info.state).toBe('fixable')
        expect(info.requiredAction).toBe('BRIDGE_CUSTOMER_FIELDS')
        expect(info.actionLabel).toBe('Provide required details')
        expect(info.actionHandler).toBe('sumsub')
        expect(info.userMessage).toBe('We need required EEA details to keep payments enabled.')
    })

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
        expect(info.actionTitle).toBe('Additional details needed')
        expect(info.modalTitle).toBe('We need more details')
        expect(info.modalDescription).toBe('Please provide the missing details to unlock this region.')
        expect(info.actionLabel).toBe('Provide details')
        expect(info.actionHandler).toBe('sumsub')
        expect(info.userMessage).toContain('more details')
        expect(info.selfHealAttempt).toBe(1)
        expect(info.maxAttempts).toBe(3)
    })

    it('maps Bridge ToS remediation to terms copy and handler', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'AWAITING_INPUT',
                        nextAction: {
                            payloadType: 'BRIDGE_TOS',
                            requirementKey: 'terms_of_service_v2',
                            maxAttempts: 3,
                        },
                    },
                }),
            ],
            [bridgeVerification({})]
        )

        expect(info.state).toBe('fixable')
        expect(info.requiredAction).toBe('BRIDGE_TOS')
        expect(info.actionTitle).toBe('Terms acceptance needed')
        expect(info.modalTitle).toBe('Terms acceptance needed')
        expect(info.modalDescription).toBe('Please accept the terms to enable payments.')
        expect(info.actionLabel).toBe('Accept terms')
        expect(info.actionHandler).toBe('tos')
        expect(info.userMessage).toBe('Please accept the terms to enable payments.')
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
        expect(info.actionTitle).toBeNull()
        expect(info.modalTitle).toBeNull()
        expect(info.actionLabel).toBeNull()
        expect(info.actionHandler).toBeNull()
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
        expect(info.actionTitle).toBeNull()
        expect(info.modalTitle).toBeNull()
        expect(info.actionLabel).toBeNull()
        expect(info.actionHandler).toBeNull()
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
        expect(info.actionTitle).toBe('Additional documents needed')
        expect(info.modalTitle).toBe('We need an updated document')
        expect(info.modalDescription).toBe('Please upload the requested document to unlock this region.')
        expect(info.actionLabel).toBe('Upload document')
        expect(info.actionHandler).toBe('sumsub')
    })

    it('uses verification remediation before stale rail remediation', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'AWAITING_INPUT',
                        nextAction: {
                            payloadType: 'BRIDGE_DOCUMENT',
                            requirementKey: 'proof_of_address',
                            maxAttempts: 3,
                        },
                    },
                }),
            ],
            [
                bridgeVerification({
                    bridgeRemediation: {
                        status: 'AWAITING_INPUT',
                        nextAction: {
                            payloadType: 'BRIDGE_CUSTOMER_FIELDS',
                            requirementKey: 'source_of_funds_questionnaire',
                            maxAttempts: 3,
                        },
                    },
                }),
            ]
        )

        expect(info.state).toBe('fixable')
        expect(info.requiredAction).toBe('BRIDGE_CUSTOMER_FIELDS')
        expect(info.actionTitle).toBe('Additional details needed')
    })

    it('does not show a provider rejection for approved Bridge remediation', () => {
        const info = deriveProviderRejectionInfo(
            'BRIDGE',
            [
                bridgeRail({
                    bridgeRemediation: {
                        status: 'APPROVED',
                    },
                }),
            ],
            [bridgeVerification({ bridgeRemediation: { status: 'APPROVED' } })]
        )

        expect(info.state).toBe('happy')
        expect(info.requiredAction).toBeNull()
        expect(info.rejectedRails).toEqual([])
    })
})
