import { BulletList } from '@/components/0_Bruddle/BulletList'
import type { ResolvedRuleLine } from '../useDepositAccountCopy'

/**
 * The rules for one account, as facts the user can read at a glance.
 *
 * `BulletList` is the DS list for "unordered facts, benefits, or conditions"
 * (design.md, list decision table) and its items take a ReactNode, which is
 * what lets the (i) sit at the end of the sentence it explains.
 */
export function DepositRuleList({ lines }: { lines: ResolvedRuleLine[] }) {
    return <BulletList items={lines.map((line) => line.text)} />
}
