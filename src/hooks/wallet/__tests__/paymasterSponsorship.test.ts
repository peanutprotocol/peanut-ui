/**
 * paymasterSponsorship — the one bridge between viem's per-request
 * `paymasterContext` and ZeroDev's `shouldConsume`.
 */
import { PAYMASTER_PREVIEW_CONTEXT, isPaymasterPreviewContext, sponsorUserOperationArgs } from '../paymasterSponsorship'

const op = (context?: unknown) => ({ sender: '0x1', nonce: 1n, context })

test('the preview marker is recognised by value, not by identity', () => {
    expect(isPaymasterPreviewContext(PAYMASTER_PREVIEW_CONTEXT)).toBe(true)
    expect(isPaymasterPreviewContext({ sponsorship: 'preview' })).toBe(true)
    expect(isPaymasterPreviewContext({ sponsorship: 'final' })).toBe(false)
    expect(isPaymasterPreviewContext(undefined)).toBe(false)
    expect(isPaymasterPreviewContext(null)).toBe(false)
    expect(isPaymasterPreviewContext('preview')).toBe(false)
})

test('a request consumes unless it carries the preview marker', () => {
    expect(sponsorUserOperationArgs(op()).shouldConsume).toBe(true)
    expect(sponsorUserOperationArgs(op({ other: true })).shouldConsume).toBe(true)
    expect(sponsorUserOperationArgs(op(PAYMASTER_PREVIEW_CONTEXT)).shouldConsume).toBe(false)
})

test('the user operation is forwarded untouched and the fee override is kept', () => {
    const userOperation = op(PAYMASTER_PREVIEW_CONTEXT)
    const args = sponsorUserOperationArgs(userOperation)
    expect(args.userOperation).toBe(userOperation)
    expect(args.shouldOverrideFee).toBe(true)
    expect(Object.isFrozen(PAYMASTER_PREVIEW_CONTEXT)).toBe(true)
})
