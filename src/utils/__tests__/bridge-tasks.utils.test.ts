import { bridgeTaskDismissalKey, selectBridgeTasks } from '../bridge-tasks.utils'
import type { NextAction } from '@/types/capabilities'

const action = (overrides: Partial<NextAction>): NextAction => ({
    key: 'accept-tos',
    kind: 'accept-tos',
    purpose: 'accept-bridge-tos',
    ...overrides,
})

describe('selectBridgeTasks', () => {
    it('keeps accept-tos and bridge-hosted, drops everything else', () => {
        const tasks = selectBridgeTasks([
            action({ key: 'accept-tos', kind: 'accept-tos' }),
            action({ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' }),
            action({ key: 'sumsub:proof_of_address', kind: 'sumsub' }),
            action({ key: 'wait:bridge', kind: 'wait' }),
            action({ key: 'contact-support', kind: 'contact-support' }),
        ])
        expect(tasks.map((t) => t.key)).toEqual(['accept-tos', 'bridge-hosted'])
    })

    it('returns [] when nothing is pending', () => {
        expect(selectBridgeTasks([])).toEqual([])
        expect(selectBridgeTasks([action({ key: 'sumsub:eea_uplift', kind: 'sumsub' })])).toEqual([])
    })

    it('passes advisory metadata (effectiveDate) through untouched', () => {
        const [task] = selectBridgeTasks([
            action({ key: 'bridge-hosted', kind: 'bridge-hosted', effectiveDate: '2099-09-01' }),
        ])
        expect(task.effectiveDate).toBe('2099-09-01')
    })
})

describe('bridgeTaskDismissalKey', () => {
    it('advisory → blocking (effectiveDate disappears) changes the fingerprint', () => {
        const advisory = action({ key: 'accept-tos:sepa', effectiveDate: '2099-09-01' })
        const blocking = action({ key: 'accept-tos:sepa' })
        expect(bridgeTaskDismissalKey(advisory)).not.toBe(bridgeTaskDismissalKey(blocking))
    })

    it('a new requirement under the shared bridge-hosted key changes the fingerprint', () => {
        const first = action({ key: 'bridge-hosted', kind: 'bridge-hosted', requirementKey: 'kyc_approval' })
        const second = action({
            key: 'bridge-hosted',
            kind: 'bridge-hosted',
            requirementKey: 'kyc_with_proof_of_address',
        })
        expect(bridgeTaskDismissalKey(first)).not.toBe(bridgeTaskDismissalKey(second))
    })

    it('an unchanged task keeps a stable fingerprint', () => {
        const task = action({
            key: 'accept-tos:sepa',
            effectiveDate: '2099-09-01',
            requirementKey: 'tos_v2_acceptance',
        })
        expect(bridgeTaskDismissalKey(task)).toBe(bridgeTaskDismissalKey({ ...task }))
    })
})
