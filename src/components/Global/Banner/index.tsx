'use client'

import { AttentionBanner, type AttentionBannerProps } from '@/features/attention/AttentionBanner'

export function Banner(props: AttentionBannerProps) {
    return <AttentionBanner {...props} />
}
