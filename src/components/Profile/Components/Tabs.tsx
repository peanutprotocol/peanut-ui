type TabType = {
    title: string
    value: string
    onClick?: () => void
}

type TabsProps = {
    className?: string
    classButton?: string
    items: TabType[]
    value: number | string
    setValue: any
}

export const Tabs = ({ className, classButton, items, value, setValue }: TabsProps) => {
    const handleClick = (value: string, onClick: any) => {
        setValue(value)
        onClick && onClick()
    }

    return (
        <div className={` flex flex-wrap ${className}`}>
            {items.map((item, index) => (
                <button
                    className={`ml-1 h-8 whitespace-nowrap rounded-sm px-5 text-xs font-bold outline-none transition-colors tap-highlight-color hover:text-n-3  ${
                        value === item.value ? 'bg-n-1 !text-white dark:bg-white/[0.08]' : ''
                    } ${classButton}`}
                    onClick={() => handleClick(item.value, item.onClick)}
                    key={index}
                >
                    {item.title}
                </button>
            ))}
        </div>
    )
}
