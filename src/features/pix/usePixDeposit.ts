'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { pixApi, type PixDeposit } from '@/services/pix'
import { API_ERROR_CODES, ApiError, wireErrorCode } from '@/services/api-error'
import { pixDepositPhase, pixStandingRefusal, type PixDepositPhase } from '@/features/pix/pixFlow.utils'
import { PIX_STANDING_CODE_QUERY_KEY, pixDepositQueryKey } from '@/features/pix/pixDepositCode'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'

const POLLING_INTERVAL_MS = 5000
const SETTLED_PHASES: PixDepositPhase[] = ['completed', 'returned', 'expired']
/** Another claim of the account is still running: it ends in a moment, so ask again a few times. */
const CLAIM_IN_FLIGHT_RETRIES = 3
const CLAIM_IN_FLIGHT_RETRY_MS = 2000

/**
 * One Pix deposit from GET /pix/deposit/:intentId: its code while it can be
 * paid, and its phase. A reload, back navigation and a deep link read the same
 * query, which POST /pix/deposit seeds. Polls until the deposit settles, and
 * fires `onComplete` once per deposit when it completes: a screen that stays
 * mounted while the URL moves to another deposit reports that one too. A 404 (no such deposit for this
 * user) stops the polling: waiting will not change it. Read-only: the
 * provider's events and the API's poller move the deposit.
 *
 * `intentId` null is the user's standing code (`route.standingCode`, ruling D7): POST /pix/deposit
 * with no amount, which answers the same code on every call and opens the account behind it on the
 * first. Nothing about the code changes, so it is not polled; each Pix it receives is a deposit of
 * its own in Activity. A refusal comes back as `refusal`, with `retry` to ask again.
 */
export function usePixDeposit(intentId: string | null, onComplete: () => void) {
    const completedFor = useRef<string | undefined>(undefined)
    const queryClient = useQueryClient()
    const options: UseQueryOptions<PixDeposit> =
        intentId === null
            ? {
                  queryKey: PIX_STANDING_CODE_QUERY_KEY,
                  queryFn: async () => {
                      const code = await pixApi.createDeposit()
                      // the first call opens the account: the account lists and their counter read it again
                      void queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY })
                      return code
                  },
                  staleTime: Infinity,
                  retry: (failures, error) =>
                      wireErrorCode(error) === API_ERROR_CODES.DEPOSIT_ACCOUNT_CLAIM_IN_FLIGHT &&
                      failures < CLAIM_IN_FLIGHT_RETRIES,
                  retryDelay: CLAIM_IN_FLIGHT_RETRY_MS,
              }
            : {
                  queryKey: pixDepositQueryKey(intentId),
                  queryFn: () => pixApi.readDeposit(intentId),
                  // the code POST /pix/deposit seeded is fresh: the first read waits for the next poll
                  staleTime: POLLING_INTERVAL_MS,
                  refetchInterval: (current) => {
                      const { error, data } = current.state
                      if (error instanceof ApiError && error.status === 404) return false
                      return SETTLED_PHASES.includes(pixDepositPhase(data)) ? false : POLLING_INTERVAL_MS
                  },
              }
    const query = useQuery(options)
    const phase = useMemo(() => pixDepositPhase(query.data), [query.data])

    useEffect(() => {
        // the query is keyed by the deposit, so a completed phase is this deposit's
        if (intentId !== null && phase === 'completed' && completedFor.current !== intentId) {
            completedFor.current = intentId
            onComplete()
        }
    }, [phase, intentId, onComplete])

    return {
        deposit: query.data,
        phase,
        isError: query.isError,
        refusal: intentId === null && query.isError ? pixStandingRefusal(query.error) : undefined,
        retry: () => void query.refetch(),
        isRetrying: query.isFetching,
    }
}
