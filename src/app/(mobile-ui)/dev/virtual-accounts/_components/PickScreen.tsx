'use client'

import NavHeader from '@/components/Global/NavHeader'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Flag } from './Flag'
import { COMING_SOON, RAILS, RAIL_ORDER } from './mock'
import type { VaCurrency } from './types'

/**
 * Screen 1 — currency and rail. Eligibility is checked before any details
 * exist (competitor-deposit-ux #18: never after a deposit). The KYC gate is a
 * Notification with a CTA above the list; rows stay visible but disabled with
 * the reason in the body (AddMoneyMethodSelection `methods.kycRequired`).
 */
export function PickScreen({
    kycGate,
    onPick,
    onVerify,
}: {
    kycGate: boolean
    onPick: (currency: VaCurrency) => void
    onVerify: () => void
}) {
    return (
        <PageStack>
            <NavHeader title="Get paid" hideBackBtn />
            <div className="flex flex-col gap-6">
                <TitleBlock
                    size="s"
                    title="Get paid in your local currency"
                    description="Share bank details with an employer, a client or a platform. The money arrives in your Peanut balance as USD."
                />
                {kycGate && (
                    <Notification
                        priority="attention"
                        title="Verify your identity first"
                        ctas={[{ label: 'Verify identity', onClick: onVerify }]}
                    >
                        Takes about 3 minutes. You do it once, for every currency.
                    </Notification>
                )}
                <Section title="Choose a currency">
                    <ListGroup>
                        {RAIL_ORDER.map((currency) => {
                            const rail = RAILS[currency]
                            return (
                                <ListItem
                                    key={currency}
                                    leading={<Flag iso2={rail.flagIso2} />}
                                    title={`${rail.code} · ${rail.railName}`}
                                    body={kycGate ? 'Verify your identity to get details' : rail.pickerBody}
                                    chevron
                                    disabled={kycGate}
                                    onClick={() => onPick(currency)}
                                    data-testid={`va-pick-${currency}`}
                                />
                            )
                        })}
                        {COMING_SOON.map((item) => (
                            <ListItem
                                key={item.code}
                                leading={<Flag iso2={item.flagIso2} />}
                                title={`${item.code} · ${item.railName}`}
                                body="Own transfers: Add money"
                                trailing={<StatusBadge status="soon" />}
                                disabled
                            />
                        ))}
                    </ListGroup>
                </Section>
            </div>
        </PageStack>
    )
}
