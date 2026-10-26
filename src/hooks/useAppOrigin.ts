'use client'

import { BASE_URL } from '@/constants/general.consts'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { appBaseUrl } from '@/utils/url.utils'

const serverOrigin = () => BASE_URL

export function useAppOrigin(): string {
    return useHydrationSnapshot(appBaseUrl, serverOrigin)
}
