import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'

interface PerkIconProps {
    size?: 's' | 'm' | 'l'
    className?: string
}

/** A perk is a reward: the rewards concept bubble (pink, star). */
export const PerkIcon: React.FC<PerkIconProps> = ({ size = 'm', className }) => (
    <IconBubble {...CONCEPT_ICONS.rewards} size={size} className={className} />
)
