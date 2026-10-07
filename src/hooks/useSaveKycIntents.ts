'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { USER } from '@/constants/query.consts'
import type { IUserProfile } from '@/interfaces/interfaces'
import { kycIntentsApi, type KycIntentSet, type KycIntentsSaved } from '@/services/kyc-intents'

/**
 * Stores the ticked set (TASK-23329) and writes the answer into the cached
 * /users/me, so `identityVerification.kycIntents` (item 3b) holds the stored
 * set in the same render: the flow hook reads it when the SDK opens, and the
 * setup drawer builds its rows from it. The next fetch of /users/me reads the
 * same set back from the API.
 */
export function useSaveKycIntents() {
    const queryClient = useQueryClient()
    return useCallback(
        async (set: KycIntentSet): Promise<KycIntentsSaved> => {
            const saved = await kycIntentsApi.set(set)
            queryClient.setQueryData<IUserProfile | null>([USER], (user) =>
                user?.identityVerification
                    ? {
                          ...user,
                          identityVerification: {
                              ...user.identityVerification,
                              kycIntents: saved.intents,
                              kycIntentsSetAt: saved.setAt,
                          },
                      }
                    : user
            )
            return saved
        },
        [queryClient]
    )
}
