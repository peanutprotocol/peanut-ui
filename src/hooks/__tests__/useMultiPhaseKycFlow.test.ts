import { getBridgeNextQuestionnaireClusterFromUser } from '../useMultiPhaseKycFlow'
import type { IUserProfile } from '@/interfaces'

describe('getBridgeNextQuestionnaireClusterFromUser', () => {
    it('detects EEA TIN reupload from Bridge remediation metadata', () => {
        const user = {
            user: {
                kycVerifications: [
                    {
                        provider: 'BRIDGE',
                        updatedAt: '2026-05-22T00:00:00.000Z',
                        metadata: {
                            bridgeRemediation: {
                                status: 'AWAITING_INPUT',
                                nextAction: {
                                    questionnaireCluster: 'eea_tin_reupload',
                                },
                            },
                        },
                    },
                ],
            },
            rails: [],
        } as unknown as IUserProfile

        expect(getBridgeNextQuestionnaireClusterFromUser(user)).toBe('eea_tin_reupload')
    })

    it('does not auto-continue when Bridge is not waiting for input', () => {
        const user = {
            user: {
                kycVerifications: [
                    {
                        provider: 'BRIDGE',
                        updatedAt: '2026-05-22T00:00:00.000Z',
                        metadata: {
                            bridgeRemediation: {
                                status: 'AWAITING_PROVIDER',
                                nextAction: {
                                    questionnaireCluster: 'eea_tin_reupload',
                                },
                            },
                        },
                    },
                ],
            },
            rails: [],
        } as unknown as IUserProfile

        expect(getBridgeNextQuestionnaireClusterFromUser(user)).toBeNull()
    })
})
