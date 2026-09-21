'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ART_BOXES } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { getPlatform, isNativeBridge } from '@/utils/capacitor'
import DevPageShell from '../_components/DevPageShell'

const POSES = Object.keys(MASCOT_ART_BOXES) as MascotPose[]
const PROFILE_DURATION_MS = 10_000

type DeviceReading = {
    platform: string
    nativeBridge: boolean
    webView: string
    hardwareConcurrency: number
    deviceMemory: string
    userAgent: string
}

type ProfileResult = {
    fps: number
    p95FrameMs: number
    worstFrameMs: number
    slowFrames: number
    longTasks: number
    longTaskMs: number
    ready: number
    svg: number
}

function readDevice(): DeviceReading {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const androidWebView = navigator.userAgent.match(/(?:Chrome|CriOS)\/(\d+)/)?.[1]
    const iosWebKit = navigator.userAgent.match(/AppleWebKit\/(\d+(?:\.\d+)?)/)?.[1]
    return {
        platform: getPlatform(),
        nativeBridge: isNativeBridge(),
        webView: androidWebView ? `Chromium ${androidWebView}` : iosWebKit ? `WebKit ${iosWebKit}` : 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: memory ? `${memory} GB` : 'not exposed',
        userAgent: navigator.userAgent,
    }
}

function percentile(values: number[], fraction: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

export default function LottieProfilePage() {
    const stageRef = useRef<HTMLDivElement>(null)
    const [pose, setPose] = useState<MascotPose>('walking')
    const [instances, setInstances] = useState<1 | 3 | 10>(1)
    const [device, setDevice] = useState<DeviceReading | null>(null)
    const [readyCount, setReadyCount] = useState(0)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<ProfileResult | null>(null)

    useEffect(() => setDevice(readDevice()), [])

    useEffect(() => {
        const refresh = () => {
            const stage = stageRef.current
            setReadyCount(stage?.querySelectorAll('[data-lottie-ready="true"] svg').length ?? 0)
        }
        refresh()
        const interval = window.setInterval(refresh, 250)
        return () => window.clearInterval(interval)
    }, [pose, instances])

    const runProfile = async () => {
        if (running) return
        setRunning(true)
        setResult(null)

        const frameIntervals: number[] = []
        let longTasks = 0
        let longTaskMs = 0
        let observer: PerformanceObserver | null = null

        if (
            typeof PerformanceObserver !== 'undefined' &&
            PerformanceObserver.supportedEntryTypes.includes('longtask')
        ) {
            observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    longTasks += 1
                    longTaskMs += entry.duration
                }
            })
            observer.observe({ entryTypes: ['longtask'] })
        }

        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

        const startedAt = performance.now()
        let previousFrame = startedAt
        await new Promise<void>((resolve) => {
            const sample = (now: number) => {
                frameIntervals.push(now - previousFrame)
                previousFrame = now
                if (now - startedAt >= PROFILE_DURATION_MS) resolve()
                else requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })

        observer?.disconnect()
        const elapsed = previousFrame - startedAt
        const stage = stageRef.current
        setResult({
            fps: (frameIntervals.length * 1000) / elapsed,
            p95FrameMs: percentile(frameIntervals, 0.95),
            worstFrameMs: Math.max(...frameIntervals),
            slowFrames: frameIntervals.filter((duration) => duration > 34).length,
            longTasks,
            longTaskMs,
            ready: stage?.querySelectorAll('[data-lottie-ready="true"]').length ?? 0,
            svg: stage?.querySelectorAll('[data-lottie-ready="true"] svg').length ?? 0,
        })
        setRunning(false)
    }

    return (
        <DevPageShell
            title="Lottie native profile"
            description="TASK-21683: measure lottie-web's SVG renderer in the actual Capacitor WebView. The heaviest walking rig is selected by default."
            width="prose"
        >
            {device && (
                <Section title="Device">
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        <DataRow label="platform" value={device.platform} />
                        <DataRow label="native bridge" value={device.nativeBridge ? 'yes' : 'no'} />
                        <DataRow label="webview" value={device.webView} />
                        <DataRow label="CPU threads" value={String(device.hardwareConcurrency)} />
                        <DataRow label="device memory" value={device.deviceMemory} />
                        <DataRow
                            label="user agent"
                            value={<span className="break-all text-foreground-secondary">{device.userAgent}</span>}
                        />
                    </Card>
                </Section>
            )}

            <Section title="Scenario">
                <Card className="gap-4 p-4">
                    <div className="flex flex-col gap-1 text-label-m">
                        <span>Pose</span>
                        <BaseSelect
                            aria-label="Pose"
                            value={pose}
                            onValueChange={(value) => setPose(value as MascotPose)}
                            options={POSES.map((value) => ({ label: value, value }))}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {([1, 3, 10] as const).map((count) => (
                            <Button
                                key={count}
                                variant={instances === count ? 'primary' : 'stroke'}
                                size="small"
                                onClick={() => setInstances(count)}
                            >
                                {count} instance{count === 1 ? '' : 's'}
                            </Button>
                        ))}
                    </div>
                    <p className="text-body-s text-foreground-secondary">
                        Loaded SVGs: {readyCount}/{instances}. Wait for all instances before profiling.
                    </p>
                </Card>
            </Section>

            <div
                ref={stageRef}
                className="grid min-h-64 grid-cols-2 place-items-center gap-3 rounded-sm border border-border-default bg-background-brand p-4 sm:grid-cols-3"
            >
                {Array.from({ length: instances }, (_, index) => (
                    <PeanutMascot key={`${pose}-${index}`} pose={pose} className="h-36 max-w-full" />
                ))}
            </div>

            <Button onClick={runProfile} loading={running} disabled={running || readyCount !== instances}>
                {running ? 'Profiling for 10 seconds…' : 'Run 10-second profile'}
            </Button>

            {result && (
                <Section title="Result">
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        <DataRow label="average rAF" value={`${result.fps.toFixed(1)} fps`} />
                        <DataRow label="p95 frame" value={`${result.p95FrameMs.toFixed(1)} ms`} />
                        <DataRow label="worst frame" value={`${result.worstFrameMs.toFixed(1)} ms`} />
                        <DataRow label="frames over 34 ms" value={String(result.slowFrames)} />
                        <DataRow
                            label="long tasks"
                            value={`${result.longTasks} / ${result.longTaskMs.toFixed(1)} ms`}
                        />
                        <DataRow label="ready hosts / SVGs" value={`${result.ready} / ${result.svg}`} />
                    </Card>
                </Section>
            )}

            <Callout
                priority="info"
                title="Run protocol"
                items={[
                    'Use an unplugged floor Android device after a cold launch; keep the page foregrounded.',
                    'Record walking ×1, walking ×3, and walking ×10, then repeat after five minutes for thermal drift.',
                    'Capture a Chrome Performance trace for the ×3 run. This page measures responsiveness, not battery drain.',
                    'Repeat waving-chill ×1 on iOS TestFlight and note visible stutter, blank frames, or WebView reloads.',
                ]}
            />
        </DevPageShell>
    )
}
