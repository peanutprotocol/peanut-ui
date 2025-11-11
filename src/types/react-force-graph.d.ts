declare module 'react-force-graph-2d' {
    import { Component } from 'react'

    export interface ForceGraph2DProps {
        graphData: {
            nodes: any[]
            edges?: any[]
            links?: any[]
        }
        nodeId?: string
        nodeLabel?: string | ((node: any) => string)
        nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
        nodeCanvasObjectMode?: (node: any) => 'replace' | 'before' | 'after'
        linkLabel?: string | ((link: any) => string)
        linkColor?: string | ((link: any) => string)
        linkWidth?: number | ((link: any) => number)
        linkCurvature?: number | ((link: any) => number)
        linkDirectionalArrowLength?: number
        linkDirectionalArrowRelPos?: number
        onNodeClick?: (node: any, event: MouseEvent) => void
        onNodeHover?: (node: any | null, previousNode: any | null) => void
        enableNodeDrag?: boolean
        cooldownTicks?: number
        d3VelocityDecay?: number
        d3AlphaDecay?: number
        backgroundColor?: string
        width?: number
        height?: number
        [key: string]: any
    }

    export default class ForceGraph2D extends Component<ForceGraph2DProps> {
        centerAt(x: number, y: number, duration?: number): this
        zoom(scale: number, duration?: number): this
        zoomToFit(duration?: number, padding?: number): this
        d3Force(forceName: string, force?: any): any
        d3ReheatSimulation(): void
    }
}

declare module 'd3-force' {
    export function forceCenter(x?: number, y?: number): any
    export function forceCollide(radius?: number | ((node: any) => number)): any
    export function forceLink(links?: any[]): any
    export function forceManyBody(): any
    export function forceSimulation(nodes?: any[]): any
    export function forceX(x?: number | ((node: any) => number)): any
    export function forceY(y?: number | ((node: any) => number)): any
}
