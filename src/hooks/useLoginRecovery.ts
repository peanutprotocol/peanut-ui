'use client'

import posthog from 'posthog-js'
import { useRef, useState } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { isCapacitor } from '@/utils/capacitor'
import { useNativePlatform } from '@/utils/native-platform'

// One cancel is often deliberate. On iOS and the web a phone with no Peanut
// passkey closes the sheet the same way, so the recovery drawer waits for the repeat.
const LOGIN_CANCELS_BEFORE_RECOVERY = 2

export type LoginRecoveryAction = 'retry' | 'signup' | 'support' | 'dismiss'

interface LoginRecoveryOptions {
    onRetry: () => void
    /** Omitted where the surface offers no signup. */
    onSignUp?: () => void
    /** Also open the drawer on a repeated cancel on iOS and the web (the landing screen only). */
    repeatedCancel?: boolean
    /** Called on open and on every drawer action, for surface-specific tracking. */
    onEvent?: (event: LoginRecoveryAction | 'open') => void
}

/**
 * The login recovery rule and the state of `LoginRecoveryDrawer`, shared by every log-in surface.
 *
 * The Android app answers "no credential" with PASSKEY_NOT_FOUND since ui#3752, so that code always
 * opens the drawer. iOS and browsers report an empty passkey list as a cancel, which a deliberate
 * dismissal also is, so with `repeatedCancel` a cancel opens the drawer only when it repeats.
 */
export function useLoginRecovery({ onRetry, onSignUp, repeatedCancel = false, onEvent }: LoginRecoveryOptions) {
    const nativePlatform = useNativePlatform()
    const { deviceType } = useDeviceType()
    const [isOpen, setIsOpen] = useState(false)
    const loginCancelsRef = useRef(0)
    // Set by a drawer action, so the close that follows it is not logged as a dismiss.
    const actionRef = useRef<LoginRecoveryAction | null>(null)

    const offersRecovery = (code: string | undefined): boolean => {
        if (code === 'PASSKEY_NOT_FOUND') return true
        if (repeatedCancel && code === 'LOGIN_CANCELED' && !nativePlatform.isAndroidNative) {
            loginCancelsRef.current += 1
            return loginCancelsRef.current >= LOGIN_CANCELS_BEFORE_RECOVERY
        }
        loginCancelsRef.current = 0
        return false
    }

    const openRecovery = () => {
        onEvent?.('open')
        actionRef.current = null
        setIsOpen(true)
    }

    const act = (action: LoginRecoveryAction) => {
        actionRef.current = action
        posthog.capture(ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION, { action, native: isCapacitor() })
        onEvent?.(action)
        setIsOpen(false)
    }

    /** Props for `LoginRecoveryDrawer`. */
    const recoveryDrawer = {
        visible: isOpen,
        platform: deviceType,
        onClose: () => {
            if (actionRef.current === null) {
                posthog.capture(ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION, { action: 'dismiss', native: isCapacitor() })
                onEvent?.('dismiss')
            }
            actionRef.current = null
            setIsOpen(false)
        },
        onRetry: () => {
            act('retry')
            onRetry()
        },
        onSignUp: onSignUp
            ? () => {
                  act('signup')
                  onSignUp()
              }
            : undefined,
        onSupport: () => act('support'),
    }

    return { offersRecovery, openRecovery, recoveryDrawer }
}
