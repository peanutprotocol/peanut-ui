import { useState } from 'react'
import * as global_components from '@/components/global'
import {SendWidget} from "../send-widget";
import { ChromePicker } from 'react-color'

export function WidgetCustomizer() {

    const [colorPickerKey, setColorPickerKey] = useState('backgroundColor')

    const input = ({ key, title, value }) => {
        return (
            <div className={`flex items-center gap-2 mt-2`}>
                <div className="font-normal text-sm">{ title }</div>
                <div className={`p-2 border border-solid rounded ${colorPickerKey !== key ? 'border-gray-200' : 'border-gray-500'}`} onClick={() => setColorPickerKey(key)}>
                    <div className="w-12 h-6 border-solid border-gray-100 rounded" style={{backgroundColor: value}}></div>
                </div>
            </div>
        );
    }

    function handleChange(color) {
        setBranding({
            ...branding,
            [colorPickerKey]: color.hex,
        })
    }

    const [branding, setBranding] = useState({
        textColor: '#000',
        backgroundColor: '#fff',
        titleTextColor: '#000',
        amountTextColor: '#000',
        boxBackgroundColor: '#fff',
        boxTextColor: '#000',
        buttonBackgroundColor: '#fff',
        buttonTextColor: '#000',
        placeholderTheme: 'light',
    })

    const backgroundColor = input({
        key: 'backgroundColor',
        title: 'Background Color',
        value: branding.backgroundColor,
    })

    const textColor = input({
        key: 'textColor',
        title: 'Text Color',
        value: branding.textColor,
    })

    const titleTextColor = input({
        key: 'titleTextColor',
        title: 'Title Text Color',
        value: branding.titleTextColor,
    })

    const amountTextColor = input({
        key: 'amountTextColor',
        title: 'Amount Text Color',
        value: branding.amountTextColor,
    })

    const boxBackgroundColor = input({
        key: 'boxBackgroundColor',
        title: 'Box Background Color',
        value: branding.boxBackgroundColor,
    })

    const boxTextColor = input({
        key: 'boxTextColor',
        title: 'Box Text Color',
        value: branding.boxTextColor,
    })

    const buttonBackgroundColor = input({
        key: 'buttonBackgroundColor',
        title: 'Button Background Color',
        value: branding.buttonBackgroundColor,
    })

    const buttonTextColor = input({
        key: 'buttonTextColor',
        title: 'Button Text Color',
        value: branding.buttonTextColor,
    })

    function generateSrc() {
        // for some reason react-router doesn't read queryParams with hex like (#fff)
        const stripHex = (item) => item.replace('#', '');
        return `https://peanut.to/widget?backgroundColor=${stripHex(branding.backgroundColor)}&textColor=${stripHex(branding.textColor)}&titleTextColor=${stripHex(branding.titleTextColor)}&amountTextColor=${stripHex(branding.amountTextColor)}&boxBackgroundColor=${stripHex(branding.boxBackgroundColor)}&boxTextColor=${stripHex(branding.boxTextColor)}&buttonBackgroundColor=${stripHex(branding.buttonBackgroundColor)}&buttonTextColor=${stripHex(branding.buttonTextColor)}`;
    }

    return (
        <global_components.CardWrapper>
            <div className="h-full" style={{backgroundColor: branding.backgroundColor}}>
                <SendWidget branding={branding}/>
            </div>
            <div className="flex gap-10 mt-6">
                <div className="w-1/2">
                    { backgroundColor }
                    { textColor }
                    { titleTextColor }
                    { amountTextColor }
                    { boxBackgroundColor }
                    { boxTextColor }
                    { buttonBackgroundColor }
                    { buttonTextColor }
                    {/*{ placeholderTheme }*/}
                </div>

                <div className="w-1/2">
                    <ChromePicker color={branding[colorPickerKey]} onChange={handleChange}/>
                </div>
            </div>
            <div className="flex flex-col w-full justify-center align-center mt-6">
                <div>Copy-paste HTML code below:</div>
                <textarea onChange="" className="mt-2 w-1/2 h-48" value={`<iframe width="200" height="380" src="${generateSrc()}" />`}>
                </textarea>
            </div>
        </global_components.CardWrapper>
    )
}
