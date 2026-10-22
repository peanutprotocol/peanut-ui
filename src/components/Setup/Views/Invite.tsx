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
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { invitesApi } from '@/services/invites'
import { settlePendingInviteAttribution } from '@/services/pending-invite-attribution'
import { EInviteType } from '@/services/services.types'
import { toInviteCode } from '@/utils/invite-code.utils'
import { clearInvite, readInviteCode, stashInvite } from '@/utils/invite-stash'

/**
 * Invited by a friend? An optional step after registration, shown only when the
 * signup has no invite. The person already owns a username here, so the field
 * reads as someone else's, and a verified inviter is accepted on the spot through
 * the same hand-off registration uses for an invite link.
 */
export default function InviteStep() {
    const t = useTranslations('setup')
    const { username } = useSetupFlowContext()
    const { user } = useAuth()
    const { handleNext, isLoading } = useSetupFlow()
    const [draft, setDraft] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [error, setError] = useState('')
    const valueRef = useRef('')

    const ownUsername = toInviteCode(user?.user.username ?? username)
    const busy = isLoading || isAccepting

    const validate = async (value: string): Promise<boolean> => {
        setError('')
        if (ownUsername && toInviteCode(value) === ownUsername) {
            setError(t('signupStep.inviterIsSelf'))
            return false
        }
        const result = await invitesApi.validateInviteCode(value)
        const valid = result.success && result.attributionResolved
        if (valueRef.current !== value) return valid
        posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid, source: 'signup_optional_inviter' })
        // "Not found" only for a confirmed miss; a failed request says the check did not work.
        const notFound = result.notFound || (result.success && !result.attributionResolved)
        if (!valid) setError(t(notFound ? 'signupStep.inviterNotFound' : 'signupStep.inviterCheckFailed'))
        return valid
    }

    const onContinue = async () => {
        const code = toInviteCode(draft)
        const userId = user?.user.userId
        if (!isValid || isChanging || busy || !code || !userId) return
        setIsAccepting(true)
        try {
            stashInvite(code, EInviteType.DIRECT)
            const outcome = await settlePendingInviteAttribution(userId, 'setup_invite_step')
            if (outcome.status === 'attributed') {
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
                void handleNext()
                return
            }
            // A transient failure keeps the stash for the next app start; Skip clears it.
            setError(t(outcome.status === 'retryable' ? 'signupStep.inviterCheckFailed' : 'signupStep.inviterNotFound'))
        } finally {
            setIsAccepting(false)
        }
    }

    const onSkip = () => {
        // Only this step can leave a stash here: the step is hidden when the signup had an invite.
        if (readInviteCode()) clearInvite()
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
