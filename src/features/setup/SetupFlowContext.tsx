'use client'

import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { type ISetupStep } from '@/components/Setup/Setup.types'

/**
 * Setup flow memory that cannot live in the URL: the filtered step list (a
 * runtime decision — PostHog sunset flag + PWA state), the typed username and
 * residence answers, and transient loading/animation state. Mounted at the
 * (setup) layout — flow-scoped, like the withdraw provider (TASK-21816). The
 * step CURSOR is not here: it is a named screen id in the URL (?screen=,
 * TASK-21460), which is what killed the redux numeric index and its silent
 * clamps (TASK-21404).
 */
interface SetupFlowContextType {
    steps: ISetupStep[]
    setSteps: (steps: ISetupStep[]) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    /** step-transition animation direction: 1 forward, -1 back, 0 initial */
    direction: number
    setDirection: (direction: number) => void
    username: string
    setUsername: (username: string) => void
    residenceCountry: string
    setResidenceCountry: (country: string) => void
    secondResidenceCountry: string
    setSecondResidenceCountry: (country: string) => void
    resetSetupFlow: () => void
}

const SetupFlowContext = createContext<SetupFlowContextType | undefined>(undefined)

export const SetupFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [steps, setSteps] = useState<ISetupStep[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [direction, setDirection] = useState(0)
    const [username, setUsername] = useState('')
    const [residenceCountry, setResidenceCountry] = useState('')
    const [secondResidenceCountry, setSecondResidenceCountry] = useState('')

    // "start fresh" on the existing-session interstitial: the provider stays
    // mounted through the logout, so the typed state clears explicitly
    const resetSetupFlow = useCallback(() => {
        setIsLoading(false)
        setDirection(0)
        setUsername('')
        setResidenceCountry('')
        setSecondResidenceCountry('')
    }, [])

    const value = useMemo(
        () => ({
            steps,
            setSteps,
            isLoading,
            setIsLoading,
            direction,
            setDirection,
            username,
            setUsername,
            residenceCountry,
            setResidenceCountry,
            secondResidenceCountry,
            setSecondResidenceCountry,
            resetSetupFlow,
        }),
        [steps, isLoading, direction, username, residenceCountry, secondResidenceCountry, resetSetupFlow]
    )

    return <SetupFlowContext.Provider value={value}>{children}</SetupFlowContext.Provider>
}

export const useSetupFlowContext = (): SetupFlowContextType => {
    const context = useContext(SetupFlowContext)
    if (context === undefined) {
        throw new Error('useSetupFlowContext must be used within a SetupFlowProvider')
    }
    return context
}

/**
 * For hooks that serve setup AND other surfaces (useResidenceRestrictions is
 * consumed by Profile/Home too, where no provider is mounted and the
 * during-signup residence answer simply does not exist). Returns null outside
 * the provider.
 */
export const useOptionalSetupFlow = (): SetupFlowContextType | null => {
    return useContext(SetupFlowContext) ?? null
}
