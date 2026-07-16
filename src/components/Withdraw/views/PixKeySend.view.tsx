'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import ValidatedInput from '@/components/Global/ValidatedInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { isPixEmvcoQr, normalizePixInput, validatePixKey } from '@/utils/withdraw.utils'
import { pixKeyToQrPayUrl } from '@/utils/pix.utils'

/**
 * Send to any PIX key via the Manteca QR-payment endpoint.
 *
 * Reached from the withdraw/send flow for Brazil PIX (replaces the
 * offramp/withdraw endpoint). Collects the key, wraps it into a BR Code and
 * hands off to `/qr-pay`, where the amount is entered and the capability gate
 * (`canDo('pay', { provider: 'manteca' })`) is enforced — the same path the QR
 * scanner uses for a pasted PIX key.
 */
export default function PixKeySendView({ destinationParam }: { destinationParam?: string | null }) {
    const router = useRouter()
    const onBack = useSafeBack('/send')
    const [pixKey, setPixKey] = useState<string>(destinationParam ?? '')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const validatePixDestination = async (value: string): Promise<boolean> => {
        const normalized = isPixEmvcoQr(value.trim()) ? value.trim() : value.replace(/\s/g, '')
        const result = validatePixKey(normalized)
        if (!result.valid) {
            setErrorMessage(result.message ?? 'Invalid Pix key')
        }
        return result.valid
    }

    const handleContinue = () => {
        const url = pixKeyToQrPayUrl(pixKey)
        if (!url) {
            setErrorMessage('Invalid Pix key')
            return
        }
        router.push(url)
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Send with Pix" onPrev={onBack} />
            <div className="my-auto flex flex-col gap-6">
                <div className="space-y-4">
                    <h2 className="text-lg font-bold">Enter Pix key</h2>
                    <div className="space-y-2">
                        <ValidatedInput
                            value={pixKey}
                            placeholder="PIX Key (Include +55 in case of phone number)"
                            onUpdate={(update) => {
                                setPixKey(normalizePixInput(update.value))
                                setIsValid(update.isValid)
                                setIsChanging(update.isChanging)
                                if (update.isValid || update.value === '') {
                                    setErrorMessage(null)
                                }
                            }}
                            validate={validatePixDestination}
                            smartPasteKind="pixKey"
                        />
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Icon name="info" size={16} />
                            <span>Send to any Pix key — email, phone, CPF/CNPJ or random key.</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleContinue}
                        disabled={!isValid || isChanging}
                        loading={isChanging}
                        className="w-full"
                        shadowSize="4"
                    >
                        Continue
                    </Button>

                    {errorMessage && <ErrorAlert description={errorMessage} />}
                </div>
            </div>
        </div>
    )
}
