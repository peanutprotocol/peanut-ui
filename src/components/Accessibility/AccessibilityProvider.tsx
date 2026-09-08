'use client'

import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useAccessibility'
import { applyAccessibilityPreferences } from '@/utils/accessibility-preferences'

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
    const reduced = useReducedMotion()
    useEffect(applyAccessibilityPreferences, [])
    return (
        <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={reduced ? { duration: 0 } : undefined}>
            {children}
        </MotionConfig>
    )
}
