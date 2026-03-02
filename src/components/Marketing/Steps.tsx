import { Card } from '@/components/0_Bruddle/Card'

interface StepsProps {
    steps: Array<{ title: string; description: string }>
}

export function Steps({ steps }: StepsProps) {
    return (
        <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
                <li key={i}>
                    <Card shadowSize="4" className="flex-row items-start gap-4 p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-1 text-base font-bold">
                            {i + 1}
                        </span>
                        <div>
                            <h3 className="font-bold">{step.title}</h3>
                            <p className="mt-1 text-sm text-black/70">{step.description}</p>
                        </div>
                    </Card>
                </li>
            ))}
        </ol>
    )
}
