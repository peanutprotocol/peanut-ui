import { Card } from '@/components/0_Bruddle/Card'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import Image from 'next/image'

interface ChainChipProps {
    chainName: string
    chainSymbol?: string
    logo?: IconName
    logoClassName?: string
}

const ChainChip = ({ chainName, chainSymbol, logo, logoClassName }: ChainChipProps) => {
    return (
        <Card className="flex w-fit flex-row items-center gap-1 rounded-full p-1 px-2">
            {chainSymbol && <Image src={chainSymbol} alt={chainName} width={18} height={18} />}
            {logo && <Icon name={logo} width={18} height={18} className={logoClassName} />}
            <p className="text-xs text-black">{chainName}</p>
        </Card>
    )
}

export default ChainChip
