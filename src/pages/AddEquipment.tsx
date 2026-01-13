import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, HelpCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import '../styles/components.css'

export default function AddEquipment() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [photoFile, setPhotoFile] = useState<File | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        category: 'Camera',
        total_quantity: 1,
        sku: '',
        notes: ''
    })

    const getStudioId = async () => {
        const stored = localStorage.getItem('active_studio_id')
        if (stored) return stored

        if (!user) return null
        const { data } = await supabase
            .from('studio_users')
            .select('studio_id')
            .eq('user_id', user.id)
            .limit(1)
            .single()
        return data?.studio_id
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setPhotoFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!photoFile) {
            alert('Please add a photo of the equipment')
            return
        }

        setLoading(true)

        try {
            const studioId = await getStudioId()
            if (!studioId) {
                alert('Please select or create a studio first')
                return
            }

            // 1. Upload photo to Supabase Storage
            const fileExt = photoFile.name.split('.').pop()
            const fileName = `${studioId}/${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('equipment-photos')
                .upload(fileName, photoFile)

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from('equipment-photos')
                .getPublicUrl(fileName)

            const photoUrl = urlData.publicUrl

            // 2. Create the main equipment record
            const { data: equipment, error: equipmentError } = await supabase
                .from('equipment')
                .insert({
                    studio_id: studioId,
                    name: formData.name,
                    category: formData.category,
                    total_quantity: formData.total_quantity,
                    available_quantity: formData.total_quantity,
                    sku: formData.sku || null,
                    photo_url: photoUrl,
                    notes: formData.notes || null
                })
                .select()
                .single()

            if (equipmentError) throw equipmentError

            // 3. Create individual items with unique codes
            const itemsToInsert = Array.from({ length: formData.total_quantity }).map((_, index) => {
                const itemIndex = (index + 1).toString().padStart(3, '0')
                const baseId = formData.sku || formData.name.substring(0, 3).toUpperCase()
                return {
                    equipment_id: equipment.id,
                    studio_id: studioId,
                    code: `${baseId}-${itemIndex}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                    code_type: 'qr' as const,
                    status: 'available'
                }
            })

            const { error: itemsError } = await supabase
                .from('equipment_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError

            navigate('/equipment')
        } catch (error: any) {
            console.error('Error adding equipment:', error)
            alert(`Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-6)',
                paddingTop: 'var(--space-4)'
            }}>
                <button onClick={() => navigate(-1)} style={{ padding: 'var(--space-1)' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: 'var(--text-xl)' }}>Add Equipment</h1>
            </header>

            <div className="card">
                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-5)' }}>

                    {/* Photo Upload */}
                    <div>
                        <label className="label">Equipment Photo *</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoSelect}
                            style={{ display: 'none' }}
                        />

                        {photoPreview ? (
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    style={{
                                        width: '100%',
                                        height: '200px',
                                        objectFit: 'cover',
                                        borderRadius: '12px',
                                        border: '2px solid var(--color-border)'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '100%',
                                    height: '160px',
                                    border: '2px dashed var(--color-border)',
                                    borderRadius: '12px',
                                    background: 'var(--color-bg-surface)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-secondary)'
                                }}
                            >
                                <Camera size={32} />
                                <span>Take or upload photo</span>
                                <span style={{ fontSize: '11px' }}>This will be the reference condition</span>
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="label">Name *</label>
                        <input
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="e.g. Sony A7S III"
                        />
                    </div>

                    <div>
                        <label className="label">Category</label>
                        <select
                            className="input"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                        >
                            <option>Camera</option>
                            <option>Lens</option>
                            <option>Light</option>
                            <option>Audio</option>
                            <option>Grip</option>
                            <option>Cable</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Quantity</label>
                        <input
                            type="number"
                            className="input"
                            min="1"
                            value={formData.total_quantity}
                            onChange={e => setFormData({ ...formData, total_quantity: parseInt(e.target.value) })}
                            required
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <label className="label" style={{ marginBottom: 0 }}>SKU / ID (Optional)</label>
                            <div
                                title="A unique ID will be auto-generated for each physical unit based on this prefix"
                                style={{
                                    cursor: 'help',
                                    color: 'var(--color-text-tertiary)'
                                }}
                            >
                                <HelpCircle size={14} />
                            </div>
                        </div>
                        <input
                            className="input"
                            value={formData.sku}
                            onChange={e => setFormData({ ...formData, sku: e.target.value })}
                            placeholder="e.g. CAM-001"
                            style={{ marginTop: '4px' }}
                        />
                        <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                            Unique tracking IDs will be auto-generated for each unit (e.g., CAM-001-A1B2)
                        </p>
                    </div>

                    <div>
                        <label className="label">Remarks / Notes (Optional)</label>
                        <textarea
                            className="input"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="e.g. Sent for sensor cleaning in June, has a scratch on the side..."
                            style={{
                                minHeight: '100px',
                                resize: 'vertical',
                                padding: 'var(--space-2) var(--space-3)',
                                lineHeight: '1.5'
                            }}
                        />
                    </div>

                    <button type="submit" className="btn" disabled={loading} style={{ marginTop: 'var(--space-2)', height: '52px' }}>
                        {loading ? 'Adding...' : 'Add Equipment'}
                    </button>
                </form>
            </div>
        </div>
    )
}
