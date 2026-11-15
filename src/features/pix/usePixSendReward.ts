'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pixApi } from '@/services/pix'
import { pixPaidPerk, type PaidReward } from '@/features/payments/flows/qr-pay/paidReward'

/** The reward is issued on completion, so a paid read may name none yet: it is read once more after this. */
const REWARD_REREAD_MS = 4_000

/**
 * The QR reward of a paid send to another person's Pix key (API-CONTRACT-M5, ruling of 15 Nov), from
 * `GET /pix/withdraw/:intentId`: the reward Manteca's key send earned, with the QR payment's rules
 * (`pixPaidPerk`: only a paid send carries one; a paid-out reward reads as claimed; a send marked as
 * one to the user's own account carries none). A payout to the user's own key has none. `markClaimed` is the hold's reveal on this screen.
 */
export function usePixSendReward(intentId: string | null, enabled: boolean) {
    const read = useQuery({
        queryKey: ['pix-withdraw', intentId],
        queryFn: () => pixApi.readWithdrawal(intentId!),
        enabled: enabled && !!intentId,
        staleTime: Infinity,
    })
    const [claimed, setClaimed] = useState(false)

    const rereadForReward = useRef<string | null>(null)
    const { refetch } = read
    const paidWithoutReward = read.data?.state === 'paid' && read.data.perk === null
    useEffect(() => {
        if (!paidWithoutReward || !intentId || rereadForReward.current === intentId) return
        const timer = setTimeout(() => {
            rereadForReward.current = intentId
            void refetch()
        }, REWARD_REREAD_MS)
        return () => clearTimeout(timer)
    }, [paidWithoutReward, intentId, refetch])

    const sent = read.data
    const perk = sent && !sent.ownAccount ? pixPaidPerk(sent) : null
    const reward: PaidReward | null =
        sent && intentId
            ? {
                  paymentId: intentId,
                  merchantName: sent.holderName ?? undefined,
                  perk: perk && claimed ? { ...perk, claimed: true } : perk,
              }
            : null
    const markClaimed = useCallback(() => setClaimed(true), [])
    /** The send was to the user's own account by name: it earns no points. Null until the read answers. */
    const selfPay = sent ? sent.selfPay === true : null
    return { reward, markClaimed, selfPay }
}
