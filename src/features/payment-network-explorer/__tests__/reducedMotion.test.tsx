import { act, render, renderHook, waitFor } from '@testing-library/react'
import ExplorerStatePanel from '../ExplorerStatePanel'
import NetworkCanvas from '../NetworkCanvas'
import type { ExplorerNode, ExplorerRelationship } from '../types'
import { useReducedMotion } from '../useReducedMotion'

let mockForceGraphProps: Record<string, unknown> | null = null
const mockCenterAt = jest.fn()
const mockZoom = jest.fn()

jest.mock(
    'next/dynamic',
    () => () =>
        function MockForceGraph(props: Record<string, unknown>) {
            const React = jest.requireActual<typeof import('react')>('react')
            mockForceGraphProps = props
            React.useEffect(() => {
                const assignRef = props.ref as ((instance: unknown) => void) | undefined
                assignRef?.({ centerAt: mockCenterAt, zoom: mockZoom })
                return () => assignRef?.(null)
                // The real graph owns ref lifetime; this test double intentionally mounts once.
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [])
            return <canvas />
        }
)

function mockMatchMedia(matches: boolean) {
    window.matchMedia = jest.fn(
        () =>
            ({
                matches,
                media: '(prefers-reduced-motion: reduce)',
                onchange: null,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                addListener: jest.fn(),
                removeListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }) as MediaQueryList
    )
}

describe('payment explorer reduced motion', () => {
    beforeEach(() => {
        mockForceGraphProps = null
        mockCenterAt.mockReset()
        mockZoom.mockReset()
        mockMatchMedia(true)
    })

    it('reads the operating-system reduced-motion preference', () => {
        const { result } = renderHook(() => useReducedMotion())
        expect(result.current).toBe(true)
    })

    it('stops animated graph settling when reduced motion is requested', () => {
        render(
            <NetworkCanvas
                nodes={[]}
                relationships={[]}
                selected={null}
                focusNodeId={null}
                onSelectNode={jest.fn()}
                onSelectRelationship={jest.fn()}
            />
        )
        expect(mockForceGraphProps?.warmupTicks).toBe(20)
        expect(mockForceGraphProps?.cooldownTicks).toBe(0)
    })

    it('disables the loading spinner animation under reduced motion', () => {
        const { container } = render(<ExplorerStatePanel title="Loading" detail="Live data" busy />)
        expect(container.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none')
    })

    it('applies a signed-focus camera after both the graph ref and layout coordinates are ready', async () => {
        const focusedNode: ExplorerNode = {
            id: 'focus-node',
            username: 'focused-user',
            hasAppAccess: true,
            directPoints: 0,
            transitivePoints: 0,
            totalPoints: 1,
            createdAt: null,
            lastActiveAt: null,
            kycRegions: null,
        }
        const { container } = render(
            <NetworkCanvas
                nodes={[focusedNode]}
                relationships={[]}
                selected={null}
                focusNodeId={focusedNode.id}
                onSelectNode={jest.fn()}
                onSelectRelationship={jest.fn()}
            />
        )

        await waitFor(() => expect(mockForceGraphProps?.onEngineTick).toEqual(expect.any(Function)))
        const graphData = mockForceGraphProps?.graphData as { nodes: Array<{ x?: number; y?: number }> }
        graphData.nodes[0].x = 42
        graphData.nodes[0].y = -17
        act(() => {
            ;(mockForceGraphProps?.onEngineTick as () => void)()
        })

        await waitFor(() => expect(mockCenterAt).toHaveBeenCalledWith(42, -17, 0))
        expect(mockZoom).toHaveBeenCalledWith(3.2, 0)
        expect(container.querySelector('[data-focus-camera-applied="true"]')).toBeInTheDocument()

        act(() => {
            ;(mockForceGraphProps?.onEngineTick as () => void)()
        })
        expect(mockCenterAt).toHaveBeenCalledTimes(1)
        expect(mockZoom).toHaveBeenCalledTimes(1)
    })

    it('resets dense link visibility to overview when a filter response replaces the projection', () => {
        const nodes = Array.from(
            { length: 1000 },
            (_, index): ExplorerNode => ({
                id: `node-${index}`,
                username: `node-${index}`,
                hasAppAccess: true,
                directPoints: 0,
                transitivePoints: 0,
                totalPoints: 1,
                createdAt: null,
                lastActiveAt: null,
                kycRegions: null,
            })
        )
        const relationships = (prefix: string) =>
            Array.from(
                { length: 400 },
                (_, index): ExplorerRelationship => ({
                    id: `${prefix}-${index}`,
                    source: 'node-0',
                    target: 'node-1',
                    type: 'SEND_LINK',
                    count: index + 1,
                    totalUsd: index + 1,
                    bidirectional: false,
                })
            )
        const first = relationships('first')
        const { rerender } = render(
            <NetworkCanvas
                nodes={nodes}
                relationships={first}
                selected={null}
                focusNodeId={null}
                onSelectNode={jest.fn()}
                onSelectRelationship={jest.fn()}
            />
        )
        const visible = () =>
            mockForceGraphProps?.linkVisibility as (link: { canonicalRelationshipId: string }) => boolean
        expect(visible()({ canonicalRelationshipId: 'first-0' })).toBe(false)
        act(() => {
            ;(mockForceGraphProps?.onZoom as (zoom: { k: number }) => void)({ k: 5 })
        })
        expect(visible()({ canonicalRelationshipId: 'first-0' })).toBe(true)

        const second = relationships('second')
        rerender(
            <NetworkCanvas
                nodes={nodes}
                relationships={second}
                selected={null}
                focusNodeId={null}
                onSelectNode={jest.fn()}
                onSelectRelationship={jest.fn()}
            />
        )
        expect(visible()({ canonicalRelationshipId: 'second-0' })).toBe(false)
    })
})
