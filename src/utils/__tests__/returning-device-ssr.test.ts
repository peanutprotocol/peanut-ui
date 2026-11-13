/** @jest-environment node */
import { isReturningDevice, markDeviceHadAccount } from '@/utils/returning-device'

jest.mock('@/components/Setup/setup-entry', () => ({
    hasKnownDeviceCredentials: jest.fn(() => {
        throw new Error('must not access credentials without window')
    }),
}))

test('SSR never throws and is not a returning device', () => {
    expect(markDeviceHadAccount).not.toThrow()
    expect(isReturningDevice()).toBe(false)
})
