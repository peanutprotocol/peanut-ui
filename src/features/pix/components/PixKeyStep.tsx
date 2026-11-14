'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Field } from '@/components/0_Bruddle/Field'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Badge from '@/components/Global/Badges/Badge'
import NavHeader from '@/components/Global/NavHeader'
import ValidatedInput from '@/components/Global/ValidatedInput'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { completePixKey, maskedTaxIdKind } from '@/features/pix/pixFlow.utils'
import { usePixKeyLookup, type PixKeyLookup } from '@/features/pix/usePixKeyLookup'
import type { PixKeyInfo } from '@/services/pix'
import { isPixEmvcoQr, normalizePixInput } from '@/utils/withdraw.utils'

/**
 * The Pix key of a withdrawal or a send, or the new key for a refused payout. A
 * complete key is resolved to its holder, bank and masked tax id before
 * Continue, so the user sees whom the money goes to. Any key continues, the
 * user's own or another person's (TASK-24947), except a bank the provider does
 * not pay. "Own account" shows only where the provider says the key is the
 * user's own.
 */
export function PixKeyStep({
    title,
    initialKey,
    intro,
    onBack,
    onContinue,
    isSubmitting = false,
    refusal,
}: {
    title: string
    initialKey: string
    /** A line above the field; none by default, so a withdrawal and a send differ only by their title. */
    intro?: string
    onBack: () => void
    /** The normalized key and its holder, once it resolved to a key the provider pays. */
    onContinue: (key: string, info: PixKeyInfo) => void
    /** Continue waits for the caller's answer. */
    isSubmitting?: boolean
    /** What the caller's submit refused: under the field when it names this key, else above Continue. */
    refusal?: { message: string; key: string | null } | null
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
    // a refusal for a key the user has since changed says nothing about this one
    const refusedKey = refusal?.key && refusal.key === key ? refusal.message : undefined
    const error = isPixEmvcoQr(value.trim()) ? t('notACode') : (keyError(current) ?? refusedKey)

    function keyError(lookupResult: PixKeyLookup | null): string | undefined {
        if (!lookupResult) return undefined
        if (lookupResult.status === 'not-found') return tWithdraw('pixKey.notFound')
        if (lookupResult.status === 'failed') return t('lookupFailed')
        if (lookupResult.info.blocked) return t('keyBlocked')
        return undefined
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                {intro && <p className="text-body-s text-foreground-secondary">{intro}</p>}
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
                        leading={<AvatarWithBadge name={current.info.holderName ?? undefined} size="s" />}
                        title={current.info.holderName ?? t('unknownHolder')}
                        body={[
                            current.info.bankName,
                            current.info.holderTaxIdMasked &&
                                `${maskedTaxIdKind(current.info.holderTaxIdMasked)} ${current.info.holderTaxIdMasked}`,
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
                {refusal && !refusal.key && <Callout priority="error">{refusal.message}</Callout>}
                <Button
                    variant="primary"
                    className="w-full"
                    loading={isSubmitting}
                    disabled={!canPay || !key || isSubmitting || !!refusedKey}
                    onClick={() => key && current?.status === 'found' && onContinue(key, current.info)}
                >
                    {tCommon('continue')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
