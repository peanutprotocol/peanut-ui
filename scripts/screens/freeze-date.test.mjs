import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { freezeDate } from './freeze-date.mjs'

test('dates read the frozen instant while explicit dates, statics and timers stay real', async () => {
    const now = Date.parse('2026-09-01T12:00:00Z')
    const sandbox = { setTimeout }
    sandbox.globalThis = sandbox
    runInNewContext(`(${freezeDate})(${now})`, sandbox)
    const result = runInNewContext(
        `({
            now: Date.now(),
            constructed: new Date().getTime(),
            called: Date(),
            explicit: new Date('2020-01-02T03:04:05Z').toISOString(),
            parsed: Date.parse('2020-01-02T03:04:05Z'),
            utc: Date.UTC(2020, 0, 2),
            isDate: new Date() instanceof Date,
            json: JSON.stringify(new Date()),
        })`,
        sandbox
    )
    assert.deepEqual(JSON.parse(JSON.stringify(result)), {
        now,
        constructed: now,
        called: new Date(now).toString(),
        explicit: '2020-01-02T03:04:05.000Z',
        parsed: Date.parse('2020-01-02T03:04:05Z'),
        utc: Date.UTC(2020, 0, 2),
        isDate: true,
        json: JSON.stringify(new Date(now)),
    })
    const fired = await new Promise((resolve) =>
        runInNewContext('setTimeout(done, 5)', { ...sandbox, done: () => resolve(true) })
    )
    assert.equal(fired, true)
})
