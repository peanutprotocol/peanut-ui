'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import Card from '@/components/Global/Card'
import { localizeDocsHref } from '@/components/Global/DocsLink'
import { Icon } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'
import { BASE_URL } from '@/constants/general.consts'
import { DOCUMENTS_HELP_HREF } from '@/constants/kyc.consts'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId, ProviderRole } from '@/types/provider.types'
import { openExternalUrl } from '@/utils/capacitor'

interface ProviderSheetProps {
    providerId: ProviderId
    open: boolean
    onClose: () => void
    /** set when the sheet opens from inside another drawer */
    nested?: boolean
    /** QR payments: the money leaves Peanut's own account at Manteca */
    pooledAccount?: boolean
    /** shown before the user accepts the provider's terms: the relationship line speaks of it as ahead */
    prospective?: boolean
    /** opened from an identity check footnote: links how peanut handles the documents */
    documentsHelp?: boolean
}

const ROLE_CONCEPT: Record<ProviderRole, Concept> = {
    bridge: 'bank',
    manteca: 'bank',
    rhino: 'crypto',
    thirdNational: 'card',
    sumsub: 'verification',
}

/**
 * Who the provider is, in legal terms (TASK-23295, Brazil Resolution 520).
 * Only fields present in the registry render, so an unverified fact never shows.
 */
export const ProviderSheet = ({
    providerId,
    open,
    onClose,
    nested,
    pooledAccount,
    prospective,
    documentsHelp,
}: ProviderSheetProps) => {
    const t = useTranslations('provider')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const provider = PROVIDERS[providerId]
    const sumsub = PROVIDERS.sumsub
    const isCard = provider.role === 'thirdNational'
    const { termsUrl, privacyUrl } = provider

    return (
        <Drawer
            nested={nested}
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble {...CONCEPT_ICONS[ROLE_CONCEPT[provider.role]]} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{provider.brand}</DrawerTitle>
                            <DrawerDescription>{t(`role.${provider.role}`)}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <Callout priority="info">
                            {isCard
                                ? t(prospective ? 'cardSheetIntroProspective' : 'cardSheetIntro', {
                                      brand: provider.brand,
                                  })
                                : `${t('sheetIntro', { brand: provider.brand })} ${t('peanutValue')}`}
                        </Callout>
                        <Card position="solo" className={receiptDataRowCardClassName}>
                            {provider.legalName && <DataRow label={t('field.legalName')} value={provider.legalName} />}
                            {provider.registeredOffice && (
                                <DataRow
                                    label={t('field.registeredOffice')}
                                    value={provider.registeredOffice.map((line) => (
                                        <span key={line} className="block">
                                            {line}
                                        </span>
                                    ))}
                                />
                            )}
                            {provider.registration && (
                                <DataRow label={t('field.registration')} value={provider.registration} />
                            )}
                            {provider.regulator && <DataRow label={t('field.regulator')} value={provider.regulator} />}
                            {/* sumsub checks id on bridge's behalf, so it belongs on every bridge sheet */}
                            {provider.role === 'bridge' && (
                                <DataRow
                                    label={t('field.identityCheck')}
                                    value={`${sumsub.brand} (${sumsub.legalName})`}
                                />
                            )}
                            {pooledAccount && <DataRow label={t('field.paidFrom')} value={t('pooledAccount')} />}
                        </Card>
                        {(termsUrl || privacyUrl || documentsHelp) && (
                            <div className="flex flex-col gap-2">
                                {/* only true when the user accepted the provider's terms; a qr payment
                                    leaves peanut's own account, so it never applies there */}
                                <p className="text-body-s text-foreground-primary">
                                    {!isCard && provider.userContract && !pooledAccount
                                        ? t(prospective ? 'relationshipProspective' : 'relationship', {
                                              brand: provider.brand,
                                          })
                                        : t('field.documents')}
                                </p>
                                <ListGroup>
                                    {termsUrl && (
                                        <ListItem
                                            title={t('field.terms')}
                                            trailing={<Icon name="arrow-up-right" size={20} />}
                                            onClick={() => void openExternalUrl(termsUrl)}
                                        />
                                    )}
                                    {privacyUrl && (
                                        <ListItem
                                            title={t('field.privacy')}
                                            trailing={<Icon name="arrow-up-right" size={20} />}
                                            onClick={() => void openExternalUrl(privacyUrl)}
                                        />
                                    )}
                                    {documentsHelp && (
                                        <ListItem
                                            title={t('field.documentsHelp')}
                                            trailing={<Icon name="arrow-up-right" size={20} />}
                                            onClick={() =>
                                                void openExternalUrl(
                                                    `${BASE_URL}${localizeDocsHref(DOCUMENTS_HELP_HREF, locale)}`
                                                )
                                            }
                                        />
                                    )}
                                </ListGroup>
                            </div>
                        )}
                        <Button variant="primary" className="w-full justify-center" onClick={onClose}>
                            {tCommon('gotIt')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
