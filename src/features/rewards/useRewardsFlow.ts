'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useCountUp } from '@/hooks/useCountUp'
import { invitesApi } from '@/services/invites'
import { pointsApi } from '@/services/points'
import { useQuery } from '@tanstack/react-query'
import { useInView } from 'framer-motion'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'

/**
 * flow hook for the rewards page — owns the queries, animation state and
 * page-view side effects so the page stays dumb (same model as
 * features/home/useHomeFlow).
 */
export function useRewardsFlow() {
    const { user, fetchUser } = useAuth()
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const inviteesRef = useRef(null)
    const inviteesInView = useInView(inviteesRef, { once: true, margin: '-50px' })

    const {
        data: invites,
        isPending: isInvitesPending,
        isError: isInvitesError,
        error: invitesError,
    } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    const {
        data: tierInfo,
        isPending: isTierInfoPending,
        isError: isTierInfoError,
        error: tierInfoError,
    } = useQuery({
        queryKey: ['tierInfo', user?.user.userId],
        queryFn: () => pointsApi.getTierInfo(),
        enabled: !!user?.user.userId,
    })

    // Referral graph is now available for all users
    const { data: myGraphResult } = useQuery({
        queryKey: ['myInviteGraph', user?.user.userId],
        queryFn: () => pointsApi.getUserInvitesGraph(),
        enabled: !!user?.user.userId,
    })

    // Cash status (comprehensive earnings tracking)
    const { data: cashStatus } = useQuery({
        queryKey: ['cashStatus', user?.user.userId],
        queryFn: () => pointsApi.getCashStatus(),
        enabled: !!user?.user.userId,
    })

    const username = user?.user.username

    // animated hero points — remembers last-seen value across visits
    const animatedTotal = useCountUp(tierInfo?.data?.totalPoints ?? 0, {
        storageKey: 'hero_total',
        duration: 1.8,
        enabled: !!tierInfo?.data,
    })

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.POINTS_PAGE_VIEWED)
    }, [])

    useEffect(() => {
        // re-fetch user to get the latest invitees list for showing heart icon
        fetchUser()
    }, [])

    return {
        user,
        username,
        isInviteModalOpen,
        setIsInviteModalOpen,
        inviteesRef,
        inviteesInView,
        invites,
        isInvitesPending,
        isInvitesError,
        invitesError,
        tierInfo,
        isTierInfoPending,
        isTierInfoError,
        tierInfoError,
        myGraphResult,
        cashStatus,
        animatedTotal,
    }
}
