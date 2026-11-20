'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { confettiPresets, shootDoubleStarConfetti } from '@/utils/confetti'
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
    [
        'Look',
        'The brand star (star.svg), flying out in every direction and fading. No tumble: it never squashes or mirrors',
    ],
    ['Default burst', '40 stars in two sizes, 50 and 36 px tall. About 1.5 s'],
    [
        'A screen may tune',
        'How many stars, how big, how wide and from where. Never the shape, the colours or the tumble',
    ],
    ['Native app', 'Half the stars, one size'],
    [
        'Reduced motion',
        'A quarter of the stars (at least 8), small and slow, staying near the start point. Only the card milestone screen still skips the burst, as it did before',
    ],
    ['Repeat', 'A second burst within 1.5 s is dropped'],
    [
        'Old browsers',
        'Where the star cannot be drawn as an image (Safari before 16.4), the same star as a plain yellow outline. Never another shape',
    ],
] as const

// The tunings in use, as each screen calls them.
const TUNINGS = [
    {
        name: 'Default, 40% down',
        where: 'Request created, account opened, card milestone',
        code: 'shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })',
        fire: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } }),
    },
    {
        name: 'Default, centre',
        where: 'Perk claimed after the hold',
        code: 'shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })',
        fire: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } }),
    },
    {
        name: 'Success preset',
        where: 'QR success, sign-up celebration, verification done',
        code: 'confettiPresets.success()',
        fire: () => confettiPresets.success(),
    },
    {
        name: 'Celebration preset',
        where: 'Sign-up confirmed. 30 stars, half spread, from 30% down',
        code: 'confettiPresets.celebration()',
        fire: () => confettiPresets.celebration(),
    },
    {
        name: 'Gentle preset',
        where: 'No screen yet. 10 smaller stars (40 px), slower',
        code: 'confettiPresets.gentle()',
        fire: () => confettiPresets.gentle(),
    },
    {
        name: 'From an element',
        where: 'Points row on a payment receipt',
        code: 'shootDoubleStarConfetti({ origin: { x, y } })',
        fire: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.8 } }),
    },
] as const

export default function CelebrationsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Celebrations"
                description="One confetti look for every success moment, tuned per screen, and three more celebrations that are approved but not built into any screen."
                status="production"
            />

            <WhenToUse
                use={[
                    'Star confetti once, when a success screen opens: money moved, an account or card opened, a reward claimed, sign-up finished.',
                    'Pair it with notifyHaptic("success") when the user caused the moment with a tap or a hold.',
                ]}
                dontUse={[
                    'A confetti with its own shape, colours or tumble. → there is one look; tune only amount, size, spread and start point.',
                    'More than 60 stars or a star above 64 px. → old phones pay for every star on every frame.',
                    'A routine confirmation such as saved settings or a copied link. → use a toast.',
                    'Skipping the burst under reduced motion on a new screen. → the burst already tones itself down. The card milestone screen is the one that still skips it.',
                    'A new celebration made of shapes drawn in code. → use one of the permitted celebrations below, built from approved art.',
                ]}
            />

            <DocSection title="Star confetti (the standard)">
                <DocSection.Content>
                    <p className="text-body-s text-foreground-secondary">
                        The only confetti look in the app. Each screen keeps the amount, size and start point that fit
                        its moment.
                    </p>
                    <Button variant="primary" onClick={() => shootDoubleStarConfetti()}>
                        Fire the default burst
                    </Button>
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        {STANDARD.map(([label, value]) => (
                            <DataRow key={label} label={label} value={value} />
                        ))}
                    </Card>
                    <DesignNote type="info">
                        The star is drawn once per size from the brand file and stamped, so a burst costs an old phone
                        about what the previous plain stars did. Counts are in brand stars: about a fifth of the old
                        plain-star counts.
                    </DesignNote>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Success screen"
                        code={`import { shootDoubleStarConfetti } from '@/utils/confetti'

useEffect(() => {
    shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })
}, [])`}
                    />
                    <CodeBlock
                        label="A tuned single-size burst"
                        code={`shootStarConfetti({ particleCount: 10, scalar: 0.8, startVelocity: 10 })`}
                    />
                    <CodeBlock
                        label="From a points row"
                        code={`import { usePointsConfetti } from '@/hooks/usePointsConfetti'

usePointsConfetti(pointsEarned, pointsRowRef)`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Confetti tester"
                description="Every tuning in use. A second tap within 1.5 s does nothing."
            >
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    {TUNINGS.map((tuning) => (
                        <div key={tuning.name} className="flex items-center justify-between gap-4 py-3">
                            <div className="min-w-0">
                                <p className="text-label-l">{tuning.name}</p>
                                <p className="text-body-s text-foreground-secondary">{tuning.where}</p>
                                <code className="text-body-xs break-all text-foreground-secondary">{tuning.code}</code>
                            </div>
                            <Button variant="secondary" size="small" className="w-auto shrink-0" onClick={tuning.fire}>
                                Fire
                            </Button>
                        </div>
                    ))}
                </Card>
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
                    description="The default burst, fired once when the success screen opens."
                    code={`shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })`}
                >
                    <Button
                        variant="secondary"
                        size="small"
                        className="w-auto"
                        onClick={() => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })}
                    >
                        Fire
                    </Button>
                </ProductUsage.Example>
                <ProductUsage.Example
                    title="Sign-up confirmed"
                    path="src/components/Setup/redesign/FinalConfirm/useFinalConfirm.ts"
                    description="The celebration preset: fewer stars, a half spread, from higher up."
                    code={`confettiPresets.celebration()`}
                >
                    <Button
                        variant="secondary"
                        size="small"
                        className="w-auto"
                        onClick={() => confettiPresets.celebration()}
                    >
                        Fire
                    </Button>
                </ProductUsage.Example>
            </ProductUsage>
        </DocPage>
    )
}
