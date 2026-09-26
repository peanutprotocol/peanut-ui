'use client'

import { parseAsString, useQueryState } from 'nuqs'

/**
 * The one amount the user typed for this withdrawal, in USD, carried in the
 * URL (`?amount=50`) across every /withdraw/* route so downstream screens
 * honor it instead of re-collecting it (TASK-21664 / TASK-21665). Empty string
 * means "not entered yet".
 */
export function useWithdrawAmount() {
    return useQueryState('amount', parseAsString.withDefault(''))
}

/**
 * The bank amount the user typed, in the destination currency
 * (`?destinationAmount=2000`, TASK-23054). Set instead of `amount` when the
 * account is paid in EUR, GBP, MXN or COP; the review step quotes the USDC for it.
 */
export function useWithdrawDestinationAmount() {
    return useQueryState('destinationAmount', parseAsString.withDefault(''))
}
