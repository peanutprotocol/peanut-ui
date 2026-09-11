'use client'

import Image from 'next/image'
import { PeanutCheering } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { type IconName } from '@/components/Global/Icons/Icon'
import StatusPill from '@/components/Global/StatusPill'
import DevNoteCard from '../_components/DevNoteCard'
import DevPageShell from '../_components/DevPageShell'
import DevSectionLabel from '../_components/DevSectionLabel'

/**
 * /dev/next-steps — TASK-22513: DS-pure proposals for the home
 * getting-started checklist ("next steps for new users").
 *
 * Every variant composes ONLY shipped DS pieces, per their board vocabulary:
 *  - ListItem leading = one element (IconBubble) — board 17312:136171
 *  - ListItem trailing = badge / chevron — same board (StatusPill/StatusBadge
 *    are the badge components)
 *  - ProgressBar = 0_Bruddle/ProgressBar (limits usage bar precedent)
 *  - grouping = Section + ListGroup (the shipped checklist already uses them)
 *
 * What none of the variants do (the Discord-thread violations):
 *  - no grey borders or grey fills on done rows (grey = disabled; done ≠ disabled)
 *  - no invented empty-checkbox marker (not in any board)
 *  - no green/pink row tints (background/surface/* is reserved for the
 *    floating notification until vlad rules)
 *  - no nested cards, no numbered circles
 */

interface Step {
    id: string
    icon: IconName
    title: string
    body: string
    /** body shown once the step is done; omitted = body hidden when done */
    doneBody?: string
}

// copy mirrors home.gettingStarted translations (hardcoded — dev page)
const STEPS: Step[] = [
    {
        id: 'create-account',
        icon: 'user-plus',
        title: 'Create your account',
        body: '',
        doneBody: 'Done. Your money has a username now',
    },
    {
        id: 'add-money',
        icon: 'arrow-down',
        title: 'Add money',
        body: 'Bank transfer or crypto · bank needs a one-time ID check',
    },
    {
        id: 'get-card',
        icon: 'credit-card',
        title: 'Get your Peanut card',
        body: 'Your dollars, in pink, wherever Visa is accepted.',
    },
]

const noop = (id: string) => () => console.log(`[dev/next-steps] tap ${id}`)

type Variant = 'trailing-pill' | 'trailing-badge' | 'leading-flip'

/**
 * One checklist rendering. `doneCount` marks the first N steps done.
 *
 * trailing-pill / trailing-badge: leading stays the step's identity bubble
 * (yellow, so green keeps meaning "done"); status lives in the trailing slot.
 * leading-flip: the leading bubble flips to the green check when done
 * (closest to the shipped component, minus its violations).
 */
const Checklist = ({ variant, doneCount }: { variant: Variant; doneCount: number }) => (
    <ListGroup className="bg-background-default">
        {STEPS.map((step, i) => {
            const done = i < doneCount
            const body = done ? step.doneBody : step.body || undefined
            const leading =
                variant === 'leading-flip' && done ? (
                    <IconBubble icon="check" size="s" color="green" />
                ) : (
                    <IconBubble icon={step.icon} size="s" color="yellow" />
                )
            const trailing =
                done && variant === 'trailing-pill' ? (
                    <StatusPill status="completed" />
                ) : done && variant === 'trailing-badge' ? (
                    <StatusBadge status="completed" />
                ) : undefined
            return (
                <ListItem
                    key={step.id}
                    leading={leading}
                    title={step.title}
                    body={body}
                    bodyWrap
                    trailing={trailing}
                    chevron={!done}
                    onClick={done ? undefined : noop(step.id)}
                />
            )
        })}
    </ListGroup>
)

/** Section title with the step counter — the one element needing a board note if picked. */
const CounterTitle = ({ doneCount }: { doneCount: number }) => (
    <div className="flex w-full items-baseline justify-between">
        <span>Get started</span>
        <span className="text-body-s text-foreground-secondary">
            {doneCount} of {STEPS.length}
        </span>
    </div>
)

const OptionStates = ({ render }: { render: (doneCount: number) => React.ReactNode }) => (
    <div className="flex flex-wrap gap-6">
        {[1, 2].map((doneCount) => (
            <div key={doneCount} className="w-full max-w-96">
                <p className="mb-2 text-body-xs text-foreground-secondary">
                    {doneCount} of {STEPS.length} done
                </p>
                {render(doneCount)}
            </div>
        ))}
    </div>
)

export default function NextStepsProposalsPage() {
    return (
        <DevPageShell
            title="Next steps — DS proposals"
            description="TASK-22513: getting-started checklist variants built only from shipped DS components. Rows keep black borders and the default surface; done is marked by DS status pieces, never by grey or a tint."
        >
            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option A — status in the trailing slot (recommended)</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Leading bubble is the step&apos;s identity and never changes. Done lands in the trailing slot as the
                    StatusPill check — the board&apos;s badge vocabulary. Pending rows keep the chevron.
                </p>
                <OptionStates
                    render={(n) => (
                        <Section title="Get started">
                            <Checklist variant="trailing-pill" doneCount={n} />
                        </Section>
                    )}
                />
            </section>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option B — Option A + progress header</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Same rows, plus ProgressBar under the section title and a step counter in the header. The counter
                    has no board precedent yet — flag for a board note if this wins.
                </p>
                <OptionStates
                    render={(n) => (
                        <Section title={<CounterTitle doneCount={n} />}>
                            <ProgressBar value={(n / STEPS.length) * 100} fillClassName="bg-background-badge-success" />
                            <Checklist variant="trailing-pill" doneCount={n} />
                        </Section>
                    )}
                />
            </section>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option C — done flips the leading bubble</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Closest to what ships today: the leading bubble becomes the green check when done. No row tint, no
                    empty circles, borders stay black.
                </p>
                <OptionStates
                    render={(n) => (
                        <Section title="Get started">
                            <Checklist variant="leading-flip" doneCount={n} />
                        </Section>
                    )}
                />
            </section>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option D — text badge instead of pill</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Option A with the StatusBadge text chip — reads without decoding an icon, costs more row width.
                </p>
                <OptionStates
                    render={(n) => (
                        <Section title="Get started">
                            <Checklist variant="trailing-badge" doneCount={n} />
                        </Section>
                    )}
                />
            </section>

            <DevNoteCard title="The disappearing finish (product gap)">
                The shipped component returns null the moment all three steps are done — the section silently vanishes,
                so finishing setup has no moment and no answer to &quot;what&apos;s next&quot;. The options below give
                the finish a shape. Proposed lifecycle: each completed step fires a toast (Option G) → at 3/3 the list
                renders one last time as the finale (Option F) → the next home visit swaps it for the completion card
                (Option E) until dismissed → gone, with the badge as the permanent trace. Needs BE: a getting-started
                badge award and a dismissal flag — flagged, not built here.
            </DevNoteCard>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option E — completion card with a rewards handoff</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Renders instead of the checklist once everything is done, until dismissed. Success-screen anatomy
                    (cheering mascot + TitleBlock + purple primary, stroke secondary) on a single card. The CTA answers
                    &quot;what&apos;s next&quot; by routing to rewards.
                </p>
                <div className="w-full max-w-96">
                    <Card className="flex flex-col items-center gap-4 bg-background-default p-4 text-center">
                        <Image
                            src={PeanutCheering.src}
                            unoptimized
                            alt="Peanut mascot cheering"
                            width={120}
                            height={120}
                        />
                        <TitleBlock
                            align="center"
                            title="You're all set"
                            description="Account, money, card — done. Now make Peanut pay you back."
                        />
                        <Button variant="purple" className="w-full" onClick={noop('completion-rewards')}>
                            See your rewards
                        </Button>
                        <Button variant="stroke" className="w-full" onClick={noop('completion-dismiss')}>
                            Dismiss
                        </Button>
                    </Card>
                </div>
            </section>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option F — 3/3 finale with a badge award</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    The list renders one last time fully green instead of vanishing, and completion awards a badge — the
                    celebration leaves a permanent trace on /badges instead of disappearing. Badges are the existing
                    reward primitive; no new token, no new component.
                </p>
                <div className="w-full max-w-96">
                    <Section title={<CounterTitle doneCount={3} />}>
                        <ProgressBar value={100} fillClassName="bg-background-badge-success" />
                        <Checklist variant="trailing-pill" doneCount={3} />
                        <Notification
                            priority="success"
                            title="Setup complete"
                            ctas={[{ label: 'View badge', onClick: noop('finale-badge') }]}
                        >
                            You earned the Getting Started badge.
                        </Notification>
                    </Section>
                </div>
            </section>

            <section className="flex flex-col gap-3">
                <DevSectionLabel>Option G — per-step celebration toast</DevSectionLabel>
                <p className="text-body-s text-foreground-secondary">
                    Each completed step fires a success toast (the DS floating notification via useToast), so every step
                    is a moment — not only the last one. Rendered here statically; in the app it floats over the bottom
                    nav with the countdown bar.
                </p>
                <div className="w-full max-w-96">
                    <Notification variant="floating" priority="success" title="Money added">
                        2 of 3 done — your card is next.
                    </Notification>
                </div>
            </section>

            <DevNoteCard title="Why not the Discord options">
                Grey done rows use the disabled grammar on rows that are not disabled. The empty checkbox, the numbered
                circles and the nested cards exist on no board. Light green / light pink row fills need new tokens —
                background/surface/* is reserved for the floating notification until vlad rules. The shipped checklist
                also drifts: it puts StatusPill in the leading slot, invents the empty circle, tints done rows with
                icon-bubble green at 10%, and styles done rows as disabled. Every option above fixes all four with
                existing pieces only.
            </DevNoteCard>
        </DevPageShell>
    )
}
