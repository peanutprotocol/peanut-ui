'use client'

import { useAuth } from '@/context/authContext'
import type { ProviderId } from '@/types/provider.types'
import { pixProviderId } from '@/utils/provider.utils'

/** The signed-in user's `pixProviderId`: the record the Pix screens name, for the user's verified residence. */
export function usePixProviderId(provider: string | null | undefined): ProviderId | null {
    return pixProviderId(provider, useAuth().user?.residence?.verified?.country)
}
