'use client'
import { useColorMode } from '@chakra-ui/color-mode'
import Icon from '@/components/Global/Icon'

type ToggleThemeProps = {}

const ToggleTheme = ({}: ToggleThemeProps) => {
    const { colorMode, setColorMode } = useColorMode()

    const items = [
        {
            icon: 'sun',
            active: colorMode === 'light',
            onClick: () => setColorMode('light'),
        },
        {
            icon: 'moon',
            active: colorMode === 'dark',
            onClick: () => setColorMode('dark'),
        },
    ]

    return (
        <div
            className={`relative flex h-6.5 w-14 overflow-hidden rounded-sm border border-n-1 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1/2 before:bg-purple-1 before:transition-all dark:border-white ${
                colorMode === 'dark' ? 'before:translate-x-full' : ''
            }`}
        >
            {items.map((item, index) => (
                <button className="grow text-0" key={index} onClick={item.onClick}>
                    <Icon className="transition-color relative z-1 fill-n-1 dark:fill-white" name={item.icon} />
                </button>
            ))}
        </div>
    )
}

export default ToggleTheme
