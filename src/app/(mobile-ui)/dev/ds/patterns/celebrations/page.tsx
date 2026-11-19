'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { shootStarConfetti } from '@/utils/confetti'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { ProductUsage } from '../../_components/ProductUsage'
import { SectionDivider } from '../../_components/SectionDivider'
import { WhenToUse } from '../../_components/WhenToUse'
import { CelebrationStage } from './_components/CelebrationStage'
import { CoinFlip } from './_components/CoinFlip'
import { CoinStack } from './_components/CoinStack'
import { ReceiptCardFan } from './_components/ReceiptCardFan'

const STANDARD = [
    ['Stars', '40, the brand star (star.svg), two sizes: 50 and 36 px tall'],
    ['Movement', 'Fly out in every direction and fade. No tumble: the star never squashes or mirrors'],
    ['Length', 'About 1.5 s'],
    ['Start point', 'Screen centre, 40% down. Only a points row moves it, to itself'],
    ['Web and native app', 'The same burst'],
    ['Reduced motion', '8 small stars, slow, staying near the start point. Never nothing'],
    ['Repeat', 'A second burst within 1.5 s is dropped'],
] as const

export default function CelebrationsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Celebrations"
                description="One confetti for every success moment, and three more celebrations that are approved but not built into any screen."
                status="production"
            />

            <WhenToUse
                use={[
                    'Star confetti once, when a success screen opens: money moved, an account or card opened, a reward claimed, sign-up finished.',
                    'Pair it with notifyHaptic("success") when the user caused the moment with a tap or a hold.',
                ]}
                dontUse={[
                    'A second confetti with its own count, size, colours or start height. → there is one burst; call shootStarConfetti() with no options.',
                    'A routine confirmation such as saved settings or a copied link. → use a toast.',
                    'Skipping the burst under reduced motion. → the burst already tones itself down.',
                    'A new celebration made of shapes drawn in code. → use one of the permitted celebrations below, built from approved art.',
                ]}
            />

            <DocSection title="Star confetti (the standard)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        The only confetti in the app. Every success moment fires the same burst.
                    </p>
                    <Button variant="primary" onClick={() => shootStarConfetti()}>
                        Fire star confetti
                    </Button>
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        {STANDARD.map(([label, value]) => (
                            <DataRow key={label} label={label} value={value} />
                        ))}
                    </Card>
                    <DesignNote type="info">
                        The star is drawn once from the brand file and stamped 40 times, so a burst costs an old phone
                        about what the previous plain stars did. Keep the count at or under 60.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Success screen"
                        code={`import { shootStarConfetti } from '@/utils/confetti'

useEffect(() => {
    shootStarConfetti()
}, [])`}
                    />
                    <CodeBlock
                        label="From a points row"
                        code={`import { usePointsConfetti } from '@/hooks/usePointsConfetti'

usePointsConfetti(pointsEarned, pointsRowRef)`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Permitted, not in use"
                description="Approved as celebrations. None of them is built into an app screen; the demos below live only on this page. Putting one on a screen is a design decision to take first."
            >
                <DesignNote type="warning">
                    Do not import these demos into the app. They are sized for this page and show placeholder amounts.
                </DesignNote>
                <CelebrationStage
                    name="Receipt card fan"
                    idea="The receipt card presses once, three palette cards deal out from behind it and tuck back, and a yellow Sent chip stays on its corner. Art: sitting mascot, star."
                    reducedIdea="no cards; the chip just appears."
                    height={310}
                >
                    {(reduced) => <ReceiptCardFan reduced={reduced} />}
                </CelebrationStage>
                <CelebrationStage
                    name="Coins land, get stacked"
                    idea="Eight coin faces hop out of the pay card, land in a row on its top edge, then snap into the glove holding a coin stack, which stamps and leaves. Art: dollar and euro coin faces, stack-coin glove."
                    reducedIdea="only the glove stamps and leaves."
                    height={240}
                >
                    {(reduced) => <CoinStack reduced={reduced} />}
                </CelebrationStage>
                <CelebrationStage
                    name="One coin flip"
                    idea="A dollar coin pops next to the amount, flips to the euro coin and back, drops into the points row, bounces once and leaves. Art: dollar and euro coin faces, sparkle."
                    reducedIdea="a small coin appears in the points row and leaves."
                    height={230}
                >
                    {(reduced) => <CoinFlip reduced={reduced} />}
                </CelebrationStage>
            </DocSection>

            <ProductUsage>
                <ProductUsage.Example
                    title="Request link created"
                    path="src/components/Request/link/views/RequestCreatedView.tsx"
                    description="The standard burst, fired once when the success screen opens."
                    code={`shootStarConfetti()`}
                >
                    <Button variant="secondary" size="small" className="w-auto" onClick={() => shootStarConfetti()}>
                        Fire
                    </Button>
                </ProductUsage.Example>
                <ProductUsage.Example
                    title="Points earned on a payment"
                    path="src/hooks/usePointsConfetti.ts"
                    description="The same burst, started from the points row."
                    code={`shootStarConfetti({ origin: { x, y } })`}
                >
                    <Button
                        variant="secondary"
                        size="small"
                        className="w-auto"
                        onClick={() => shootStarConfetti({ origin: { x: 0.5, y: 0.8 } })}
                    >
                        Fire from lower down
                    </Button>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
