import dynamic from 'next/dynamic'

// react-force-graph-2d touches window/canvas at import time, so it must load client-side only
export const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as any
