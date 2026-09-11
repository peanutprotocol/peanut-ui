import { parseAsStringEnum } from 'nuqs'
import type { DepositCorridor } from './types'

export const DEPOSIT_ACCOUNT_SCREENS = ['list', 'claim', 'details', 'share'] as const
export type DepositAccountScreen = (typeof DEPOSIT_ACCOUNT_SCREENS)[number]

const CORRIDORS: DepositCorridor[] = ['USD_ACH', 'EUR_SEPA', 'GBP_FPS', 'MXN_SPEI', 'BRL_PIX', 'ARS_TRANSFER']

/**
 * Screen and corridor live in the URL, so a link opens the flow where the
 * user left it and a support conversation can point at one exact screen.
 * nuqs stays on its `replace` default: in-flow back is the NavHeader, and
 * browser back leaves the flow in one step.
 */
export const DEPOSIT_ACCOUNT_PARAMS = {
    screen: parseAsStringEnum([...DEPOSIT_ACCOUNT_SCREENS]).withDefault('list'),
    corridor: parseAsStringEnum(CORRIDORS).withDefault('EUR_SEPA'),
}
