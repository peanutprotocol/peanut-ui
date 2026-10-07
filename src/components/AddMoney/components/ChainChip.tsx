import { Card } from '@/components/0_Bruddle/Card'
import Image from 'next/image'

interface ChainChipProps {
    chainName: string
    chainSymbol?: string
}

const ChainChip = ({ chainName, chainSymbol }: ChainChipProps) => {
    return (
        <Card className="flex w-fit flex-row items-center gap-1 rounded-full border-0 bg-transparent p-1 px-2">
            {chainSymbol && <Image src={chainSymbol} alt={chainName} width={16} height={16} />}
            <p className="text-body-xs text-foreground-primary">{chainName}</p>
        </Card>
    )
}

export default ChainChip
