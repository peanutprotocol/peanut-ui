'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Card from '@/components/Global/Card'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { openExternalUrl } from '@/utils/capacitor'

interface ProviderSheetProps {
    providerId: ProviderId
    open: boolean
    onClose: () => void
    /** set when the sheet opens from inside another drawer */
    nested?: boolean
    /** shown before the user accepts the provider's terms: the relationship line speaks of it as ahead */
    prospective?: boolean
}

/**
 * Who the provider is, in legal terms (TASK-23295, Brazil Resolution 520).
 * Rows and their order follow Konrad's disclosure sheet. Only fields present
 * in the registry render, so an unverified fact never shows.
 */
export const ProviderSheet = ({ providerId, open, onClose, nested, prospective }: ProviderSheetProps) => {
    const t = useTranslations('provider')
    const tCommon = useTranslations('common')
    const provider = PROVIDERS[providerId]
    const { brand } = provider
    const isCard = provider.role === 'thirdNational'
    // the brazil sheet also opens from qr pay, where the user pays from their peanut balance,
    // not their bank app, so it shares the argentina wording
    const executionRole = provider.role === 'mantecaBr' ? 'mantecaAr' : provider.role

    const documentLink = (label: string, href: string) => (
        <LinkButton icon onClick={() => void openExternalUrl(href)}>
            {label}
        </LinkButton>
    )
    const rows = [
        provider.legalName && { label: t('field.legalName'), value: provider.legalName },
        provider.registeredOffice && {
            label: t('field.registeredOffice'),
            value: provider.registeredOffice.join(', '),
        },
        provider.registration && { label: t('field.registration'), value: provider.registration },
        provider.taxId && { label: t('field.taxId'), value: provider.taxId },
        provider.regulator && { label: t('field.regulator'), value: provider.regulator },
        { label: t('field.role'), value: t(`role.${provider.role}`) },
        provider.programManager && { label: t('field.programManager'), value: provider.programManager },
        { label: t('field.execution'), value: t(`execution.${executionRole}`, { brand }) },
        { label: t('field.peanutRole'), value: t('peanutRole') },
        provider.termsUrl && { label: t('field.terms'), value: documentLink(t('field.viewTerms'), provider.termsUrl) },
        provider.privacyUrl && {
            label: t('field.privacy'),
            value: documentLink(t('field.viewPrivacy'), provider.privacyUrl),
        },
        provider.support && { label: t('field.support'), value: provider.support },
    ].filter((row) => !!row)

    // only for a provider whose own terms the user accepts; rhino's customer is peanut
    const relationshipKey = !provider.userContract
        ? null
        : isCard
          ? prospective
              ? 'cardRelationshipProspective'
              : 'cardRelationship'
          : prospective
            ? 'relationshipProspective'
            : 'relationship'

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
                        <IconBubble icon="info" color="blue" />
                        <DrawerHeader className="w-full p-0 text-center sm:text-center">
                            <DrawerTitle>{brand}</DrawerTitle>
                            {/* the role row says it; the title alone shows, as on the sheet design */}
                            <DrawerDescription className="sr-only">{t(`role.${provider.role}`)}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <Card position="solo" className="px-4 py-0">
                            {rows.map((row, index) => (
                                <PaymentInfoRow
                                    key={row.label}
                                    label={row.label}
                                    value={row.value}
                                    hideBottomBorder={index === rows.length - 1}
                                />
                            ))}
                        </Card>
                        {relationshipKey && (
                            <p className="text-body-s text-foreground-primary">{t(relationshipKey, { brand })}</p>
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
