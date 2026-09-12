import { BulletList } from '@/components/0_Bruddle/BulletList'
import MoreInfo from '@/components/Global/MoreInfo'

/** a stated rule and the longer explanation behind it */
export interface DepositRuleListItem {
    key: string
    text: string
    why: string
}

/**
 * One stated fact with its reason one tap away — the design.md 393 (i) that
 * opens longer copy, never a tooltip on the fact itself. Exported so the
 * unavailable-corridor empty state (a single fact, not a list) can reuse the
 * same composition instead of inventing its own.
 */
export function RuleWithInfo({ text, why }: { text: string; why: string }) {
    return (
        <span className="inline">
            {text}{' '}
            <span className="inline-flex translate-y-0.5 align-baseline">
                <MoreInfo text={why} />
            </span>
        </span>
    )
}

/**
 * The rules for one account, each with the reason behind it one tap away.
 *
 * One call site, and kept as its own component anyway: it pairs with
 * `RuleWithInfo`, which the same screen also uses on its own for the
 * single-fact empty state. Both belong to the one place that knows how a rule
 * is rendered.
 *
 * `BulletList` is the DS list for "unordered facts, benefits, or conditions"
 * (design.md, list decision table) and its items take a ReactNode, which is
 * what lets the (i) sit at the end of the sentence it explains. Every rule
 * here is a bank's rule rather than ours, and a user who is told "up to
 * $4,000" without being told why reads it as Peanut being stingy — so the
 * explanation ships with the rule instead of living in a help article.
 */
export function DepositRuleList({ lines }: { lines: DepositRuleListItem[] }) {
    return (
        <BulletList
            items={lines.map((line) => (
                <RuleWithInfo key={line.key} text={line.text} why={line.why} />
            ))}
        />
    )
}
