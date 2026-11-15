'use client'

import { useTranslations } from 'next-intl'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Card from '@/components/Global/Card'
import { ProviderRow } from '@/components/Provider/ProviderRow'
import { PROVIDERS } from '@/constants/providers.consts'
import type { ProviderId } from '@/types/provider.types'
import { useKycControl } from '@/features/paperwork-verification/analytics'

/**
 * The card on the Bridge terms prompts: the account provider with its (?), and
 * the terms the next screen asks the user to accept, named by the document's
 * own title so a resident sees which entity's terms apply (TASK-23295).
 */
export const BridgeTermsCard = ({ providerId }: { providerId: ProviderId }) => {
    const { track } = useKycControl('tos', 'kyc_legacy')
    const t = useTranslations('provider')
    const provider = PROVIDERS[providerId]

    return (
        <Card position="solo" className="w-full divide-y divide-dashed divide-border-default px-4 py-0 text-left">
            <ProviderRow
                providerId={providerId}
                label="accountProvider"
                prospective
                onDocumentClick={(document) => track(`provider_${document}`, 'tap')}
                onOpenChange={(open) => track('provider_help', open ? 'open' : 'dismiss')}
            />
            {provider.termsUrl && (
                <DataRow
                    label={t('field.terms')}
                    value={
                        <LinkButton href={provider.termsUrl} external icon onClick={() => track('terms', 'tap')}>
                            {provider.termsName ?? t('field.view')}
                        </LinkButton>
                    }
                />
            )}
        </Card>
    )
}
