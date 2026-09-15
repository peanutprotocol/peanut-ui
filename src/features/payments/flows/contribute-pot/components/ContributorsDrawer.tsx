'use client'

/**
 * drawer component to show all contributors for a request pot
 *
 * displays a scrollable list of people who have contributed with:
 * - their username or address
 * - amount contributed
 *
 * hidden when there are no contributors yet
 */

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/Global/Drawer'
import ContributorCard, { type Contributor } from '@/components/Global/Contributors/ContributorCard'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { type PotContributor } from '../ContributePotFlowContext'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

interface ContributorsDrawerProps {
    contributors: PotContributor[]
}

export function ContributorsDrawer({ contributors }: ContributorsDrawerProps) {
    const t = useTranslations('payment')
    // map to ContributorCard format
    const contributorCards = useMemo<Contributor[]>(() => {
        return contributors.map((c) => ({
            uuid: c.uuid,
            payments: [],
            amount: c.amount,
            username: c.username || c.address,
            fulfillmentPayment: null,
            isUserVerified: false,
            isPeanutUser: !!c.username,
            avatarKey: c.avatarKey ?? null,
        }))
    }, [contributors])

    if (contributors.length === 0) {
        return null
    }

    return (
        <Drawer>
            <DrawerTrigger asChild>
                <LinkButton className="self-start">{t('contributors.seeAll')}</LinkButton>
            </DrawerTrigger>
            <DrawerContent className="py-6">
                <DrawerHeader>
                    <DrawerTitle className="text-start">
                        {t('contributors.title', { count: contributors.length })}
                    </DrawerTitle>
                </DrawerHeader>
                <div className="max-h-[60vh] overflow-auto">
                    {contributorCards.map((contributor, index) => (
                        <ContributorCard
                            key={contributor.uuid}
                            position={getCardPosition(index, contributorCards.length)}
                            contributor={contributor}
                        />
                    ))}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
