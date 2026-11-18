'use client'

import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupPasskey } from '@/features/setup/useSignupPasskey'
import { PasskeyScreenView } from './PasskeyScreenView'
import { usePasskeyReservationRefresh } from './usePasskeyReservationRefresh'

/**
 * 03 Passkey (step `passkey`): creates the account with a passkey. The real OS sheet opens from `claim()`.
 * Mock: scaffold/screens/03-passkey; contract: build/contract/C.md § 3.2, § 4.5–4.8.
 */
export function PasskeyScreen(_props: StepComponentProps) {
    const { username } = useSetupFlowContext()
    const passkey = useSignupPasskey(username)
    usePasskeyReservationRefresh(username, passkey.isClaiming)
    return <PasskeyScreenView passkey={passkey} />
}
