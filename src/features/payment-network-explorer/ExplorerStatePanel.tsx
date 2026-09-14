interface ExplorerStatePanelProps {
    title: string
    detail: string
    busy?: boolean
    onRetry?: () => void
}

export default function ExplorerStatePanel({ title, detail, busy = false, onRetry }: ExplorerStatePanelProps) {
    return (
        <section className="flex h-full items-center justify-center bg-background-page p-6" aria-live="polite">
            {busy ? (
                <Card className="w-full max-w-sm items-center gap-3 p-6 text-center" shadowSize="4">
                    <Loading className="h-4 w-4 motion-reduce:animate-none" />
                    <TitleBlock title={title} description={detail} align="center" />
                </Card>
            ) : (
                <EmptyState
                    icon={onRetry ? 'error' : 'info'}
                    iconColor={onRetry ? 'red' : 'gray'}
                    title={title}
                    description={detail}
                    containerClassName="w-full max-w-sm"
                    cta={
                        onRetry ? (
                            <Button type="button" onClick={onRetry} className="mt-2 w-auto">
                                Retry
                            </Button>
                        ) : undefined
                    }
                />
            )}
        </section>
    )
}
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import Loading from '@/components/Global/Loading'
