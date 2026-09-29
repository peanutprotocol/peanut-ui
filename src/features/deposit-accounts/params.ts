import { parseAsStringEnum } from 'nuqs'
import { DEPOSIT_RAIL_ORDER } from './rails'

export const DEPOSIT_ACCOUNT_SCREENS = ['list', 'claim', 'details'] as const
export type DepositAccountScreen = (typeof DEPOSIT_ACCOUNT_SCREENS)[number]

/**
 * The corridors a URL may name — the rail catalogue itself, so a corridor
 * added to `DEPOSIT_RAILS` is linkable without a second list to update. It was
 * a second list, and the two were already free to drift.
 */
export const DEPOSIT_CORRIDORS = DEPOSIT_RAIL_ORDER

/**
 * Step and corridor live in the URL, so a link opens the flow where the user
 * left it and a support conversation can point at one exact screen. `step` is
 * the name every other flow in the app uses for its cursor (add money, claim,
 * the Manteca withdraw); this flow shipped as `screen` and was renamed, with
 * old links rewritten in DepositAccountsFlow.
 *
 * nuqs stays on its `replace` default: in-flow back is the NavHeader, and
 * browser back leaves the flow in one step.
 */
export const DEPOSIT_ACCOUNT_PARAMS = {
    step: parseAsStringEnum([...DEPOSIT_ACCOUNT_SCREENS]).withDefault('list'),
    /** the cursor's former name, rewritten to `step` on read — see DepositAccountsFlow */
    screen: parseAsStringEnum([...DEPOSIT_ACCOUNT_SCREENS]),
    corridor: parseAsStringEnum(DEPOSIT_CORRIDORS).withDefault('SEPA_EU'),
}
