'use client'

import { useState } from 'react'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { useFitToWidth } from '@/hooks/useFitToWidth'
import { PREVIEW_BASE_PATH, VIEWPORT_WIDTHS, type PreviewViewport } from './viewport'

interface ViewportFrameProps {
    /** route dir under /dev/ds-marketing-preview — the bare page the iframe loads */
    demo: string
    /** what the frame shows — the iframe title and the toggle's aria-label */
    label: string
    /** frame height per viewport; taller content scrolls inside the frame */
    heights: Record<PreviewViewport, number>
}

/**
 * Doc-site demo frame for /dev/ds/marketing: the demo renders in an iframe at
 * a REAL viewport width (390 or 1440) and scales down to the doc column, so
 * the md: breakpoints inside the demo answer to the toggled width, not to the
 * doc page's own viewport. The same trick as /dev/devices, one pane instead of
 * six. It lives next to the preview routes, outside /dev/ds, because the
 * scale transform needs a computed inline style.
 */
export function ViewportFrame({ demo, label, heights }: ViewportFrameProps) {
    const [viewport, setViewport] = useState<PreviewViewport>('phone')
    const width = VIEWPORT_WIDTHS[viewport]
    const height = heights[viewport]
    const { hostRef, scale } = useFitToWidth(width)

    return (
        <div className="space-y-2">
            <Tabs
                aria-label={`${label} viewport`}
                value={viewport}
                onValueChange={(v) => setViewport(v as PreviewViewport)}
                tabs={[
                    { value: 'phone', label: 'Phone 390' },
                    { value: 'desktop', label: 'Desktop 1440' },
                ]}
            />
            <div ref={hostRef} className="overflow-hidden rounded-sm border-2 border-border-default">
                {/* scale is 0 until the host is measured — the wrapper collapses, nothing flashes */}
                <div style={{ height: height * scale }}>
                    <iframe
                        src={`${PREVIEW_BASE_PATH}/${demo}`}
                        title={label}
                        loading="lazy"
                        className="border-0"
                        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                    />
                </div>
            </div>
        </div>
    )
}
