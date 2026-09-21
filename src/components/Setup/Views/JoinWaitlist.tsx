'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Divider } from '@/components/0_Bruddle/Divider'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Notification } from '@/components/0_Bruddle/Notification'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useEffect, useRef, useState } from 'react'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'
import { invitesApi } from '@/services/invites'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { enableDemoMode, isDemoInviteCode } from '@/utils/demo'
import { useTranslations } from 'next-intl'
import { isCapacitor } from '@/utils/capacitor'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { DEMO_USER } from '@/constants/demo-data'
import { toInviteCode } from '@/utils/general.utils'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'

const JoinWaitlist = () => {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const [inviteCode, setInviteCode] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')
    // flow/api failure — not attributable to the input, so it renders as a
    // notification banner instead of a field error (design.md error display)
    const [flowError, setFlowError] = useState('')

    const { handleNext } = useSetupFlow()
    const router = useRouter()
    const queryClient = useQueryClient()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_WAITLIST_VIEWED)
    }, [])

    // stale-request guard: only the latest validation may touch the error
    // channels — a slow request A resolving after fresh request B must not
    // stack its message next to B's.
    const validationSeq = useRef(0)

    const validateInviteCode = async (inviteCode: string): Promise<boolean> => {
        // token first — even the demo early-return must retire any in-flight
        // validation so a stale resolution cannot write errors for this value
        const seq = ++validationSeq.current
        const isCurrent = () => seq === validationSeq.current
        // Demo mode (native): `demo` is a client-only trigger — never hit the invite
        // API. Keeps it from creating accounts / bypassing the waitlist, and lets it
        // work even when the (prod) backend doesn't know the code.
        if (isCapacitor() && isDemoInviteCode(inviteCode)) {
            enableDemoMode()
            return true
        }
        try {
            setError('')
            setFlowError('')
            setisLoading(true)
            const res = await invitesApi.validateInviteCode(inviteCode)
            const isValid = res.success && res.onboardingResolved
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
                valid: isValid,
                source: 'setup',
                invite_code: inviteCode,
            })
            if (!isValid && isCurrent()) {
                setError(t('waitlist.inviterNotFound'))
            }
            return isValid
        } catch {
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
                valid: false,
                source: 'setup',
                invite_code: inviteCode,
            })
            if (isCurrent()) {
                setFlowError(tCommon('genericError'))
            }
            return false
        } finally {
            if (isCurrent()) {
                setisLoading(false)
            }
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* input + its field error form one column, 4px apart (form-field board 17788:19179) */}
            <div className="flex flex-col gap-1">
                <ValidatedInput
                    placeholder={t('waitlist.inviterUsernamePlaceholder')}
                    value={inviteCode}
                    debounceTime={750}
                    validate={validateInviteCode}
                    shouldValidate={(v) => toInviteCode(v).length >= USERNAME_MIN_LENGTH}
                    onUpdate={({ value, isValid, isChanging }) => {
                        setIsValid(isValid)
                        setIsChanging(isChanging)
                        setInviteCode(value)
                        if (isChanging) {
                            // retire any in-flight validation: a cleared or
                            // shortened value skips the next lookup, so a stale
                            // resolution must not repopulate the channels
                            validationSeq.current++
                            setError('')
                            setFlowError('')
                            setisLoading(false)
                        }
                    }}
                    isSetupFlow
                    isInputChanging={isChanging}
                    className="rounded-sm"
                />
                {error && <FieldError>{error}</FieldError>}
            </div>

            {flowError && <Notification priority="error">{flowError}</Notification>}

            <Button
                variant="primary"
                disabled={!isValid || isChanging || isLoading || inviteCode.length === 0}
                onClick={() => {
                    // Demo mode: skip signup + passkey. Soft-nav (no reload) so the
                    // in-memory demo flag survives — a hard nav loses it and races the
                    // no-credential logout/redirect guards before localStorage is
                    // readable. Seed the user query so the app is logged-in instantly.
                    if (isCapacitor() && isDemoInviteCode(inviteCode)) {
                        enableDemoMode()
                        queryClient.setQueryData([USER], DEMO_USER)
                        router.push('/home')
                        return
                    }
                    stashInvite(inviteCode, EInviteType.DIRECT)
                    handleNext()
                }}
                shadowSize="4"
                icon="chevron-right"
                iconPosition="right"
                className="w-full"
            >
                {t('next')}
            </Button>

            <Divider text={tCommon('or')} textClassname="text-body-s text-foreground-secondary" />

            <Button
                variant="stroke"
                onClick={() => {
                    handleNext()
                }}
                shadowSize="4"
                className="w-full"
            >
                {t('waitlist.joinWaitlist')}
            </Button>
        </div>
    )
}

export default JoinWaitlist
