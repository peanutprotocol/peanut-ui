'use client'

import Image, { type ImageProps } from 'next/image'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import type { BrTaxIdKind } from '@/utils/br-tax-id.utils'

/**
 * The card a payment form leads with: the method's mark, the operation's lead
 * word ("Paying", "Withdrawing"), the recipient's name, the Pix key and tax ID
 * it belongs to, and the bank. One card for the Pix-key payment and the Pix
 * withdrawal (ruling 2026-11-12, providers are cattle): the words are the
 * payment form's, only `lead` names the operation.
 */
export function RecipientCard({
    lead,
    icon,
    name,
    maskName = false,
    pixKey,
    taxId,
    bankName,
}: {
    lead: string
    /** The method's mark (the Pix logo, Mercado Pago, a flag). */
    icon: ImageProps['src'] | null
    name: string
    /** The name is a person's (a Pix key's holder), so session replays mask it; a merchant's is not. */
    maskName?: boolean
    /** The key the recipient is paid by, when it is not their own tax ID (`pixKeyOwnerDetails`). */
    pixKey?: string | null
    taxId?: { kind: BrTaxIdKind; value: string } | null
    bankName?: string | null
}) {
    const t = useTranslations('qrPay')
    const hasDetails = !!pixKey || !!taxId
    return (
        <Card className="p-4">
            <div className="flex items-center gap-3">
                <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-white">
                    {icon && (
                        <Image
                            src={icon}
                            alt={t('paymentMethodAlt')}
                            width={32}
                            height={32}
                            className="size-8 rounded-full object-cover"
                        />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-center text-body-s">
                        <Icon name="arrow-up-right" size={16} /> {lead}
                    </p>
                    <p className={`text-heading-xs break-words ${maskName ? 'ph-mask ph-no-capture' : ''}`}>{name}</p>
                    {/* The heading is the owner's name; this line names the key and tax ID it belongs to. */}
                    {hasDetails && (
                        <p className="ph-mask ph-no-capture text-body-s break-words text-foreground-secondary">
                            {pixKey}
                            {pixKey && taxId && ' · '}
                            {/* "CPF 12*******90" never breaks between the label and the number. */}
                            {taxId && (
                                <span className="whitespace-nowrap">
                                    {t('pixKeyOwnerTaxId', { taxIdKind: taxId.kind, taxId: taxId.value })}
                                </span>
                            )}
                        </p>
                    )}
                    {bankName && (
                        <p className="ph-mask ph-no-capture flex items-start gap-1 text-body-s text-foreground-secondary">
                            <Icon
                                name="bank"
                                size={16}
                                role="img"
                                aria-label={t('recipientBank')}
                                className="mt-0.5 flex-shrink-0"
                            />
                            <span className="min-w-0 break-words">{bankName}</span>
                        </p>
                    )}
                </div>
            </div>
        </Card>
    )
}
