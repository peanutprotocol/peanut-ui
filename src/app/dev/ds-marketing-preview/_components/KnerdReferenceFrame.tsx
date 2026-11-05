'use client'

import { useEffect, useRef, useState } from 'react'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { useFitToWidth } from '@/hooks/useFitToWidth'
import { VIEWPORT_WIDTHS, type PreviewViewport } from './viewport'

const examples = [
    { value: 'card', label: 'Peanut Card — IN PINK' },
    { value: 'accounts', label: 'Accounts — US and EUROPE' },
    { value: 'argentina', label: 'Argentina — NO PROBLEM' },
    { value: 'brazil', label: 'Brazil — NO PROBLEM' },
    { value: 'links', label: 'Request links — SEND THIS.' },
    { value: 'custody', label: 'Self-custody — ONLY YOU' },
]

/** Keep a real iframe viewport, as in ViewportFrame, so the approved fitting and pointer math are unchanged. */
export function KnerdReferenceFrame() {
    const [viewport, setViewport] = useState<PreviewViewport>('phone')
    const [page, setPage] = useState('card')
    const [paused, setPaused] = useState(false)
    const [status, setStatus] = useState('Loading fonts…')
    const frame = useRef<HTMLIFrameElement>(null)
    const visible = useRef(true)
    const width = VIEWPORT_WIDTHS[viewport]
    const height = 700
    const { hostRef, scale } = useFitToWidth(width)

    const send = (type: string, value?: boolean) => {
        frame.current?.contentWindow?.postMessage({ type, value }, location.origin)
    }

    useEffect(() => {
        const onStatus = (event: MessageEvent) => {
            if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return
            if (event.data?.type !== 'hero-status') return
            setPaused(event.data.paused)
            setStatus(
                event.data.error ||
                    (event.data.reduced
                        ? 'Reduced motion: still headline.'
                        : event.data.paused
                          ? 'Paused.'
                          : event.data.entering
                            ? 'Spring entrance…'
                            : 'Move over the letters, tap, or press Enter.')
            )
        }
        window.addEventListener('message', onStatus)
        const observer = new IntersectionObserver(([entry]) => {
            visible.current = entry.isIntersecting
            send('visible', visible.current)
        })
        if (frame.current) observer.observe(frame.current)
        return () => {
            observer.disconnect()
            window.removeEventListener('message', onStatus)
        }
    }, [])

    return (
        <div className="space-y-4">
            <BaseSelect
                aria-label="Hero example"
                options={examples}
                value={page}
                onValueChange={(value) => {
                    setPage(value)
                    setStatus('Loading fonts…')
                }}
            />
            <Tabs
                aria-label="Knerd hero viewport"
                value={viewport}
                onValueChange={(value) => setViewport(value as PreviewViewport)}
                tabs={[
                    { value: 'phone', label: 'Phone 390' },
                    { value: 'desktop', label: 'Desktop 1440' },
                ]}
            />
            <div
                ref={hostRef}
                className="flex justify-center overflow-hidden rounded-sm border-2 border-border-default bg-background-page"
            >
                <div style={{ width: width * scale, height: height * scale }}>
                    <iframe
                        ref={frame}
                        src={`/dev/knerd/hero.html?page=${page}`}
                        title="Follow the pull — live Knerd hero"
                        className="border-0"
                        onLoad={() => send('visible', visible.current)}
                        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                    />
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button size="small" variant="secondary" className="w-fit" onClick={() => send('replay')}>
                    Replay entrance
                </Button>
                <Button size="small" variant="secondary" className="w-fit" onClick={() => send('demo')}>
                    Try magnet
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    className="w-fit"
                    aria-pressed={paused}
                    onClick={() => send('pause', !paused)}
                >
                    {paused ? 'Resume' : 'Pause'}
                </Button>
            </div>
            <p className="text-body-s text-foreground-secondary" role="status">
                {status}
            </p>
            <p className="text-body-xs text-foreground-secondary">
                Approved motion reference. The CTA is shown for composition. The preview scales to fit this column; the
                viewport toggle uses real 390px and 1440px widths.
            </p>
        </div>
    )
}
