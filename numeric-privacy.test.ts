import { beforeSendHandler } from './sentry.utils'
import type { ErrorEvent } from '@sentry/nextjs'

test('numeric diagnostics discard automatically attached personal context', () => {
    const result = beforeSendHandler({
        type: undefined,
        message: 'Invalid numeric value',
        fingerprint: ['invalid_numeric', 'money', 'overflow'],
        tags: { numeric_source: 'money', numeric_category: 'overflow', userId: 'secret-person' },
        user: { id: 'secret-person' },
        request: { url: 'https://peanut.me/pay/private?amount=12345' },
        breadcrumbs: [{ message: 'amount 12345' }],
        extra: { amount: '12345' },
        contexts: { wallet: { address: 'secret-wallet' } },
        release: 'test-release',
    } as ErrorEvent)
    expect(result).not.toBeNull()
    expect(JSON.stringify(result)).not.toMatch(/secret|12345|https:/)
    expect(result?.release).toBe('test-release')
    expect(result?.tags).toEqual({ numeric_source: 'money', numeric_category: 'overflow' })
})

test('numeric diagnostics cannot supply dynamic dimensions', () => {
    expect(
        beforeSendHandler({
            type: undefined,
            fingerprint: ['invalid_numeric', 'amount=12345'],
            tags: { numeric_source: 'secret-person', numeric_category: 'overflow' },
        } as ErrorEvent)
    ).toBeNull()
})
