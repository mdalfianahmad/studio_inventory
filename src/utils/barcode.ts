import JsBarcode from 'jsbarcode'

export const generateBarcodeDataURL = (text: string): string => {
    try {
        const canvas = document.createElement('canvas')
        JsBarcode(canvas, text, {
            format: "CODE128",
            width: 2,
            height: 100,
            displayValue: true
        })
        return canvas.toDataURL("image/png")
    } catch (err) {
        console.error('Error generating Barcode', err)
        throw err
    }
}
