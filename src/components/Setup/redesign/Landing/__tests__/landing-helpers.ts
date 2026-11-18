/** UI helpers for the 01 Landing suites. */
import { act, fireEvent, screen } from '@testing-library/react'
import { getPasskeySetupKey } from '@/utils/webauthn.utils'
import { msg } from './redesign-harness'

/** The curated error useZeroDev.handleLogin throws (as Landing.test.tsx). It counts as already reported. */
export const passkeyError = (code: string) => Object.assign(new Error('curated'), { name: 'PasskeyError', code })

/** The en toast copy for a curated code, read from the catalog through dev's own key map. */
export const setupCopyFor = (code: string) =>
    msg(`setup.${getPasskeySetupKey(code as Parameters<typeof getPasskeySetupKey>[0])}`)

/** A button whose accessible name holds the label (a loading button also names its spinner). */
export const named = (label: string) => (name: string) => name.replace(/\u00a0/g, ' ').includes(label)
export const signUpButton = () => screen.getByRole('button', { name: named(msg('setupRedesign.landing.cta')) })
export const logInButton = () => screen.getByRole('button', { name: named(msg('setupRedesign.landing.loginBtn')) })
export const querySignUpButton = () =>
    screen.queryByRole('button', { name: (name: string) => name === msg('setupRedesign.landing.cta') })
export const recoveryLinkText = () => msg('setupRedesign.landing.recover')

/** A Log in tap with the real clock (the recovery drawer's focus and close transitions need it). */
export async function tapLogIn(name: string = msg('setupRedesign.landing.loginBtn')) {
    jest.useRealTimers()
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: named(name) }))
    })
}
