'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { SelfCustodySendScreen } from '@/components/Marketing/StarLp/pages/SelfCustodySendScreen'

/**
 * ProductSplitHero align="center", through StarLpHero (the star-LP kit in
 * Marketing/StarLp): the peanut.me hero composition, one centred column on
 * every width. Rendered with the /self-custody hero so the frame shows a real
 * star-LP hero.
 */
export default function ProductSplitHeroCenterPreview() {
    return (
        <main className="bg-background-page">
            <StarLpHero
                title={
                    <>
                        <DisplayLine size="masthead">Your money.</DisplayLine>
                        <KnerdTitle text={'Only\nyou'} size="masthead" oneLineFrom="md" />
                    </>
                }
                titleTail="can send it."
                subtitle="Your balance sits in your own account. Every send needs your passkey."
                art={<SelfCustodySendScreen />}
                cta={
                    <Button size="large" variant="secondary" className={`w-fit ${CTA_MOTION}`}>
                        Get started
                    </Button>
                }
            />
        </main>
    )
}
