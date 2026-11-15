jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

const sources = ['money', 'rate', 'format', 'input', 'submission'] as const
const categories = ['missing', 'malformed', 'nonfinite', 'nonpositive', 'precision', 'unit', 'overflow'] as const

beforeEach(() => jest.resetModules())

describe('bounded private numeric diagnostics', () => {
    it('emits once for each of the 35 fixed combinations, even during a burst', async () => {
        const { reportInvalidNumeric } = await import('@/lib/numeric-telemetry')
        const { captureMessage } = jest.requireMock('@/utils/sentry-lazy')
        for (let repeat = 0; repeat < 100; repeat++) {
            for (const source of sources) {
                for (const category of categories) reportInvalidNumeric(source, category)
            }
        }
        expect(captureMessage).toHaveBeenCalledTimes(35)
        const messages = new Set(captureMessage.mock.calls.map((call: unknown[]) => call[0]))
        expect(messages.size).toBe(1)
        expect(typeof captureMessage.mock.calls[0][0]).toBe('string')
        for (const call of captureMessage.mock.calls) {
            expect(call).toHaveLength(2)
            const context = call[1]
            expect(context).not.toHaveProperty('extra')
            expect(Object.keys(context).every((key) => ['level', 'tags', 'fingerprint'].includes(key))).toBe(true)
            expect(context.tags).toBeDefined()
            const tagValues = Object.values(context.tags)
            expect(tagValues.every((value) => [...sources, ...categories].includes(value as never))).toBe(true)
            expect(tagValues).toHaveLength(2)
        }
    })

    it('never throws when reporting fails and keeps the attempt bounded', async () => {
        const { reportInvalidNumeric } = await import('@/lib/numeric-telemetry')
        const { captureMessage } = jest.requireMock('@/utils/sentry-lazy')
        captureMessage.mockImplementation(() => {
            throw new Error('sink unavailable')
        })
        for (let repeat = 0; repeat < 100; repeat++) {
            expect(() => reportInvalidNumeric('submission', 'overflow')).not.toThrow()
        }
        expect(captureMessage).toHaveBeenCalledTimes(1)
    })

    it('does not let untrusted runtime categories or sources enter telemetry', async () => {
        const { reportInvalidNumeric } = await import('@/lib/numeric-telemetry')
        const { captureMessage } = jest.requireMock('@/utils/sentry-lazy')
        const untrusted = 'person@example.com:wallet:123.45'
        expect(() => reportInvalidNumeric(untrusted as 'money', 'malformed')).not.toThrow()
        expect(() => reportInvalidNumeric('money', untrusted as 'malformed')).not.toThrow()
        expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(untrusted)
        expect(captureMessage).not.toHaveBeenCalled()
    })
})
