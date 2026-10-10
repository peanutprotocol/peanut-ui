'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import ValidatedInput from '@/components/Global/ValidatedInput'
import SetupFooter from '../components/SetupFooter'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { invitesApi } from '@/services/invites'
import { toInviteCode } from '@/utils/invite-code.utils'

/**
 * Invited by a friend? An optional step before the username: a verified inviter
 * becomes the invite that registration attributes; Skip leaves any invite link
 * the user arrived with in place.
 */
export default function InviteStep() {
    const t = useTranslations('setup')
    const { inviterUsername, setInviterUsername, applyManualInvite, clearManualInvite } = useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const [draft, setDraft] = useState(inviterUsername)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [error, setError] = useState('')
    const valueRef = useRef(inviterUsername)

    const validate = async (value: string): Promise<boolean> => {
        setError('')
        const result = await invitesApi.validateInviteCode(value)
        const valid = result.success && result.attributionResolved
        if (valueRef.current !== value) return valid
        posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid, source: 'signup_optional_inviter' })
        // "Not found" only for a confirmed miss; a failed request says the check did not work.
        const notFound = result.notFound || (result.success && !result.attributionResolved)
        if (!valid) setError(t(notFound ? 'signupStep.inviterNotFound' : 'signupStep.inviterCheckFailed'))
        return valid
    }

    const onContinue = () => {
        const code = toInviteCode(draft)
        if (!isValid || isChanging || !code) return
        setInviterUsername(draft)
        applyManualInvite(code)
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        void handleNext()
    }

    // Skip undoes an inviter added on an earlier visit and restores the
    // invite-link referral, if there was one.
    const onSkip = () => {
        if (inviterUsername) {
            clearManualInvite()
            setInviterUsername('')
        }
        void handleNext()
    }

    return (
        <div className="flex h-full flex-1 flex-col justify-between gap-6">
            <div className="flex flex-1 flex-col justify-center gap-1">
                <ValidatedInput
                    aria-label={t('signupStep.inviterUsernameLabel')}
                    placeholder={t('signupStep.inviterUsernamePlaceholder')}
                    value={draft}
                    debounceTime={750}
                    validate={validate}
                    shouldValidate={(value) => toInviteCode(value).length >= USERNAME_MIN_LENGTH}
                    onUpdate={({ value, isValid, isChanging }) => {
                        valueRef.current = value
                        setDraft(value)
                        setIsValid(isValid)
                        setIsChanging(isChanging)
                        if (isChanging) setError('')
                    }}
                    isSetupFlow
                    isInputChanging={isChanging}
                    prefix="@"
                    className="rounded-sm"
                />
                <div className="min-h-8">{error && <FieldError>{error}</FieldError>}</div>
            </div>
            <SetupFooter
                actions={
                    <Button
                        shadowSize="4"
                        className="w-full"
                        loading={isLoading}
                        disabled={!isValid || isChanging || isLoading}
                        onClick={onContinue}
                    >
                        {t('inviteStep.continue')}
                    </Button>
                }
                secondary={
                    <Button variant="secondary" shadowSize="4" className="w-full" disabled={isLoading} onClick={onSkip}>
                        {t('inviteStep.skip')}
                    </Button>
                }
            />
        </div>
    )
}
