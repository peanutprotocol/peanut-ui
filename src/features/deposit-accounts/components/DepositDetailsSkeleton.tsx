'use client'

import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

// interim placeholder tint: no skeleton surface token exists yet (design.md
// open conflict). never bg-border-default — that is a near-black border color.
const pulse = 'animate-pulse rounded bg-foreground-primary/10'

/**
 * The provisioning state renders the loaded layout, block for block, so
 * nothing jumps when the details arrive.
 *
 * Only what is genuinely unknown is grey. The section heading is real text —
 * a card of grey bars under the word "Bank details" reads as an account being
 * set up, and the same card under a grey bar reads as a page that failed.
 * The rules below it stay a placeholder: they are stated per account, and a
 * sentence invented while the account does not exist is the one thing this
 * screen must not do.
 */
export function DepositDetailsSkeleton({ rows }: { rows: number }) {
    const { t } = useDepositAccountCopy()

    return (
        <>
            <Section title={t('details.sectionTitle')} data-testid="deposit-details-skeleton">
                <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    {Array.from({ length: rows }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between gap-3 py-3">
                            <div className={`h-4 w-24 ${pulse}`} />
                            <div className={`h-4 w-36 ${pulse}`} />
                        </div>
                    ))}
                </Card>
            </Section>
            <div className={`h-4 w-52 ${pulse}`} />
        </>
    )
}
