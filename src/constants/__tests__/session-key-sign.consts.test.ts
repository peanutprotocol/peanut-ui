import { sessionKeySignEnabled } from '../session-key-sign.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

jest.mock('@/utils/featureFlag.utils', () => ({ isFeatureFlagEnabled: jest.fn() }))
const previous = process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
    else process.env.NEXT_PUBLIC_SESSION_KEY_SIGN = previous
})

it.each([
    [undefined, true, false],
    ['false', true, false],
    ['true', false, false],
    ['true', true, true],
])('build=%s and runtime=%s enables sign-only=%s', (build, runtime, enabled) => {
    if (build === undefined) delete process.env.NEXT_PUBLIC_SESSION_KEY_SIGN
    else process.env.NEXT_PUBLIC_SESSION_KEY_SIGN = build
    ;(isFeatureFlagEnabled as jest.Mock).mockReturnValue(runtime)
    expect(sessionKeySignEnabled()).toBe(enabled)
})
