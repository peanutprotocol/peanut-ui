'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { UsernameAlternatives } from './UsernameAlternatives'
import { UsernameField } from './UsernameField'
import { UsernameHelpRow } from './UsernameHelpRow'
import { UsernameProfileArt } from './UsernameProfileArt'
import { usernameStateName } from './username-state'
import { useUsernameClaim } from './useUsernameClaim'
import { useUsernameField } from './useUsernameField'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/**
 * 02 Username (step `signup`): pick a username, held for this device before the passkey screen creates the
 * account. Mock: scaffold/screens/02-username; contract: mono _temp/signup-redesign/r2/r9/build/contract/C.md.
 * The button turns on only after the person rolls, types an available name or taps a chip (mock a6).
 */
export function UsernameScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.username')
    const helpId = useId()
    const field = useUsernameField()
    const { claim, isClaiming } = useUsernameClaim({ name: field.value, onRefused: field.onClaimRefused })
    const { kind, value } = field
    const ready = kind === 'rolled' || kind === 'available' || kind === 'demo'
    const shownName = kind === 'rolling' ? field.rollFrom : value || field.suggestion

    return (
        <SetupScreen
            ground="yellow"
            stage="std"
            artTop={196}
            title={t('title')}
            state={usernameStateName(kind, isClaiming)}
            art={
                shownName ? (
                    <UsernameProfileArt name={shownName} rolls={field.rolls} rolling={kind === 'rolling'} />
                ) : null
            }
            footer={{
                primary: {
                    label: ready ? t('ctaNamed', { name: value.trim() }) : t('cta'),
                    disabled: !ready || isClaiming,
                    loading: isClaiming,
                    onClick: () => void claim(),
                    testId: 'username-claim',
                },
            }}
        >
            <div data-testid="setup-redesign-username">
                <p className={SETUP_LEAD_CLASS}>{t('desc')}</p>
                <UsernameField
                    value={value}
                    kind={kind}
                    placeholder={field.suggestion}
                    rollFrom={field.rollFrom}
                    rolls={field.rolls}
                    inputRef={field.inputRef}
                    describedBy={helpId}
                    onInput={field.onInput}
                    onFocus={field.onFocus}
                    onBlur={field.onBlur}
                    onClear={field.onClear}
                    onRoll={() => void field.onRoll()}
                    // as the primary button: only while it is on (review R2-10)
                    onSubmit={() => {
                        if (ready && !isClaiming) void claim()
                    }}
                />
                <UsernameHelpRow id={helpId} kind={kind} value={value} onSupport={field.onSupport} />
                <UsernameAlternatives
                    names={kind === 'taken' ? field.alternatives : []}
                    onPick={field.onPickAlternative}
                />
            </div>
        </SetupScreen>
    )
}
