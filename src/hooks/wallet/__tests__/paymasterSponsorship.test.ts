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

test('the user operation fields and fee override are kept without mutating the caller', () => {
    const userOperation = op(PAYMASTER_PREVIEW_CONTEXT)
    const args = sponsorUserOperationArgs(userOperation)
    expect(args.userOperation).toEqual(userOperation)
    expect(args.shouldOverrideFee).toBe(true)
    expect(Object.isFrozen(PAYMASTER_PREVIEW_CONTEXT)).toBe(true)
})

test('preparation metadata never reaches the ZeroDev userOp payload', () => {
    const userOperation = Object.freeze({
        ...op(PAYMASTER_PREVIEW_CONTEXT),
        paymasterContext: PAYMASTER_PREVIEW_CONTEXT,
        parameters: ['paymaster', 'gas'],
        signature: '0x1234',
        callData: '0x5678',
    })
    const args = sponsorUserOperationArgs(userOperation)
    expect(args.userOperation).not.toHaveProperty('paymasterContext')
    expect(args.userOperation).not.toHaveProperty('parameters')
    expect(args.userOperation).toMatchObject({ signature: '0x1234', callData: '0x5678', nonce: 1n })
    expect(args.shouldConsume).toBe(false)
    expect(userOperation.paymasterContext).toBe(PAYMASTER_PREVIEW_CONTEXT)
})
