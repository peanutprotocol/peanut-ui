'use client'

import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Callout } from '@/components/0_Bruddle/Callout'
import DevPageShell from '../_components/DevPageShell'
import { AddMoneyCountriesDemo } from './AddMoneyCountriesDemo'
import { DepositTermsDemo } from './DepositTermsDemo'
import { ProposalSection } from './ProposalSection'
import { QrLimitsDemo } from './QrLimitsDemo'
import { ReceiptBankDetailsDemo } from './ReceiptBankDetailsDemo'
import { ResidenceSecondCountryDemo } from './ResidenceSecondCountryDemo'
import { WithdrawMultiCountryDemo } from './WithdrawMultiCountryDemo'
import { WithdrawOtherCountriesDemo } from './WithdrawOtherCountriesDemo'

/**
 * /dev/accordion: proposal to put every product collapsible on
 * 0_Bruddle/Accordion. Only this page uses the new props; the real screens
 * are not wired. Marketing accordions (Global/FAQs, MDX FAQ, /shhhhh) are a
 * different design and are out of scope.
 */
export default function AccordionProposalPage() {
    return (
        <DevPageShell
            title="Accordion consolidation"
            description="Every product collapsible on 0_Bruddle/Accordion. Each section shows the dev markup, then the same surface on the extended Accordion."
            width="prose"
        >
            <div className="flex flex-col gap-4">
                <BulletList
                    items={[
                        <span key="gains">
                            <strong>Accordion gains:</strong> Trigger <code>leading</code>/<code>title</code>/
                            <code>body</code> (ListItem row), Content <code>flush</code> and <code>forceMount</code>
                            (closed but mounted), Item <code>position</code> (joins a ListGroup), root{' '}
                            <code>variant=&quot;link&quot;</code>.
                        </span>,
                        <span key="deleted">
                            <strong>Deleted:</strong> 3 hand-rolled disclosure rows (ListItem + chevron-down + useState
                            + aria-expanded), the receipt toggle button, the residence link toggle.
                        </span>,
                        <span key="sites">
                            <strong>Sites:</strong> 7. Two are on Accordion already and render the same; five move over.
                            After migration ListItem&apos;s and Global/Card&apos;s <code>aria-expanded</code> props have
                            no caller.
                        </span>,
                        <span key="unchanged">
                            <strong>Unchanged:</strong> the existing API, the border ruling, disabled/hover/focus
                            states. Marketing FAQs stay separate.
                        </span>,
                        <span key="questions">
                            <strong>Open questions:</strong> 6, listed below and at the section they affect.
                        </span>,
                    ]}
                />
                <Callout priority="info" title="Open questions">
                    <ol className="flex list-decimal flex-col gap-2 pl-4">
                        <li>
                            design.md rules the ListItem disclosure row &quot;not a second accordion&quot;. This
                            proposal reverses that ruling, so design.md changes with it.
                        </li>
                        <li>
                            <code>variant=&quot;link&quot;</code> is a third look (card, row card, link). The
                            alternative is plain bordered items: fine for residence, but on the receipt it puts a
                            bordered card inside the receipt card (sections 6 and 7).
                        </li>
                        <li>
                            The withdraw multi-country path is unreachable on dev: EUR routes by IBAN and every other
                            currency has one country. Delete the branch instead of migrating it? (section 4)
                        </li>
                        <li>
                            Content is <code>overflow-hidden</code> for the height animation, so in flush content a
                            row&apos;s 3px focus ring is cut at the item edge. Fix: <code>overflow-visible</code> once
                            open, at the cost of a 300ms spill while opening. Needs a ruling.
                        </li>
                        <li>
                            Flush content in a bordered item keeps its top rule. The brief said no rule, but it is the
                            only line between the trigger and the first country.
                        </li>
                        <li>
                            <code>forceMount</code> closes instantly (no close animation): radix leaves no element to
                            animate out. Acceptable for country lists?
                        </li>
                    </ol>
                </Callout>
            </div>

            <ProposalSection
                index={1}
                title="Limits and fees, account details"
                change="No change. Already the Accordion (text trigger, padded content); shown to prove the extension leaves it as is."
                source="src/features/deposit-accounts/components/DepositAccountDetailsScreen.tsx"
                before={<DepositTermsDemo />}
                after={<DepositTermsDemo />}
            />

            <ProposalSection
                index={2}
                title="Per-country QR limits"
                change="Optional: the flag moves from inside the text trigger to leading (32px), the name to title. Matches every other flag row; the row grows from 52px to 64px."
                source="src/features/limits/views/BridgeLimitsView.tsx"
                before={<QrLimitsDemo mode="before" />}
                after={<QrLimitsDemo mode="after" />}
            />

            <ProposalSection
                index={3}
                title="Add money, all countries"
                change="The last row of the group becomes an Accordion.Item (leading/title/body); ListGroup gives it position=bottom; the countries open inside it (flush, forceMount) instead of as a separate card below. Tap the row. On the real screen a search opens the list and hides the row; a controlled value keeps that."
                source="src/features/deposit-accounts/components/DepositAccountsListScreen.tsx + AccountsHubList.tsx"
                before={<AddMoneyCountriesDemo mode="before" />}
                after={<AddMoneyCountriesDemo mode="after" />}
            />

            <ProposalSection
                index={4}
                title="Withdraw, multi-country currency"
                change="The currency row becomes an Accordion.Item with an explicit position in the currency group; its countries sit in flush content. No live currency reaches this path: EUR is forced into it here (open question 3)."
                source="src/features/withdraw/components/WithdrawCurrencyList.tsx"
                before={<WithdrawMultiCountryDemo mode="before" />}
                after={<WithdrawMultiCountryDemo mode="after" />}
            />

            <ProposalSection
                index={5}
                title="Withdraw, other countries"
                change="The solo toggle row becomes a solo Accordion.Item (leading/title/body); the list is flush content, kept mounted so its scroll survives a close."
                source="src/features/withdraw/components/WithdrawCurrencyList.tsx"
                before={<WithdrawOtherCountriesDemo mode="before" />}
                after={<WithdrawOtherCountriesDemo mode="after" />}
            />

            <ProposalSection
                index={6}
                title="Receipt bank details"
                change='variant="link": the same underlined 44px row, now a real disclosure (aria-expanded, keyboard, chevron-down 16 instead of an inverted chevron-up). Flush content keeps the dashed dividers.'
                source="src/components/TransactionDetails/provider-rows/BridgeDepositInstructions.tsx"
                before={<ReceiptBankDetailsDemo mode="before" />}
                after={<ReceiptBankDetailsDemo mode="after" />}
            />

            <ProposalSection
                index={7}
                title="Residence, second country"
                change='variant="link": the link becomes a full-width row and gains a chevron (it has none today). Closing still clears the second pick, in onValueChange.'
                source="src/components/Setup/Views/Residence.tsx"
                before={<ResidenceSecondCountryDemo mode="before" />}
                after={<ResidenceSecondCountryDemo mode="after" />}
            />
        </DevPageShell>
    )
}
