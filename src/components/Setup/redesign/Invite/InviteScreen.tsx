'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { type InviteStatus, useInviteStep } from '@/features/setup/useInviteStep'
import { notifyHaptic } from '@/utils/haptics'
import { InviteArt } from './InviteArt'
import { InviteField } from './InviteField'
import { InviterSuggestions } from './InviterSuggestions'
import { SAMPLE_FRIEND_HANDLE } from './invite-art.consts'
import { CHIP_MARKERS, splitSuggestionLine } from './suggestion-line'
import { useInviterSuggestions } from './useInviterSuggestions'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

const MISS: readonly InviteStatus[] = ['not-found', 'self', 'check-failed']
const ERROR_KEY = { 'not-found': 'notFound', self: 'isSelf', 'check-failed': 'checkFailed' } as const

/**
 * 04 Invite (step `invite`): who invited you, before the account exists. Optional: Continue only after the
 * lookup finds the person; Skip always works. Mock: scaffold screens/04-invite; contract: mono
 * _temp/signup-redesign/r2/r9/build/contract/P2.md. Behaviour lives in useInviteStep.
 */
export function InviteScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const { reducedMotion } = useSetupShell()
    const device = useShellDevice()
    const { username } = useSetupFlowContext()
    const { track } = useSignupControl()
    const errorId = useId()
    const { draft, code, status, missConfirmed, canContinue, busy, onChange, onClear, onContinue, onSkip } =
        useInviteStep()
    const suggestions = useInviterSuggestions(code, missConfirmed)
    const [foundBeat, setFoundBeat] = useState(0)
    const [missBeat, setMissBeat] = useState(0)

    const found = status === 'found'
    const missed = MISS.includes(status)

    // Found and miss are events: one beat each time the answer arrives, with its haptic.
    useEffect(() => {
        if (status === 'found') {
            setFoundBeat((n) => n + 1)
            notifyHaptic('success')
        } else if (MISS.includes(status)) {
            setMissBeat((n) => n + 1)
            notifyHaptic('error')
        }
    }, [status])

    const line = suggestions.length
        ? splitSuggestionLine(
              suggestions.length > 1
                  ? t('invite.suggestTwo', CHIP_MARKERS)
                  : t('invite.suggestOne', { a: CHIP_MARKERS.a })
          )
        : null
    // Small phones: the lead words move up beside the error line, so two chips fit the row under it.
    const liftLead = !!line && device === 'sm'

    return (
        <SetupScreen
            ground="sky"
            stage="std"
            artTop={212}
            smArtTop={236}
            state={busy ? 'continuing' : status}
            title={t('invite.title')}
            art={
                <InviteArt
                    friendHandle={found ? code : SAMPLE_FRIEND_HANDLE}
                    ownHandle={username}
                    found={found}
                    missed={missed}
                    foundBeat={foundBeat}
                />
            }
            footer={{
                primary: {
                    label: t('common.continue'),
                    disabled: !canContinue,
                    loading: busy,
                    onClick: () => void onContinue(),
                },
                slot: (
                    <LinkButton onClick={onSkip} disabled={busy}>
                        {t('common.skip')}
                    </LinkButton>
                ),
            }}
        >
            <p className={SETUP_LEAD_CLASS}>{t('invite.desc')}</p>
            <InviteField
                value={draft}
                status={status}
                foundHandle={found ? code : ''}
                label={t('invite.fieldLabel')}
                placeholder={t('invite.placeholder')}
                clearLabel={t('invite.clearAria')}
                errorId={errorId}
                missBeat={missBeat}
                foundBeat={foundBeat}
                reducedMotion={reducedMotion}
                onChange={onChange}
                onClear={onClear}
                // as the Continue button: only while it is on (review R2-10)
                onSubmit={() => {
                    if (canContinue) void onContinue()
                }}
            />
            <div className="mt-2 flex min-h-5 items-center text-body-xs" aria-live="polite">
                <motion.div
                    key={status}
                    className="flex items-center gap-1"
                    initial={found || missed ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: 'linear' }}
                >
                    {found && (
                        <>
                            <span className="flex size-5 flex-none items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse">
                                <Icon name="check" size={12} />
                            </span>
                            <span className="text-foreground-primary">{t('invite.found', { name: code })}</span>
                        </>
                    )}
                    {missed && (
                        <FieldError id={errorId}>
                            {t(`invite.${ERROR_KEY[status as keyof typeof ERROR_KEY]}`)}
                        </FieldError>
                    )}
                    {liftLead && <span className="text-foreground-secondary">{line.lead}</span>}
                </motion.div>
            </div>
            {line && (
                <InviterSuggestions
                    lead={liftLead ? '' : line.lead}
                    parts={line.parts}
                    names={suggestions}
                    onPick={(name, position) => {
                        track('inviter_suggestion', 'tap', String(position))
                        onChange(name)
                    }}
                />
            )}
        </SetupScreen>
    )
}
