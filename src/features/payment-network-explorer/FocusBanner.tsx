import type { ExplorerNode } from './types'
import { Callout } from '@/components/0_Bruddle/Callout'

interface FocusBannerProps {
    username: string
    node: ExplorerNode | null
    loaded: boolean
    onClear: () => void
}

export default function FocusBanner({ username, node, loaded, onClear }: FocusBannerProps) {
    return (
        <div className="border-b border-border-default p-2">
            <Callout
                priority={loaded && !node ? 'attention' : 'info'}
                title={`Focused: ${node?.username ?? username}`}
                ctas={[{ label: 'Clear focus', onClick: onClear }]}
            >
                {loaded && !node ? 'This user is not in the loaded graph.' : 'The graph is centered on this user.'}
            </Callout>
        </div>
    )
}
