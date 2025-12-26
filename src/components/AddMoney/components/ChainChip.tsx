import { Card } from '@/components/0_Bruddle/Card'

const ChainChip = ({ chainName }: { chainName: string }) => {
    return (
        <Card className="w-fit rounded-full p-1 px-2">
            <p className="text-xs text-black">{chainName}</p>
        </Card>
    )
}

export default ChainChip
