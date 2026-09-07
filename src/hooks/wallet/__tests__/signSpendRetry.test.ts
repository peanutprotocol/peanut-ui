import { registerEphemeralArtifact, requiresPasskeyRetry, submitSignedSpend } from '../signSpendRetry'

it('records a returned withdraw revert and scopes fallback to its account', async () => {
    const artifact = registerEphemeralArtifact({}, '0xRETURNED')
    const result = {
        error: 'Failed to broadcast UserOp',
        message: 'USER_OP_REVERTED: signed operation reverted on-chain',
    }
    await expect(submitSignedSpend(artifact, async () => result)).resolves.toBe(result)
    expect(requiresPasskeyRetry('0xreturned')).toBe(true)
    expect(requiresPasskeyRetry('0xother')).toBe(false)
    expect(sessionStorage.getItem('peanut:sign-spend-passkey:0xreturned')).toBe('true')
})

it('records a thrown QR revert without retrying the payment', async () => {
    const artifact = registerEphemeralArtifact({}, '0xQR')
    const error = new Error('UserOp reverted on chain — no funds moved')
    const submit = jest.fn(async () => {
        throw error
    })
    await expect(submitSignedSpend(artifact, submit)).rejects.toBe(error)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(requiresPasskeyRetry('0xqr')).toBe(true)
})

it.each(['UserOp receipt timeout - transaction may still be pending', 'Failed to fetch', 'Bundler error: AA24'])(
    'does not classify %s as a confirmed revert',
    async (message) => {
        const account = `0x${message}`
        const artifact = registerEphemeralArtifact({}, account)
        await expect(
            submitSignedSpend(artifact, async () => {
                throw new Error(message)
            })
        ).rejects.toThrow(message)
        expect(requiresPasskeyRetry(account)).toBe(false)
    }
)

it('does not blacklist a passkey-signed artifact', async () => {
    const result = { error: 'USER_OP_REVERTED: signed operation reverted on-chain' }
    await expect(submitSignedSpend({}, async () => result)).resolves.toBe(result)
})

it('restores the guard from session storage', () => {
    sessionStorage.setItem('peanut:sign-spend-passkey:0xrestored', 'true')
    expect(requiresPasskeyRetry('0xRESTORED')).toBe(true)
})
