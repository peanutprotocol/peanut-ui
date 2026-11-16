'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Field } from '@/components/0_Bruddle/Field'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Badge from '@/components/Global/Badges/Badge'
import NavHeader from '@/components/Global/NavHeader'
import ValidatedInput from '@/components/Global/ValidatedInput'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { completePixKey } from '@/features/pix/pixFlow.utils'
import { usePixKeyLookup, type PixKeyLookup } from '@/features/pix/usePixKeyLookup'
import type { PixKeyInfo } from '@/services/pix'
import { brTaxIdKind } from '@/utils/br-tax-id.utils'
import { isPixEmvcoQr, normalizePixInput } from '@/utils/withdraw.utils'

/**
 * The Pix key of a withdrawal or a send. A
 * complete key is resolved to its holder, bank and masked tax id before
 * Continue, so the user sees whom the money goes to. Any key continues, the
 * user's own or another person's (TASK-24947), except a bank the provider does
 * not pay. "Own account" shows only where the provider says the key is the
 * user's own.
 */
export function PixKeyStep({
    title,
    initialKey,
    onBack,
    onContinue,
}: {
    title: string
    initialKey: string
    onBack: () => void
    /** The normalized key and its holder, once it resolved to a key the provider pays. */
    onContinue: (key: string, info: PixKeyInfo) => void
}) {
    const t = useTranslations('pix.withdraw')
    const tWithdraw = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const { lookup, result } = usePixKeyLookup()
    const [value, setValue] = useState(initialKey)
    const [isChanging, setIsChanging] = useState(false)

    const key = completePixKey(value)
    // an answer for a key the user has since changed says nothing about this one
    const current = result && key && result.key === key && !isChanging ? result : null
    // the provider pays any key, except one at a bank it will not pay
    const canPay = current?.status === 'found' && !current.info.blocked
    // the holder card continues too: it is what the user looks at once the key resolves (Aleks, 2026-11-16)
    const continueWithKey = canPay && key ? () => onContinue(key, current.info) : undefined
    const error = isPixEmvcoQr(value.trim()) ? t('notACode') : keyError(current)

    function keyError(lookupResult: PixKeyLookup | null): string | undefined {
        if (!lookupResult) return undefined
        if (lookupResult.status === 'not-found') return tWithdraw('pixKey.notFound')
        if (lookupResult.status === 'qr-code') return t('notACode')
        if (lookupResult.status === 'failed') return t('lookupFailed')
        if (lookupResult.info.blocked) return t('keyBlocked')
        return undefined
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <Field label={tWithdraw('pixKey.placeholder')} error={error}>
                    <ValidatedInput
                        value={value}
                        aria-label={tWithdraw('pixKey.placeholder')}
                        smartPasteKind="pixKey"
                        // only a complete key is looked up: each lookup costs DICT tokens
                        shouldValidate={(input) => !!completePixKey(input)}
                        // a key still being typed is not wrong yet: no red border before it is complete
                        validationIsNeutral={!key}
                        validate={async (input) => {
                            const complete = completePixKey(input)
                            if (!complete) return false
                            const outcome = await lookup(complete)
                            return outcome.status === 'found' && !outcome.info.blocked
                        }}
                        onUpdate={(update) => {
                            setValue(isPixEmvcoQr(update.value.trim()) ? update.value : normalizePixInput(update.value))
                            setIsChanging(update.isChanging)
                        }}
                    />
                </Field>
                {current?.status === 'found' && (
                    <ListItem
                        data-testid="pix-key-holder"
                        position="solo"
                        onClick={continueWithKey}
                        aria-label={
                            continueWithKey
                                ? `${tCommon('continue')}, ${current.info.holderName ?? t('unknownHolder')}`
                                : undefined
                        }
                        leading={<AvatarWithBadge name={current.info.holderName ?? undefined} size="s" />}
                        title={current.info.holderName ?? t('unknownHolder')}
                        body={[
                            current.info.bankName,
                            current.info.holderTaxIdMasked &&
                                [brTaxIdKind(current.info.holderTaxIdMasked), current.info.holderTaxIdMasked]
                                    .filter(Boolean)
                                    .join(' '),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                        bodyWrap
                        // Whose account it is, from the directory. Another person's key needs no badge: the name says
                        // whom the money goes to.
                        trailing={
                            current.info.ownAccount ? (
                                <Badge status="completed" customText={t('ownAccount')} />
                            ) : undefined
                        }
                    />
                )}
            </div>
            <PageStack.Footer>
                <Button variant="primary" className="w-full" disabled={!continueWithKey} onClick={continueWithKey}>
                    {tCommon('continue')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
