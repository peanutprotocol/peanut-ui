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
import { completePixKey, maskedTaxIdKind } from '@/features/avenia/avenia.utils'
import { usePixKeyLookup, type PixKeyLookup } from '@/features/avenia/hooks/usePixKeyLookup'
import { isPixEmvcoQr, normalizePixInput } from '@/utils/withdraw.utils'

/**
 * The Pix key of a withdrawal. A complete key is resolved to its holder and
 * bank before Continue; Avenia pays only an account under the user's own CPF,
 * so anyone else's key shows as such and cannot continue.
 */
export function AveniaPixKeyStep({
    title,
    initialKey,
    onBack,
    onContinue,
}: {
    title: string
    initialKey: string
    onBack: () => void
    /** The normalized key, once it resolved to the user's own account. */
    onContinue: (key: string) => void
}) {
    const t = useTranslations('avenia.withdraw')
    const tWithdraw = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const { lookup, result } = usePixKeyLookup()
    const [value, setValue] = useState(initialKey)
    const [isChanging, setIsChanging] = useState(false)

    const key = completePixKey(value)
    // an answer for a key the user has since changed says nothing about this one
    const current = result && key && result.key === key && !isChanging ? result : null
    const isOwn = current?.status === 'found' && current.verdict === 'own'
    const error = isPixEmvcoQr(value.trim()) ? t('notACode') : keyError(current)

    function keyError(lookupResult: PixKeyLookup | null): string | undefined {
        if (!lookupResult) return undefined
        if (lookupResult.status === 'not-found') return tWithdraw('pixKey.notFound')
        if (lookupResult.status === 'failed') return t('lookupFailed')
        if (lookupResult.verdict === 'not-own') return t('keyNotOwn')
        if (lookupResult.verdict === 'blocked') return t('keyBlocked')
        return undefined
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <p className="text-body-s text-foreground-secondary">{t('keyIntro')}</p>
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
                            return outcome.status === 'found' && outcome.verdict === 'own'
                        }}
                        onUpdate={(update) => {
                            setValue(isPixEmvcoQr(update.value.trim()) ? update.value : normalizePixInput(update.value))
                            setIsChanging(update.isChanging)
                        }}
                    />
                </Field>
                {current?.status === 'found' && (
                    <ListItem
                        data-testid="avenia-pix-key-holder"
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
                        trailing={
                            current.verdict === 'own' ? (
                                <Badge status="completed" customText={t('ownAccount')} />
                            ) : (
                                <Badge status="failed" customText={t('someoneElses')} />
                            )
                        }
                    />
                )}
            </div>
            <PageStack.Footer>
                <Button
                    variant="primary"
                    className="w-full"
                    disabled={!isOwn || !key}
                    onClick={() => key && onContinue(key)}
                >
                    {tCommon('continue')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
