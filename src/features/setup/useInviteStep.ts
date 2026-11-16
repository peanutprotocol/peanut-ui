'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { useAuth } from '@/context/authContext'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { invitesApi } from '@/services/invites'
import { toInviteCode } from '@/utils/invite-code.utils'

/** The lookup waits this long after the last edit (dev's ValidatedInput default). */
export const INVITE_CHECK_DEBOUNCE_MS = 750

/** Below the minimum username length the value counts as still changing: no lookup, no error. */
export const shouldCheckInviter = (value: string): boolean => toInviteCode(value).length >= USERNAME_MIN_LENGTH

/**
 * Where the inviter field stands. `typing` also covers a value too short to check. `not-found` is a confirmed
 * miss (no such user, or a campaign-only code); `check-failed` means the lookup itself did not work.
 */
export type InviteStatus = 'default' | 'typing' | 'checking' | 'found' | 'not-found' | 'self' | 'check-failed'

/**
 * The optional inviter step (step `invite`), before the account exists. Continue only stores the chosen code in
 * `inviteSelection`; the invite is accepted after the passkey (`settlePendingInviteAttribution` in
 * useSignupPasskey). Skip clears only this choice, never an invite-link or tracked-link stash.
 * Contract: mono _temp/signup-redesign/r2/r9/build/contract/P2.md § 4, § 6, § 9.
 */
export function useInviteStep() {
    const { username, inviteSelection, setInviteSelection } = useSetupFlowContext()
    const { user } = useAuth()
    const { handleNext, isLoading } = useSetupFlow()
    const { track, trackOnce, trackError } = useSignupControl()
    const [draft, setDraft] = useState(inviteSelection)
    const [status, setStatus] = useState<InviteStatus>(inviteSelection ? 'typing' : 'default')
    // true only when the API said "no such user" for the value on show; the suggestion chips wait for it
    const [missConfirmed, setMissConfirmed] = useState(false)
    const valueRef = useRef(inviteSelection)
    // every edit and every lookup takes a new id, so an answer for an older value changes nothing
    const requestRef = useRef(0)

    const ownUsername = toInviteCode(user?.user.username ?? username)

    const check = (value: string) => {
        if (value !== valueRef.current || !shouldCheckInviter(value)) return
        const code = toInviteCode(value)
        const id = ++requestRef.current
        if (ownUsername && code === ownUsername) {
            setStatus('self')
            trackError('inviter_username', 'self')
            return
        }
        setStatus('checking')
        void invitesApi.validateInviteCode(code).then((result) => {
            if (id !== requestRef.current || valueRef.current !== value) return
            const valid = result.success && result.attributionResolved
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid, source: 'signup_optional_inviter' })
            // "Not found" only for a confirmed miss; a failed request says the check did not work.
            const notFound = result.notFound || (result.success && !result.attributionResolved)
            setStatus(valid ? 'found' : notFound ? 'not-found' : 'check-failed')
            setMissConfirmed(result.notFound === true)
            trackError('inviter_username', valid ? null : notFound ? 'not_found' : 'check_failed')
        })
    }
    // the debounce timer fires after renders; it must call this render's check (current own username)
    const checkRef = useRef(check)
    checkRef.current = check
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    // A value restored from the draft (Back from Passkey, a resume) is checked at once, as dev's field did.
    useEffect(() => {
        if (valueRef.current) checkRef.current(valueRef.current)
        return () => clearTimeout(timerRef.current)
    }, [])

    const onChange = useCallback(
        (value: string) => {
            valueRef.current = value
            requestRef.current++
            setDraft(value)
            setStatus(value ? 'typing' : 'default')
            setMissConfirmed(false)
            trackOnce('inviter_username', 'change')
            trackError('inviter_username', null)
            clearTimeout(timerRef.current)
            if (value) timerRef.current = setTimeout(() => checkRef.current(value), INVITE_CHECK_DEBOUNCE_MS)
        },
        [trackOnce, trackError]
    )

    const onClear = useCallback(() => {
        valueRef.current = ''
        requestRef.current++
        setDraft('')
        setStatus('default')
        setMissConfirmed(false)
        clearTimeout(timerRef.current)
        trackError('inviter_username', null)
        track('inviter_username_clear', 'tap')
    }, [track, trackError])

    const code = toInviteCode(draft)
    const canContinue = status === 'found' && !isLoading && !!code

    const onContinue = async () => {
        if (!canContinue) return
        track('continue', 'tap')
        setInviteSelection(code)
        await handleNext()
    }

    const onSkip = () => {
        if (isLoading) return
        track('skip', 'tap')
        setInviteSelection('')
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
        void handleNext()
    }

    return {
        draft,
        code,
        status,
        missConfirmed: status === 'not-found' && missConfirmed,
        canContinue,
        busy: isLoading,
        onChange,
        onClear,
        onContinue,
        onSkip,
    }
}
