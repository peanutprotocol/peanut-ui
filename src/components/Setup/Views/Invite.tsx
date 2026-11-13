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
import { useAuth } from '@/context/authContext'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { invitesApi } from '@/services/invites'
import { toInviteCode } from '@/utils/invite-code.utils'

export default function InviteStep() {
    const t = useTranslations('setup')
    const { username, inviteSelection, setInviteSelection } = useSetupFlowContext()
    const { user } = useAuth()
    const { handleNext, isLoading } = useSetupFlow()
    const [draft, setDraft] = useState(inviteSelection)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [error, setError] = useState('')
    const valueRef = useRef(inviteSelection)
    const { track, trackOnce, trackError } = useSignupControl()

    const ownUsername = toInviteCode(user?.user.username ?? username)
    const busy = isLoading

    const validate = async (value: string): Promise<boolean> => {
        setError('')
        if (ownUsername && toInviteCode(value) === ownUsername) {
            setError(t('signupStep.inviterIsSelf'))
            trackError('inviter_username', 'self')
            return false
        }
        const result = await invitesApi.validateInviteCode(value)
        const valid = result.success && result.attributionResolved
        if (valueRef.current !== value) return valid
        posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid, source: 'signup_optional_inviter' })
        // "Not found" only for a confirmed miss; a failed request says the check did not work.
        const notFound = result.notFound || (result.success && !result.attributionResolved)
        if (!valid) setError(t(notFound ? 'signupStep.inviterNotFound' : 'signupStep.inviterCheckFailed'))
        trackError('inviter_username', valid ? null : notFound ? 'not_found' : 'check_failed')
        return valid
    }

    const onContinue = async () => {
        const code = toInviteCode(draft)
        if (!isValid || isChanging || busy || !code) return
        track('continue', 'tap')
        setInviteSelection(code)
        await handleNext()
    }

    const onSkip = () => {
        track('skip', 'tap')
        setInviteSelection('')
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
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
                        if (isChanging) trackOnce('inviter_username', 'change')
                        valueRef.current = value
                        setDraft(value)
                        setIsValid(isValid)
                        setIsChanging(isChanging)
                        if (isChanging) {
                            setError('')
                            trackError('inviter_username', null)
                        }
                    }}
                    isSetupFlow
                    isInputChanging={isChanging}
                    prefix="@"
                    className="rounded-sm"
                    onClear={() => track('inviter_username_clear', 'tap')}
                />
                <div className="min-h-8 compact:min-h-6">{error && <FieldError>{error}</FieldError>}</div>
            </div>
            <SetupFooter
                actions={
                    <Button
                        shadowSize="4"
                        className="w-full"
                        loading={busy}
                        disabled={!isValid || isChanging || busy}
                        onClick={onContinue}
                    >
                        {t('inviteStep.continue')}
                    </Button>
                }
                secondary={
                    <Button variant="secondary" shadowSize="4" className="w-full" disabled={busy} onClick={onSkip}>
                        {t('inviteStep.skip')}
                    </Button>
                }
            />
        </div>
    )
}
