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
import { getCardPosition } from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { type PotContributor } from '../ContributePotFlowContext'
import { useMemo } from 'react'

interface ContributorsDrawerProps {
    contributors: PotContributor[]
}

export function ContributorsDrawer({ contributors }: ContributorsDrawerProps) {
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
        }))
    }, [contributors])

    if (contributors.length === 0) {
        return null
    }

    return (
        <Drawer>
            <DrawerTrigger asChild>
                <Button variant="primary-soft" shadowSize="4" size="medium" className="w-full">
                    See all contributors ({contributors.length})
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle className="text-start">Contributors ({contributors.length})</DrawerTitle>
                </DrawerHeader>
                <div className="max-h-[60vh] space-y-0 overflow-auto px-4 pb-6">
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
