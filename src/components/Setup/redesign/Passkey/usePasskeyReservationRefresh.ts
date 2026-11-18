'use client'

import { useEffect, useRef } from 'react'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { reserveUsername } from '@/features/setup/username-reservation'
import { USERNAME_PATTERN } from '@/features/setup/username-suggestions'
import { useSetupFlow } from '@/hooks/useSetupFlow'

/**
 * On arrival, 03 renews this device's hold on the username once per name. A bad name, or a name another device
 * holds or the server refuses, goes back to 02 before any registration starts (dev Views/Passkey.tsx).
 */
export function usePasskeyReservationRefresh(username: string, registering: boolean) {
    const { setRefusedUsername } = useSetupFlowContext()
    const { setScreenId } = useSetupFlow()
    const { trackError } = useSignupControl()
    const refresh = useRef<{ username: string; request: ReturnType<typeof reserveUsername> }>()
    const registeringRef = useRef(registering)
    registeringRef.current = registering
    const navigate = useRef(setScreenId)
    navigate.current = setScreenId

    useEffect(() => {
        let active = true
        if (!USERNAME_PATTERN.test(username)) {
            trackError('username', 'invalid')
            navigate.current('signup')
            return
        }
        if (refresh.current?.username !== username) refresh.current = { username, request: reserveUsername(username) }
        void refresh.current.request.then((result) => {
            if (
                active &&
                !registeringRef.current &&
                (result === 'taken' || result === 'refused' || result === 'invalid')
            ) {
                trackError('username', result)
                if (result === 'refused') setRefusedUsername(username)
                navigate.current('signup')
            }
        })
        return () => {
            active = false
        }
    }, [username, setRefusedUsername, trackError])
}
