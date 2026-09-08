import { sessionKeySignEnabled } from '../session-key-sign.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

jest.mock('@/utils/featureFlag.utils', () => ({ isFeatureFlagEnabled: jest.fn() }))
const previous = process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
    else process.env.NEXT_PUBLIC_SESSION_KEY_SIGN = previous
})

it.each([
    [undefined, true, 'broadcast-first-revert-v1', false],
    ['false', true, 'broadcast-first-revert-v1', false],
    ['true', false, 'broadcast-first-revert-v1', false],
    ['true', true, 'broadcast-first-revert-v1', true],
    ['true', true, undefined, false],
    ['true', true, null, false],
    ['true', true, true, false],
    ['true', true, 'broadcast-after', false],
])('build=%s runtime=%s contract=%s enables sign-only=%s', (build, runtime, contract, enabled) => {
    if (build === undefined) delete process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
    else process.env.NEXT_PUBLIC_SESSION_KEY_SIGN = build
    ;(isFeatureFlagEnabled as jest.Mock).mockReturnValue(runtime)
    expect(sessionKeySignEnabled(contract)).toBe(enabled)
})
