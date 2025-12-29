import { Card } from '@/components/0_Bruddle/Card'
import Image from 'next/image'

const ChainChip = ({ chainName, chainSymbol }: { chainName: string; chainSymbol?: string }) => {
    return (
        <Card className="flex w-fit flex-row items-center gap-1 rounded-full p-1 px-2">
            {chainSymbol && <Image src={chainSymbol} alt={chainName} width={18} height={18} />}
            <p className="text-xs text-black">{chainName}</p>
        </Card>
    )
}

export default ChainChip
