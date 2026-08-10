import { renderHook, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { useSumsubReloadResume, type KycResumeState } from '@/hooks/useSumsubReloadResume'

const encode = (state: Record<string, unknown>) => ({ kyc: JSON.stringify(state) })

const wrapperFor = (searchParams: Record<string, string>, onUrlUpdate?: OnUrlUpdateFunction) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                {children}
            </NuqsTestingAdapter>
        )
    }

describe('useSumsubReloadResume', () => {
    it('does not resume when nothing is persisted', () => {
        const onResume = jest.fn().mockResolvedValue(true)
        renderHook(() => useSumsubReloadResume(null, onResume), { wrapper: wrapperFor({}) })
        expect(onResume).not.toHaveBeenCalled()
    })

    it('does not resume when the SDK is already open', () => {
        const onResume = jest.fn().mockResolvedValue(true)
        renderHook(() => useSumsubReloadResume({}, onResume), { wrapper: wrapperFor(encode({})) })
        expect(onResume).not.toHaveBeenCalled()
    })

    // The regression this hook exists for: replaying a LATAM cross-region
    // initiate with no arguments mints a token for the wrong verification level.
    it('replays the persisted initiate arguments verbatim', async () => {
        const onResume = jest.fn().mockResolvedValue(true)
        const persisted: KycResumeState = { intent: 'LATAM', crossRegion: true, targetCountry: 'AR' }

        renderHook(() => useSumsubReloadResume(null, onResume), { wrapper: wrapperFor(encode(persisted)) })

        await waitFor(() => expect(onResume).toHaveBeenCalledTimes(1))
        expect(onResume).toHaveBeenCalledWith({
            intent: 'LATAM',
            levelName: undefined,
            crossRegion: true,
            targetCountry: 'AR',
        })
    })

    it('resumes only once per mount', async () => {
        const onResume = jest.fn().mockResolvedValue(true)
        const { rerender } = renderHook(() => useSumsubReloadResume(null, onResume), {
            wrapper: wrapperFor(encode({ intent: 'ROW' })),
        })

        await waitFor(() => expect(onResume).toHaveBeenCalledTimes(1))
        rerender()
        rerender()
        expect(onResume).toHaveBeenCalledTimes(1)
    })

    it('clears the persisted state when the resume cannot reopen the SDK', async () => {
        const onUrlUpdate = jest.fn()
        const onResume = jest.fn().mockResolvedValue(false)

        renderHook(() => useSumsubReloadResume(null, onResume), {
            wrapper: wrapperFor(encode({ intent: 'LATAM' }), onUrlUpdate),
        })

        await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('kyc')).toBeNull()
    })

    it('clears the persisted state when the resume throws', async () => {
        const onUrlUpdate = jest.fn()
        const onResume = jest.fn().mockRejectedValue(new Error('initiate failed'))

        renderHook(() => useSumsubReloadResume(null, onResume), {
            wrapper: wrapperFor(encode({ intent: 'LATAM' }), onUrlUpdate),
        })

        await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('kyc')).toBeNull()
    })

    it('persists the initiate arguments when the SDK opens', async () => {
        const onUrlUpdate = jest.fn()
        const onResume = jest.fn().mockResolvedValue(true)
        const { rerender } = renderHook(
            ({ open }: { open: KycResumeState | null }) => useSumsubReloadResume(open, onResume),
            { wrapper: wrapperFor({}, onUrlUpdate), initialProps: { open: null as KycResumeState | null } }
        )

        rerender({ open: { intent: 'LATAM', crossRegion: true, targetCountry: 'BR' } })

        await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
        expect(JSON.parse(onUrlUpdate.mock.calls.at(-1)![0].searchParams.get('kyc')!)).toEqual({
            intent: 'LATAM',
            crossRegion: true,
            targetCountry: 'BR',
        })
    })

    it('does not rewrite the URL while the open state is unchanged by value', async () => {
        const onUrlUpdate = jest.fn()
        const onResume = jest.fn().mockResolvedValue(true)
        // a fresh object each render, as the real call sites build it
        const { rerender } = renderHook(() => useSumsubReloadResume({ intent: 'LATAM' }, onResume), {
            wrapper: wrapperFor(encode({ intent: 'LATAM' }), onUrlUpdate),
        })

        rerender()
        rerender()
        expect(onUrlUpdate).not.toHaveBeenCalled()
    })

    // the param is user-editable, so a hostile value must not reach the replay
    it('drops fields that fail validation', async () => {
        const onResume = jest.fn().mockResolvedValue(true)
        renderHook(() => useSumsubReloadResume(null, onResume), {
            wrapper: wrapperFor({ kyc: JSON.stringify({ intent: 'NOT_A_REGION', crossRegion: 'yes' }) }),
        })

        await waitFor(() => expect(onResume).toHaveBeenCalledTimes(1))
        expect(onResume).toHaveBeenCalledWith({
            intent: undefined,
            levelName: undefined,
            crossRegion: undefined,
            targetCountry: undefined,
        })
    })

    it('does not resume on a malformed param', () => {
        const onResume = jest.fn().mockResolvedValue(true)
        renderHook(() => useSumsubReloadResume(null, onResume), { wrapper: wrapperFor({ kyc: 'not-json' }) })
        expect(onResume).not.toHaveBeenCalled()
    })
})
