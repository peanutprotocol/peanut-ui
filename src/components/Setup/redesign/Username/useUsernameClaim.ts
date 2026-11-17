'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { DEMO_USER } from '@/constants/demo-data'
import { USER } from '@/constants/query.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { isReservedSignupUsername } from '@/features/setup/reserved-username'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { reserveUsername } from '@/features/setup/username-reservation'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { enableDemoMode, isDemoUsername } from '@/utils/demo'

/**
 * The button on 02: holds the name for this device and moves on, or starts the demo session for the store
 * reviewer's `demo` name. Behaviour as dev's Views/Signup.tsx onClaim; the control keeps dev's name `claim`.
 */
export function useUsernameClaim({
    name,
    onRefused,
}: {
    /** The name in the field. */
    name: string
    onRefused: (result: 'taken' | 'refused' | 'invalid') => void
}) {
    const { refusedUsername, setResidenceCountry, setNationalityCountry, setSignupCompleted, setNoBackLockScreenId } =
        useSetupFlowContext()
    const { handleNext, setScreenId, isLoading } = useSetupFlow()
    const queryClient = useQueryClient()
    const { track } = useSignupControl()
    const [isClaiming, setIsClaiming] = useState(false)
    const claiming = useRef(false)
    // The field's value now; null once the step has gone, so a late answer never moves the flow.
    const current = useRef<string | null>(name)
    current.current = name
    useEffect(
        () => () => {
            current.current = null
        },
        []
    )

    const claim = async () => {
        if (claiming.current || isLoading) return
        claiming.current = true
        setIsClaiming(true)
        const claimed = name
        try {
            track('claim', 'tap')
            if (isDemoUsername(claimed)) {
                // Retire any pre-demo user request before seeding the synthetic session.
                await queryClient.cancelQueries({ queryKey: [USER] })
                if (current.current !== claimed) return
                enableDemoMode()
                queryClient.setQueryData([USER], DEMO_USER)
                setResidenceCountry('BR')
                setNationalityCountry('')
                setNoBackLockScreenId('advantage-control')
                setSignupCompleted(true)
                setScreenId('advantage-control')
                return
            }
            if (isReservedSignupUsername(claimed) || refusedUsername === claimed) {
                onRefused('refused')
                return
            }
            const result = await reserveUsername(claimed)
            if (current.current !== claimed) return
            if (result === 'taken' || result === 'refused' || result === 'invalid') {
                onRefused(result)
                return
            }
            await handleNext()
        } finally {
            claiming.current = false
            setIsClaiming(false)
        }
    }

    return { claim, isClaiming: isClaiming || isLoading }
}
