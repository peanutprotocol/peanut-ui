'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { USER } from '@/constants/query.consts'
import { recordOneShotIntents } from '@/hooks/useOneShotSession'
import type { IUserProfile } from '@/interfaces/interfaces'
import { kycIntentsApi, type KycIntentSet, type KycIntentsSaved } from '@/services/kyc-intents'

/**
 * Stores the ticked set (TASK-23329) and writes the answer where the app
 * reads it: into the cached /users/me, so `identityVerification.kycIntents`
 * (item 3b) holds the stored set in the same render, and into this tab's
 * session cell, which stands in until /users/me reflects the save. The flow
 * hook reads the set when the SDK opens; the setup drawer builds its rows
 * from it.
 */
export function useSaveKycIntents() {
    const queryClient = useQueryClient()
    return useCallback(
        async (set: KycIntentSet): Promise<KycIntentsSaved> => {
            const saved = await kycIntentsApi.set(set)
            recordOneShotIntents(saved.intents, saved.setAt)
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
