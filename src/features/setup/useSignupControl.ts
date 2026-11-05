'use client'

import { createContext, useContext, useMemo, useRef } from 'react'
import { useOptionalSetupFlow } from '@/features/setup/SetupFlowContext'
import {
    captureSignupControlUsed,
    type SignupAnalyticsScreenId,
    type SignupControlAction,
} from '@/features/setup/signup-analytics'

/** The screen a control sits on. SetupWrapper sets it, so shared setup controls need no prop. */
export const SignupScreenContext = createContext<SignupAnalyticsScreenId | null>(null)

/**
 * Reports one use of a sign-up control (CONTROL_USED). Off a setup
 * screen it does nothing, so a shared control may call it anywhere.
 */
export function useSignupControl(screenOverride?: SignupAnalyticsScreenId) {
    const contextScreen = useContext(SignupScreenContext)
    const flow = useOptionalSetupFlow()
    const screenId = screenOverride ?? contextScreen
    const signupEntryFlow = flow?.signupEntryFlow ?? 'default'
    const host = flow?.onFinish ? 'verify-prelude' : 'signup'
    const sentOnce = useRef(new Set<string>())
    const lastError = useRef(new Map<string, string>())

    return useMemo(() => {
        const track = (control: string, action: SignupControlAction, value?: string) => {
            if (!screenId) return
            captureSignupControlUsed({ screenId, control, action, value, host, signupEntryFlow })
        }
        return {
            track,
            /** Once per mount, so a field reports that it was edited, not every keystroke. */
            trackOnce: (control: string, action: SignupControlAction) => {
                const key = `${control}:${action}`
                if (sentOnce.current.has(key)) return
                sentOnce.current.add(key)
                track(control, action)
            },
            /** A validation error, again only when its category changes; null clears it. */
            trackError: (control: string, category: string | null) => {
                if (category === null) {
                    lastError.current.delete(control)
                    return
                }
                if (lastError.current.get(control) === category) return
                lastError.current.set(control, category)
                track(control, 'error', category)
            },
        }
    }, [screenId, host, signupEntryFlow])
}
