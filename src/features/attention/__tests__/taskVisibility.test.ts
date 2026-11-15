import fc from 'fast-check'
import { visibleHomeTasks } from '../taskVisibility'
import type { NextAction } from '@/types/capabilities'

const advisory: NextAction = {
    key: 'bridge-hosted',
    kind: 'bridge-hosted',
    purpose: 'bridge-additional-verification',
    requirementKey: 'proof',
    effectiveDate: '2099-01-01',
}
const fingerprint = 'bridge-hosted|proof|2099-01-01'

test.each([undefined, null, 'legacy-task-keys', 1])('malformed old dismissal data %s cannot hide tasks', (stored) => {
    expect(visibleHomeTasks([advisory], stored)).toEqual([advisory])
})
test('only the exact advisory fingerprint is hidden; a new requirement or due state resurfaces', () => {
    const changed = { ...advisory, requirementKey: 'new-proof' }
    const newDate = { ...advisory, effectiveDate: '2099-02-01' }
    const blocking = { ...advisory, effectiveDate: undefined }
    expect(
        visibleHomeTasks([advisory, changed, newDate, blocking], [fingerprint, 'bridge-hosted|proof|due-now'])
    ).toEqual([changed, newDate, blocking])
})
test('blocking tasks remain visible regardless of saved fingerprints', () => {
    fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 64 }), (keys) => {
            const tasks: NextAction[] = keys.map((key) => ({ key, kind: 'accept-tos', purpose: 'accept-bridge-tos' }))
            const saved = keys.map((key) => `${key}||due-now`)
            expect(visibleHomeTasks(tasks, saved)).toEqual(tasks)
        }),
        { seed: 1407, numRuns: 200 }
    )
})
