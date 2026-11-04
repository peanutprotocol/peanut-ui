'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import NavHeader from '@/components/Global/NavHeader'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import SetupTitleBlock from '@/components/Setup/components/SetupTitleBlock'
import OnboardingAnimation from '@/components/Setup/components/OnboardingAnimation'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import type { ReactNode } from 'react'

import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { PILL_THUMB } from '@/components/0_Bruddle/PillSurface'

const noop = () => {}

const CARD = (
    <div className="w-full pb-2" aria-hidden>
        <ScaledPixelatedCardFace last4="????" />
    </div>
)

const ADD_FUNDS = (
    <PageStack.Footer>
        <Button variant="primary" className="w-full">
            Add funds
        </Button>
    </PageStack.Footer>
)

function CardStaysPut() {
    return (
        <PageStack gap="6">
            <NavHeader title="Get a card" hideBackBtn />
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                <p className="text-body-m text-foreground-secondary">
                    Add at least $10 to your balance to unlock the Peanut card.
                </p>
            </div>
            <div className="w-full">
                <ScaledPixelatedCardFace last4="????" />
            </div>
            <p className="text-center text-body-s text-foreground-secondary">
                The card is free. The money stays yours, and you spend it with your card.
            </p>
            {ADD_FUNDS}
        </PageStack>
    )
}

function UnlockMeter() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                {CARD}
                <div className="flex w-full flex-col gap-4">
                    <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                            <span className="text-body-s text-foreground-secondary">Your balance $4.20</span>
                            <span className="text-body-s font-bold text-foreground-primary">$10 unlocks the card</span>
                        </div>
                        <ProgressBar value={42} fillClassName="bg-action-primary" />
                    </div>
                    <p className="text-body-s text-foreground-secondary">
                        The card is free. The money stays yours, and you spend it with your card.
                    </p>
                </div>
            </PageStack.Center>
            {ADD_FUNDS}
        </PageStack>
    )
}

function FactRows() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                {CARD}
                <div className="flex w-full flex-col gap-4">
                    <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                    <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                        <DataRow label="Peanut card" value="Free" />
                        <DataRow label="To unlock it" value="Add at least $10" />
                        <DataRow label="Your money" value="Stays yours to spend" />
                    </Card>
                </div>
            </PageStack.Center>
            {ADD_FUNDS}
        </PageStack>
    )
}

const strong = (text: string) => <span className="font-bold text-foreground-primary">{text}</span>

function HighlightedWords() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                {CARD}
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                    <p className="text-body-m text-foreground-secondary">
                        Add {strong('at least $10')} to your balance to unlock the Peanut card.
                    </p>
                    <p className="text-body-m text-foreground-secondary">
                        The card is {pink('free')}. The money {strong('stays yours')}, and you spend it with your card.
                    </p>
                </div>
            </PageStack.Center>
            {ADD_FUNDS}
        </PageStack>
    )
}

function Sticker() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                <div className="relative w-full pb-2">
                    <ScaledPixelatedCardFace last4="????" />
                    <span
                        className={`${PILL_THUMB} absolute top-[42%] -left-2 -rotate-6 px-4 py-1.5 text-button-m text-foreground-primary shadow-4`}
                    >
                        Free card
                    </span>
                </div>
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                    <p className="text-body-m text-foreground-secondary">
                        Add at least $10 to your balance to unlock it. The money stays yours, and you spend it with
                        your card.
                    </p>
                </div>
            </PageStack.Center>
            {ADD_FUNDS}
        </PageStack>
    )
}

function TodayCheck({ lookingUp = false }: { lookingUp?: boolean }) {
    return (
        <PageStack gap="6">
            <NavHeader title="Get a card" onPrev={noop} />
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-heading-s text-foreground-primary">
                    {lookingUp ? 'Looking you up…' : 'Let’s see if you qualify'}
                </h1>
                <p className="text-body-m text-foreground-secondary">
                    {lookingUp ? 'Checking your badges.' : 'Press and hold the button. We’re looking you up.'}
                </p>
            </div>
            <ScaledPixelatedCardFace last4="????" blurAll />
            {!lookingUp && (
                <PageStack.Footer>
                    <HoldToClaimButton onComplete={noop}>See if you qualify</HoldToClaimButton>
                </PageStack.Footer>
            )}
        </PageStack>
    )
}

function SignupFrame({
    art,
    back = true,
    children,
    footer,
}: {
    art: ReactNode
    back?: boolean
    children: ReactNode
    footer: ReactNode
}) {
    return (
        <div className="relative flex min-h-dvh flex-col bg-white">
            {back && (
                <div className="absolute top-4 z-20 flex w-full px-4">
                    <Button variant="ghost" className={NAV_CIRCLE_BUTTON_CLASSES} aria-label="Go back">
                        <Icon name="chevron-up" size={20} className="-rotate-90" />
                    </Button>
                </div>
            )}
            <div className="setup-hero-height setup-hero-background relative flex w-full shrink-0 items-center justify-center overflow-hidden px-4">
                <div className="absolute inset-x-0 top-14 bottom-1 flex items-center justify-center">{art}</div>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-8 px-6 pt-10 pb-6">
                {children}
                <div className="flex flex-col gap-6">{footer}</div>
            </div>
        </div>
    )
}

function SignupCheck({ lookingUp = false }: { lookingUp?: boolean }) {
    return (
        <SignupFrame
            art={<PeanutMascot pose={lookingUp ? 'thinking' : 'pointing-down'} className="relative h-full max-w-full" />}
            footer={
                <HoldToClaimButton onComplete={noop} loading={lookingUp}>
                    See if you qualify
                </HoldToClaimButton>
            }
        >
            <SetupTitleBlock
                size="m"
                title={lookingUp ? 'Looking you up…' : 'Let’s see if you qualify.'}
                description={lookingUp ? 'Checking your badges.' : 'Press and hold the button. We’re looking you up.'}
            />
        </SignupFrame>
    )
}

const pink = (text: string) => <span className="text-foreground-brand">{text}</span>

function Today() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                <div className="w-full pb-2" aria-hidden>
                    <ScaledPixelatedCardFace last4="????" />
                </div>
                <TitleBlock
                    title={<h1>You’re in! One step left.</h1>}
                    description={
                        <p>
                            Add at least $10 to your balance to unlock the Peanut card. The card is free. The money
                            stays yours, and you spend it with your card.
                        </p>
                    }
                    align="start"
                    size="s"
                />
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full">
                    Add funds
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

function SellScreen() {
    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <div className="setup-hero-height setup-hero-background relative flex w-full shrink-0 items-center justify-center overflow-hidden px-4">
                <div className="absolute inset-x-0 top-14 bottom-1 flex items-center justify-center">
                    <OnboardingAnimation name="card" />
                </div>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-8 px-6 pt-10 pb-6">
                <SetupTitleBlock
                    size="m"
                    descriptionInTitle
                    titleClassName="text-balance"
                    title="You’re in!"
                    description={<>One step left: add $10 to unlock your {pink('free')} card.</>}
                />
                <div className="flex flex-col gap-6">
                    <p className="text-body-s text-foreground-secondary">
                        The money stays yours, and you spend it with your card.
                    </p>
                    <Button variant="primary" className="w-full">
                        Add funds
                    </Button>
                </div>
            </div>
        </div>
    )
}

function Steps() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
            <SetupTitleBlock size="m" title="You’re in! One step left." />
            <ListGroup>
                <ListItem
                    title="You qualify"
                    body="The Peanut card is available to you"
                    leading={<IconBubble icon="check" color="green" size="s" />}
                />
                <ListItem
                    title="Add at least $10"
                    body="It stays in your balance"
                    leading={<IconBubble {...CONCEPT_ICONS.balance} size="s" />}
                />
                <ListItem
                    title="Unlock your free card"
                    body="Spend your money with it"
                    leading={<IconBubble {...CONCEPT_ICONS.card} size="s" />}
                />
            </ListGroup>
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full">
                    Add funds
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

function BigAmount() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                <div className="flex w-full flex-col items-center gap-2 text-center">
                    <h1 className="text-heading-s text-foreground-primary">You’re in! One step left.</h1>
                    <p className="text-heading-big-input text-foreground-primary">$10</p>
                    <p className="text-body-m text-foreground-secondary">to unlock the Peanut card</p>
                </div>
                <Callout priority="success" items={['The card is free', 'The money stays yours to spend with the card']} />
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full">
                    Add $10
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

function CardBullets() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                <div className="w-full pb-2" aria-hidden>
                    <ScaledPixelatedCardFace last4="????" />
                </div>
                <div className="flex w-full flex-col gap-4">
                    <h1 className="text-heading-m leading-[2.75rem] text-foreground-primary">
                        You’re in!
                        <br />
                        One step left.
                    </h1>
                    <BulletList
                        items={[
                            'Add at least $10 to your balance',
                            'The card is free',
                            'The money stays yours, and you spend it with your card',
                        ]}
                    />
                </div>
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full">
                    Add funds
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

function CardCallout() {
    return (
        <PageStack>
            <NavHeader title="Get a card" hideBackBtn />
            <PageStack.Center>
                <div className="w-full pb-2" aria-hidden>
                    <ScaledPixelatedCardFace last4="????" />
                </div>
                <TitleBlock
                    title={<h1>You’re in! One step left.</h1>}
                    description={<p>Add at least $10 to your balance to unlock the Peanut card.</p>}
                    align="start"
                    size="s"
                />
                <Callout priority="info" items={['The card is free', 'The money stays yours to spend with the card']} />
            </PageStack.Center>
            <PageStack.Footer>
                <Button variant="primary" className="w-full">
                    Add funds
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}

const OPTIONS = {
    today: Today,
    a: SellScreen,
    b: Steps,
    c: BigAmount,
    d: CardBullets,
    e: CardCallout,
    f: CardStaysPut,
    g: UnlockMeter,
    h: FactRows,
    i: HighlightedWords,
    j: Sticker,
    'today-check': () => <TodayCheck />,
    'today-looking': () => <TodayCheck lookingUp />,
    'a-check': () => <SignupCheck />,
    'a-looking': () => <SignupCheck lookingUp />,
} as const

function Option() {
    const v = (useSearchParams().get('v') ?? 'today') as keyof typeof OPTIONS
    const Screen = OPTIONS[v] ?? Today
    if (v === 'a' || v.startsWith('a-')) return <Screen />
    return (
        <div className="flex min-h-dvh w-full flex-col bg-background-page pt-safe-top">
            <div className="relative w-full flex-1 bg-background-page pt-4 pb-[calc(6rem_+_var(--safe-bottom))]">
                <div className="mx-auto flex min-h-[calc(100dvh_-_160px_-_var(--safe-top)_-_var(--safe-bottom))] w-full max-w-md items-center justify-center px-4 *:w-full">
                    <Screen />
                </div>
            </div>
        </div>
    )
}

const HIDE_DEV_NOISE = 'nextjs-portal, body > div.fixed.right-4 { display: none !important; }'

export default function CardYoureInOptions() {
    return (
        <Suspense>
            <style>{HIDE_DEV_NOISE}</style>
            <Option />
        </Suspense>
    )
}
