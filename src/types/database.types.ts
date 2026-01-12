export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            studios: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    timezone: string
                    created_at: string
                    owner_id: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    timezone?: string
                    created_at?: string
                    owner_id: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    timezone?: string
                    created_at?: string
                    owner_id?: string
                }
            }
            studio_users: {
                Row: {
                    id: string
                    studio_id: string
                    user_id: string
                    role: 'owner' | 'admin' | 'colleague'
                    status: 'active' | 'invited' | 'disabled'
                }
                Insert: {
                    id?: string
                    studio_id: string
                    user_id: string
                    role?: 'owner' | 'admin' | 'colleague'
                    status?: 'active' | 'invited' | 'disabled'
                }
                Update: {
                    id?: string
                    studio_id?: string
                    user_id?: string
                    role?: 'owner' | 'admin' | 'colleague'
                    status?: 'active' | 'invited' | 'disabled'
                }
            }
            equipment: {
                Row: {
                    id: string
                    studio_id: string
                    name: string
                    category: string
                    sku: string | null
                    total_quantity: number
                    available_quantity: number
                    metadata: Json | null
                    photo_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    studio_id: string
                    name: string
                    category: string
                    sku?: string | null
                    total_quantity: number
                    available_quantity?: number
                    metadata?: Json | null
                    photo_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    studio_id?: string
                    name?: string
                    category?: string
                    sku?: string | null
                    total_quantity?: number
                    available_quantity?: number
                    metadata?: Json | null
                    photo_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            equipment_items: {
                Row: {
                    id: string
                    equipment_id: string
                    studio_id: string
                    code: string
                    code_type: 'qr' | 'barcode'
                    status: 'available' | 'checked_out' | 'maintenance'
                    photo_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    equipment_id: string
                    studio_id: string
                    code: string
                    code_type: 'qr' | 'barcode'
                    status?: 'available' | 'checked_out' | 'maintenance'
                    photo_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    equipment_id?: string
                    studio_id?: string
                    code?: string
                    code_type?: 'qr' | 'barcode'
                    status?: 'available' | 'checked_out' | 'maintenance'
                    photo_url?: string | null
                    created_at?: string
                }
            }
            transactions: {
                Row: {
                    id: string
                    studio_id: string
                    equipment_id: string
                    equipment_item_id: string | null
                    user_id: string
                    type: 'checkout' | 'checkin' | 'adjustment'
                    quantity: number
                    photo_url: string | null
                    notes: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    studio_id: string
                    equipment_id: string
                    equipment_item_id?: string | null
                    user_id: string
                    type: 'checkout' | 'checkin' | 'adjustment'
                    quantity?: number
                    photo_url?: string | null
                    notes?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    studio_id?: string
                    equipment_id?: string
                    equipment_item_id?: string | null
                    user_id?: string
                    type?: 'checkout' | 'checkin' | 'adjustment'
                    quantity?: number
                    photo_url?: string | null
                    notes?: string | null
                    created_at?: string
                }
            }
            studio_invitations: {
                Row: {
                    id: string
                    studio_id: string
                    email: string
                    role: string
                    status: 'pending' | 'accepted' | 'declined'
                    invited_by: string
                    created_at: string
                    accepted_at: string | null
                }
                Insert: {
                    id?: string
                    studio_id: string
                    email: string
                    role?: string
                    status?: 'pending' | 'accepted' | 'declined'
                    invited_by: string
                    created_at?: string
                    accepted_at?: string | null
                }
                Update: {
                    id?: string
                    studio_id?: string
                    email?: string
                    role?: string
                    status?: 'pending' | 'accepted' | 'declined'
                    invited_by?: string
                    created_at?: string
                    accepted_at?: string | null
                }
            }
        }
    }
}
