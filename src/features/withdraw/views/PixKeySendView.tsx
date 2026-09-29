'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { isPixEmvcoQr, normalizePixInput, validatePixKey } from '@/utils/withdraw.utils'
import { isPixKeyNotFound, pixKeyToQrPayUrl } from '@/utils/pix.utils'
import { pixKeyOwnerQueryOptions } from '@/hooks/usePixKeyOwner'
import { useTranslations } from 'next-intl'

/**
 * Send to any PIX key via the Manteca QR-payment endpoint.
 *
 * Reached from the withdraw/send flow for Brazil PIX (replaces the
 * offramp/withdraw endpoint). Collects the key, wraps it into a BR Code and
 * hands off to `/qr-pay`, where the amount is entered and the capability gate
 * (`canDo('pay', { provider: 'manteca' })`) is enforced — the same path the QR
 * scanner uses for a pasted PIX key.
 *
 * Continue first resolves the key's owner, so /qr-pay can show who is paid and
 * an unknown key stops here instead of failing at payment.
 */
export default function PixKeySendView({ destinationParam }: { destinationParam?: string | null }) {
    const router = useRouter()
    const onBack = useSafeBack('/send')
    const t = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const [pixKey, setPixKey] = useState<string>(destinationParam ?? '')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isResolvingOwner, setIsResolvingOwner] = useState(false)
    // Re-runs the input's validation, so a key the lookup did not find shows as invalid.
    const [validationNonce, setValidationNonce] = useState(0)
    const queryClient = useQueryClient()
    // The lookup can take seconds. By the time it answers, the key may have
    // changed or the user may have left, and its answer must not act then.
    const currentKeyRef = useRef(pixKey)
    const isMountedRef = useRef(false)
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    const isKnownUnknownKey = (key: string) =>
        isPixKeyNotFound(queryClient.getQueryState(pixKeyOwnerQueryOptions(key).queryKey)?.error)

    const validatePixDestination = async (value: string): Promise<boolean> => {
        const normalized = isPixEmvcoQr(value.trim()) ? value.trim() : value.replace(/\s/g, '')
        const result = validatePixKey(normalized)
        if (!result.valid) {
            setErrorMessage(result.message ?? t('pixKey.invalid'))
            return false
        }
        // Remembered, so returning to a key that was not found costs no second lookup.
        if (isKnownUnknownKey(normalized)) {
            setErrorMessage(t('pixKey.notFound'))
            return false
        }
        return true
    }

    const handleContinue = async () => {
        const url = pixKeyToQrPayUrl(pixKey)
        if (!url) {
            setErrorMessage(t('pixKey.invalid'))
            return
        }
        const trimmedKey = pixKey.trim()
        // A BR Code names its own recipient; only a bare key needs the lookup.
        if (!isPixEmvcoQr(trimmedKey)) {
            setIsResolvingOwner(true)
            let isUnknownKey = false
            try {
                await queryClient.fetchQuery(pixKeyOwnerQueryOptions(trimmedKey))
            } catch (error) {
                // Only an unknown key stops the user. Any other failure pays
                // without a name, as before this lookup existed.
                isUnknownKey = isPixKeyNotFound(error)
            } finally {
                setIsResolvingOwner(false)
            }
            if (!isMountedRef.current || currentKeyRef.current.trim() !== trimmedKey) return
            if (isUnknownKey) {
                setErrorMessage(t('pixKey.notFound'))
                setIsValid(false)
                setValidationNonce((nonce) => nonce + 1)
                return
            }
        }
        router.push(url)
    }

    return (
        <PageStack>
            <NavHeader title={t('pixKey.title')} onPrev={onBack} />
            <PageStack.Center>
                <div className="space-y-4">
                    <h2 className="text-heading-card text-foreground-primary">{t('pixKey.heading')}</h2>
                    <div className="space-y-2">
                        {/* input + its field error form one column, 4px apart (form-field board 17788:19179) */}
                        <div className="flex flex-col gap-1">
                            <ValidatedInput
                                value={pixKey}
                                placeholder={t('pixKey.placeholder')}
                                onUpdate={(update) => {
                                    currentKeyRef.current = normalizePixInput(update.value)
                                    setPixKey(currentKeyRef.current)
                                    setIsValid(update.isValid)
                                    setIsChanging(update.isChanging)
                                    if (update.isValid || update.value === '') {
                                        setErrorMessage(null)
                                    }
                                }}
                                validate={validatePixDestination}
                                validationNonce={validationNonce}
                                smartPasteKind="pixKey"
                            />
                            {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </div>
                        <div className="flex items-center gap-2 text-body-s text-foreground-secondary">
                            <span>{t('pixKey.info')}</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleContinue}
                        disabled={!isValid || isChanging || isResolvingOwner}
                        loading={isChanging || isResolvingOwner}
                        className="w-full"
                        shadowSize="4"
                    >
                        {tCommon('continue')}
                    </Button>
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
