import { selectBridgeTasks } from '../bridge-tasks.utils'
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
