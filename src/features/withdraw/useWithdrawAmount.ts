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
