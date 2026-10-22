'use client'

import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { type ISetupStep, type ScreenId } from '@/components/Setup/Setup.types'
import { type SignupEntryFlow } from '@/features/setup/signup-analytics'

import type { SetupFundingChannel, SetupPaymentChannel } from './paymentChannels'

/**
 * Setup flow memory that cannot live in the URL: the filtered step list (a
 * runtime decision), the typed username and
 * residence answers, and transient loading/animation state. Mounted at the
 * (setup) layout — flow-scoped, like the withdraw provider (TASK-21816). The
 * step CURSOR is not here: it is a named screen id in the URL (?screen=,
 * TASK-21460), which is what killed the redux numeric index and its silent
 * clamps (TASK-21404).
 */
interface SetupFlowContextType {
    fundingChannel: SetupFundingChannel | null
    setFundingChannel: (channel: SetupFundingChannel | null) => void
    paymentChannel: SetupPaymentChannel | null
    setPaymentChannel: (channel: SetupPaymentChannel | null) => void
    notificationEmail: string
    setNotificationEmail: (email: string) => void
    notificationChoices: { push: boolean; email: boolean }
    setNotificationChoices: (choices: { push: boolean; email: boolean }) => void
    signupCompleted: boolean
    setSignupCompleted: (completed: boolean) => void
    /** Unfiltered setup order, injected by the registry owner. */
    masterScreenIds: readonly ScreenId[]
    steps: ISetupStep[]
    setSteps: (steps: ISetupStep[]) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    /** step-transition animation direction: 1 forward, -1 back, 0 initial */
    direction: number
    setDirection: (direction: number) => void
    username: string
    setUsername: (username: string) => void
    /**
     * The country the sell screens were chosen for, fixed once the account exists so
     * the screens do not change under the person. Undefined until then: the layout
     * follows the live country suggestion.
     */
    sellScreensCountry: string | null | undefined
    setSellScreensCountry: (country: string | null | undefined) => void
    residenceCountry: string
    setResidenceCountry: (country: string) => void
    secondResidenceCountry: string
    setSecondResidenceCountry: (country: string) => void
    signupEntryFlow: SignupEntryFlow
    setSignupEntryFlow: (entryFlow: SignupEntryFlow) => void
    /**
     * The point of no return: the earliest safe step after registration
     * (confirmed registration or resolved post-registration entry). Guards
     * refuse every earlier step while set. Context state, not a per-instance
     * ref: several components run their own useSetupFlow instance, and the
     * lock must be one fact — and it must NOT arm off a stale terminal URL
     * that never actually rendered (Chip review round 2).
     */
    noBackLockScreenId: ScreenId | null
    setNoBackLockScreenId: (screenId: ScreenId | null) => void
    resetSetupFlow: () => void
}

const SetupFlowContext = createContext<SetupFlowContextType | undefined>(undefined)

export const SetupFlowProvider: React.FC<{ children: ReactNode; masterScreenIds: readonly ScreenId[] }> = ({
    children,
    masterScreenIds,
}) => {
    const [notificationEmail, setNotificationEmail] = useState('')
    const [fundingChannel, setFundingChannel] = useState<SetupFundingChannel | null>(null)
    const [paymentChannel, setPaymentChannel] = useState<SetupPaymentChannel | null>(null)
    const [notificationChoices, setNotificationChoices] = useState({ push: false, email: true })
    const [signupCompleted, setSignupCompleted] = useState(false)
    const [steps, setSteps] = useState<ISetupStep[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [direction, setDirection] = useState(0)
    const [username, setUsername] = useState('')
    const [sellScreensCountry, setSellScreensCountry] = useState<string | null | undefined>(undefined)
    const [residenceCountry, setResidenceCountry] = useState('')
    const [secondResidenceCountry, setSecondResidenceCountry] = useState('')
    const [signupEntryFlow, setSignupEntryFlow] = useState<SignupEntryFlow>('default')
    const [noBackLockScreenId, setNoBackLockScreenId] = useState<ScreenId | null>(null)

    // "start fresh" on the existing-session interstitial: the provider stays
    // mounted through the logout, so the typed state clears explicitly
    const resetSetupFlow = useCallback(() => {
        setIsLoading(false)
        setFundingChannel(null)
        setPaymentChannel(null)
        setNotificationEmail('')
        setNotificationChoices({ push: false, email: true })
        setSignupCompleted(false)
        setDirection(0)
        setUsername('')
        setSellScreensCountry(undefined)
        setResidenceCountry('')
        setSecondResidenceCountry('')
        setNoBackLockScreenId(null)
    }, [])

    const value = useMemo(
        () => ({
            fundingChannel,
            setFundingChannel,
            paymentChannel,
            setPaymentChannel,
            notificationEmail,
            setNotificationEmail,
            notificationChoices,
            setNotificationChoices,
            signupCompleted,
            setSignupCompleted,
            masterScreenIds,
            steps,
            setSteps,
            isLoading,
            setIsLoading,
            direction,
            setDirection,
            username,
            setUsername,
            sellScreensCountry,
            setSellScreensCountry,
            residenceCountry,
            setResidenceCountry,
            secondResidenceCountry,
            setSecondResidenceCountry,
            signupEntryFlow,
            setSignupEntryFlow,
            noBackLockScreenId,
            setNoBackLockScreenId,
            resetSetupFlow,
        }),
        [
            fundingChannel,
            paymentChannel,
            notificationEmail,
            notificationChoices,
            signupCompleted,
            masterScreenIds,
            steps,
            isLoading,
            direction,
            username,
            sellScreensCountry,
            residenceCountry,
            secondResidenceCountry,
            signupEntryFlow,
            noBackLockScreenId,
            resetSetupFlow,
        ]
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
