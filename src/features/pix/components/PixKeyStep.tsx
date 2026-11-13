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
 * complete key is resolved to its holder and bank before Continue. Where the
 * provider tells whose key it is, the user's own key reads as such; another
 * person's key continues only where the flow pays one (`paysOthersKeys`, a send
 * to that person), and is refused elsewhere. Where the provider cannot tell
 * (`unchecked`), the key continues with no ownership badge. A lookup that could
 * not finish (the provider still checking, a failure) offers Try again: whose
 * key it is is never guessed.
 */
export function PixKeyStep({
    title,
    initialKey,
    intro,
    paysOthersKeys = false,
    onBack,
    onContinue,
    onRouteRefused,
    isSubmitting = false,
    refusal,
}: {
    title: string
    initialKey: string
    /** The line above the field; the withdrawal's own by default. */
    intro?: string
    /** Another person's key continues, as a send to them; the user's own keys only by default. */
    paysOthersKeys?: boolean
    onBack: () => void
    /** The normalized key and its holder, once it resolved to a key the flow pays. */
    onContinue: (key: string, info: PixKeyInfo) => void
    /** The lookup's route refused the user (403): the caller reads where the user stands now. */
    onRouteRefused?: () => void
    /** Continue waits for the caller's answer. */
    isSubmitting?: boolean
    /** What the caller's submit refused: under the field when it names this key, else above Continue. */
    refusal?: { message: string; key: string | null } | null
}) {
    const t = useTranslations('pix.withdraw')
    const tPix = useTranslations('pix')
    const tWithdraw = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const { lookup, result, clear } = usePixKeyLookup()
    const [value, setValue] = useState(initialKey)
    const [isChanging, setIsChanging] = useState(false)
    // asks the field to look the same key up again
    const [lookupNonce, setLookupNonce] = useState(0)

    const payable = (lookupResult: PixKeyLookup) =>
        lookupResult.status === 'found' &&
        (lookupResult.verdict === 'own' ||
            lookupResult.verdict === 'unchecked' ||
            (paysOthersKeys && lookupResult.verdict === 'not-own'))

    const key = completePixKey(value)
    // an answer for a key the user has since changed says nothing about this one
    const current = result && key && result.key === key && !isChanging ? result : null
    const canPay = !!current && payable(current)
    // the provider still checked the key, or the check failed: the same key may resolve on another try
    const canRetry = current?.status === 'checking' || current?.status === 'failed'
    // a refusal for a key the user has since changed says nothing about this one
    const refusedKey = refusal?.key && refusal.key === key ? refusal.message : undefined
    const error = isPixEmvcoQr(value.trim()) ? t('notACode') : (keyError(current) ?? refusedKey)

    function keyError(lookupResult: PixKeyLookup | null): string | undefined {
        if (!lookupResult) return undefined
        switch (lookupResult.status) {
            case 'not-found':
                return tWithdraw('pixKey.notFound')
            case 'checking':
                return t('keyChecking')
            case 'unusable':
                return t('keyNotUsable')
            case 'throttled':
                return t('lookupThrottled')
            case 'refused':
                return tPix(lookupResult.residence ? 'residenceNotServed' : 'rolloutClosed')
            case 'failed':
                return t('lookupFailed')
            case 'found':
                if (lookupResult.verdict === 'not-own' && !paysOthersKeys) return t('keyNotOwn')
                if (lookupResult.verdict === 'blocked') return t('keyBlocked')
                return undefined
        }
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <p className="text-body-s text-foreground-secondary">{intro ?? t('keyIntro')}</p>
                <Field label={tWithdraw('pixKey.placeholder')} error={error}>
                    <ValidatedInput
                        value={value}
                        aria-label={tWithdraw('pixKey.placeholder')}
                        smartPasteKind="pixKey"
                        validationNonce={lookupNonce}
                        // only a complete key is looked up: each lookup costs DICT tokens
                        shouldValidate={(input) => !!completePixKey(input)}
                        // a key still being typed is not wrong yet: no red border before it is complete
                        validationIsNeutral={!key}
                        validate={async (input) => {
                            const complete = completePixKey(input)
                            if (!complete) return false
                            const outcome = await lookup(complete)
                            if (outcome.status === 'refused') onRouteRefused?.()
                            return payable(outcome)
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
                        // Whose account it is, from the directory: a deny-listed bank can still be the user's own.
                        // A payable key of another person needs no warning: the name says whom the money goes to.
                        trailing={
                            current.info.ownAccount === null ? undefined : current.info.ownAccount ? (
                                <Badge status="completed" customText={t('ownAccount')} />
                            ) : paysOthersKeys ? undefined : (
                                <Badge status="failed" customText={t('someoneElses')} />
                            )
                        }
                    />
                )}
            </div>
            <PageStack.Footer>
                {refusal && !refusal.key && <Callout priority="error">{refusal.message}</Callout>}
                {canRetry ? (
                    <Button
                        variant="primary"
                        className="w-full"
                        data-testid="pix-key-retry"
                        // the old answer goes, so Continue waits on the new lookup
                        onClick={() => {
                            clear()
                            setLookupNonce((nonce) => nonce + 1)
                        }}
                    >
                        {tCommon('tryAgain')}
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        className="w-full"
                        loading={isSubmitting}
                        disabled={!canPay || !key || isSubmitting || !!refusedKey}
                        onClick={() => key && current?.status === 'found' && onContinue(key, current.info)}
                    >
                        {tCommon('continue')}
                    </Button>
                )}
            </PageStack.Footer>
        </PageStack>
    )
}
