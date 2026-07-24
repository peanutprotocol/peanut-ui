import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { SumsubKycWrapper } from '../SumsubKycWrapper'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

// The real Modal is a headlessui <Transition>/<Dialog>. The <Transition> promotes
// tree state to Visible inside an EFFECT, so children mount a commit AFTER
// `visible` flips true. (Isolation-tested: dialog-only mounts the container
// synchronously; transition-only and transition+dialog do not — so the Portal is
// not the culprit, despite the original diagnosis.) That one-commit delay is the
// whole bug this suite guards — a plain useRef read in the init effect is null on
// the pass where visible/accessToken/sdkLoaded are all ready, and a ref is not
// reactive, so the effect never re-runs and the SDK is never launched.
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    // Named + capitalised so eslint's rules-of-hooks recognises it as a component.
    default: function MockPortalModal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
        // `mounted` resets on close so a close/re-open cycle replays the late
        // mount, exactly like the real portal tearing down and rebuilding.
        const [mounted, setMounted] = useState(false)
        useEffect(() => {
            setMounted(visible)
        }, [visible])
        if (!visible || !mounted) return null
        return <div data-testid="modal">{children}</div>
    },
}))

jest.mock('@/components/Global/ActionModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

const launch = jest.fn()

function installSdk() {
    const builder: Record<string, unknown> = {}
    builder.withConf = () => builder
    builder.withOptions = () => builder
    builder.on = () => builder
    builder.build = () => ({ launch, destroy: jest.fn() })
    ;(window as unknown as { snsWebSdk: unknown }).snsWebSdk = { init: () => builder }
}

describe('SumsubKycWrapper', () => {
    beforeEach(() => {
        launch.mockClear()
        capture.mockClear()
        installSdk()
    })

    afterEach(() => {
        // don't leak the global — a later test may need the script-loading path
        // (snsWebSdk absent -> script injected -> onload) to be reachable.
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })

    it('launches the SDK when an already-mounted wrapper is opened (portal mounts container late)', async () => {
        // Faithful to prod: SumsubKycModals keeps this wrapper mounted, so the
        // websdk script resolves and `sdkLoaded` settles true while hidden. Only
        // `visible` flips later — and if the init effect bails on a null ref at
        // that moment, NOTHING else ever changes to re-run it. Mounting straight
        // to visible instead lets the sdkLoaded flip re-run the effect and hides
        // the bug entirely.
        const props = {
            accessToken: 'tok_abc',
            onClose: jest.fn(),
            onComplete: jest.fn(),
            onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
        }
        // window.snsWebSdk is pre-installed, so the script effect resolves
        // sdkLoaded->true on mount and render() flushes it inside act(). That is
        // what makes `visible` the LAST dep to flip — if sdkLoaded flipped after
        // it instead, that flip would re-run the init effect with the container
        // already mounted and mask the bug entirely.
        const { rerender } = render(<SumsubKycWrapper visible={false} {...props} />)
        expect(launch).not.toHaveBeenCalled()

        rerender(<SumsubKycWrapper visible {...props} />)

        // Regression: before the callback-ref fix this never fired, leaving the
        // user on an infinite spinner (card_sumsub_opened with 0 completions).
        await waitFor(() => expect(launch).toHaveBeenCalledTimes(1))
        expect(launch.mock.calls[0][0]).toBeInstanceOf(HTMLElement)
    })

    it('does not launch while hidden', async () => {
        render(
            <SumsubKycWrapper
                visible={false}
                accessToken="tok_abc"
                onClose={jest.fn()}
                onComplete={jest.fn()}
                onRefreshToken={jest.fn().mockResolvedValue('tok_abc')}
            />
        )
        await new Promise((r) => setTimeout(r, 0))
        expect(launch).not.toHaveBeenCalled()
    })

    it('does not launch without an access token', async () => {
        render(
            <SumsubKycWrapper
                visible
                accessToken={null}
                onClose={jest.fn()}
                onComplete={jest.fn()}
                onRefreshToken={jest.fn().mockResolvedValue('tok_abc')}
            />
        )
        await new Promise((r) => setTimeout(r, 0))
        expect(launch).not.toHaveBeenCalled()
    })

    describe('launch watchdog', () => {
        // The outage lasted 19h because a non-launching SDK is completely silent.
        // These assert the silence is now broken — both on screen and in analytics.
        it('surfaces the error UI instead of spinning forever when the SDK never launches', async () => {
            jest.useFakeTimers()
            try {
                // accessToken never arrives -> init effect can never run -> the exact
                // shape of a silent stall.
                render(
                    <SumsubKycWrapper
                        visible
                        accessToken={null}
                        onClose={jest.fn()}
                        onComplete={jest.fn()}
                        onRefreshToken={jest.fn().mockResolvedValue('tok_abc')}
                    />
                )
                expect(screen.queryByText(/failed to load verification/i)).not.toBeInTheDocument()

                await act(async () => {
                    jest.advanceTimersByTime(20_000)
                })

                expect(screen.getByText(/failed to load verification/i)).toBeInTheDocument()
                expect(capture).toHaveBeenCalledWith(
                    'kyc_sdk_launch_timeout',
                    expect.objectContaining({ hadAccessToken: false })
                )
            } finally {
                jest.useRealTimers()
            }
        })

        it('does not fire once the SDK has launched', async () => {
            jest.useFakeTimers()
            try {
                const props = {
                    accessToken: 'tok_abc',
                    onClose: jest.fn(),
                    onComplete: jest.fn(),
                    onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
                }
                const { rerender } = render(<SumsubKycWrapper visible={false} {...props} />)
                await act(async () => {
                    rerender(<SumsubKycWrapper visible {...props} />)
                })
                expect(launch).toHaveBeenCalledTimes(1)
                expect(capture).toHaveBeenCalledWith('kyc_sdk_launched', expect.anything())

                await act(async () => {
                    jest.advanceTimersByTime(20_000)
                })

                expect(capture).not.toHaveBeenCalledWith('kyc_sdk_launch_timeout', expect.anything())
                expect(screen.queryByText(/failed to load verification/i)).not.toBeInTheDocument()
            } finally {
                jest.useRealTimers()
            }
        })
    })
})
