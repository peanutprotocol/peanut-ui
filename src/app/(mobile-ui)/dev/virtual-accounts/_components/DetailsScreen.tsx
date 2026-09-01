'use client'

import NavHeader from '@/components/Global/NavHeader'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { DepositDetailsCard } from './DepositDetailsCard'
import { DetailsSkeleton } from './DetailsSkeleton'
import { MemoSlot } from './MemoSlot'
import { mockDepositAccount } from './mock'
import { instructionRows } from './rows.utils'
import type { VaRail, VaState } from './types'

/**
 * Screen 2 — the user's own view of one currency's details.
 *
 * Block order is the priority order: the memo first (the one thing a missed
 * copy turns into a lost deposit), then why the holder name is not the user,
 * then the bank details, then arrival expectations, then the "waiting?"
 * helper. The memo fork (`sku`) deletes the memo slot, the holder notice and
 * the helper; the holder row becomes the user's name. Nothing else moves.
 */
export function DetailsScreen({
    rail,
    state,
    sku,
    onBack,
    onShare,
    onRetry,
}: {
    rail: VaRail
    state: Exclude<VaState, 'kyc'>
    sku: boolean
    onBack: () => void
    onShare: () => void
    onRetry: () => void
}) {
    // the screen reads `matching`, never the provider or the SKU (plan §5 rule 2)
    const account = mockDepositAccount(rail, sku)
    const memo = account.matching.memo === 'required' ? account.instructions.memo : null
    const pooled = account.matching.nameOnAccount === 'provider'
    const rows = instructionRows(account.instructions, rail)

    if (state === 'failed') {
        // flow-blocking failure = an error step in the flow (design.md error
        // table); anatomy is the modal-flow / nested-confirm one: icon bubble,
        // title block, purple primary + transparent secondary, stacked.
        return (
            <PageStack>
                <NavHeader title="Get paid" onPrev={onBack} />
                <PageStack.Center>
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble icon="error" color="red" />
                        <TitleBlock
                            align="center"
                            size="s"
                            title={`We could not set up ${rail.code} details`}
                            description="Nothing was charged. Try again in a moment, or choose another currency."
                        />
                        <Button variant="purple" className="w-full" onClick={onRetry}>
                            Try again
                        </Button>
                        <Button variant="transparent" className="w-full" onClick={onBack}>
                            Choose another currency
                        </Button>
                    </div>
                </PageStack.Center>
            </PageStack>
        )
    }

    if (state === 'unavailable') {
        return (
            <PageStack>
                <NavHeader title="Get paid" onPrev={onBack} />
                <PageStack.Center>
                    <EmptyState
                        icon="globe-lock"
                        title={`${rail.code} details are not available in your region yet`}
                        description="We check this before showing details, so no payment can go missing."
                        cta={
                            <Button variant="stroke" size="small" className="mt-4" onClick={onBack}>
                                Choose another currency
                            </Button>
                        }
                    />
                </PageStack.Center>
            </PageStack>
        )
    }

    const pending = state === 'pending'

    return (
        <PageStack>
            <NavHeader title="Get paid" onPrev={onBack} />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title={`${rail.code} · ${rail.railName}`}
                    description={
                        pending
                            ? `Setting up ${rail.code} details. Usually under a minute.`
                            : memo
                              ? 'Anyone can pay any amount into these details, as long as the reference travels with the payment.'
                              : 'Anyone can pay any amount into these details. Micro-deposit verification works.'
                    }
                />
                {state === 'returned' && (
                    <Notification
                        priority="error"
                        title="A payment was returned"
                        ctas={[{ label: 'Share details again', onClick: onShare }]}
                    >
                        {rail.returnedExample.amount} from {rail.returnedExample.payer} on {rail.returnedExample.date}{' '}
                        went back to the sender because the amount did not match. Ask them to send it again
                        {memo ? ' with the reference.' : '.'}
                    </Notification>
                )}
                {pending ? (
                    <DetailsSkeleton rows={rows.length} withMemo={!!memo} />
                ) : (
                    <>
                        <MemoSlot memo={memo} />
                        {pooled && <Notification priority="info">{rail.pooledHolderNotice}</Notification>}
                        <Section title="Bank details">
                            <DepositDetailsCard rows={rows} />
                        </Section>
                        <p className="text-body-xs text-foreground-secondary">{rail.eta}</p>
                        {memo && (
                            <div className="flex flex-col gap-2">
                                <Notification priority="helper" title="Waiting for a payment?">
                                    Check that the payer used the reference {memo}. Without it, the money goes back to
                                    them within 10 business days.
                                </Notification>
                                <LinkButton href="/support">Contact support</LinkButton>
                            </div>
                        )}
                    </>
                )}
            </div>
            <PageStack.Footer>
                <Button variant="purple" className="w-full" icon="share" disabled={pending} onClick={onShare}>
                    Share details
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
