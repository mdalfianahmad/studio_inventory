import QRCode from 'qrcode'

export interface QRPayload {
    id: string      // equipment_id or equipment_item_id
    type: 'equipment' | 'item'
    studio_id: string
}

export const generateEquipmentPayload = (studioId: string, equipmentId: string): string => {
    const payload: QRPayload = {
        id: equipmentId,
        type: 'equipment',
        studio_id: studioId
    }
    return JSON.stringify(payload)
}

export const generateItemPayload = (studioId: string, itemId: string): string => {
    const payload: QRPayload = {
        id: itemId,
        type: 'item',
        studio_id: studioId
    }
    return JSON.stringify(payload)
}

export const generateQRDataURL = async (text: string): Promise<string> => {
    try {
        return await QRCode.toDataURL(text, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        })
    } catch (err) {
        console.error('Error generating QR code', err)
        throw err
    }
}
