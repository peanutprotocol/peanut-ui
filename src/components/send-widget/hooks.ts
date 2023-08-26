export function useBranding(searchParams) {

    // Defaults
    const TEXT_COLOR = "red"
    const BG_COLOR = "#000"
    const TITLE_TEXT_COLOR = "purple"
    const AMOUNT_TEXT_COLOR = "orange"
    const BOX_TEXT_COLOR = "red"
    const BOX_BACKGROUND_COLOR = "blue"
    const BUTTON_BACKGROUND_COLOR = "yellow"
    const BUTTON_TEXT_COLOR = "green"
    const AMOUNT_PLACEHOLDER_THEME = "light" // light or dark

    function getColor(searchKey, defaultValue) {
        return searchParams.has(searchKey) ? `#${searchParams.get(searchKey)}` : defaultValue;
    }

    const branding = {
        textColor: getColor('textColor', TEXT_COLOR),
        backgroundColor: getColor('backgroundColor', BG_COLOR),
        titleTextColor: getColor('titleTextColor', TITLE_TEXT_COLOR),
        amountTextColor: getColor('amountTextColor', AMOUNT_TEXT_COLOR),
        boxBackgroundColor: getColor('boxBackgroundColor', BOX_BACKGROUND_COLOR),
        boxTextColor: getColor('boxTextColor', BOX_TEXT_COLOR),
        buttonBackgroundColor: getColor('buttonBackgroundColor', BUTTON_BACKGROUND_COLOR),
        buttonTextColor: getColor('buttonTextColor', BUTTON_TEXT_COLOR),
        placeholderTheme: getColor('placeholderTheme', AMOUNT_PLACEHOLDER_THEME),
    }

    return branding;
}
