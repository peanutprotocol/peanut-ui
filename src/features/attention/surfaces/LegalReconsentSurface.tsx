'use client'

import ReConsentModal from '@/components/Global/ReConsentModal'
import { useAttention } from '../AttentionProvider'
import type { AskSurfaceProps } from '../types'

/** The documents come from the journey state, so the modal has no request of its own. */
export default function LegalReconsentSurface(props: AskSurfaceProps) {
    const { state } = useAttention()
    return <ReConsentModal documents={state.consent.documents} {...props} />
}
