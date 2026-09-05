import { IconBubble, type IconBubbleColor } from './IconBubble'
import type { IconName } from '../Global/Icons/Icon'

// code-only exception: composition recipe with no figma board. the `l` bubble
// centered above a screen's content, so a page never has to respell the
// centering itself and every screen that carries a mark carries the same one.

export const ScreenMark = ({ icon, color = 'green' }: { icon: IconName; color?: IconBubbleColor }) => (
    <IconBubble icon={icon} size="l" color={color} className="mx-auto" />
)
