import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Trash2, Edit2, User, CheckCircle2, Clock, Download, Image as ImageIcon, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Database } from '../types/database.types'
import { generateItemPayload, generateQRDataURL } from '../utils/qr'
import { generateBarcodeDataURL } from '../utils/barcode'
import '../styles/components.css'

type Equipment = Database['public']['Tables']['equipment']['Row']
interface EquipmentItem {
    id: string
    code: string
    code_type: 'qr' | 'barcode'
    status: string
    studio_id: string
    photo_url: string | null
    last_user_name?: string
    last_checkout_at?: string
}

export default function EquipmentDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [item, setItem] = useState<Equipment | null>(null)
    const [physicalUnits, setPhysicalUnits] = useState<EquipmentItem[]>([])
    const [unitCodes, setUnitCodes] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'qr' | 'barcode'>('qr')
    const [isOwner, setIsOwner] = useState(false)
    const [uploadingUnitId, setUploadingUnitId] = useState<string | null>(null)

    useEffect(() => {
        if (id) fetchItemData(id)
    }, [id])

    useEffect(() => {
        if (physicalUnits.length > 0 && isOwner) {
            generateAllVisualCodes()
        }
    }, [viewMode, physicalUnits, isOwner])

    async function fetchItemData(itemId: string) {
        try {
            setLoading(true)

            // 1. Fetch Equipment
            const { data: equip, error: equipError } = await supabase
                .from('equipment')
                .select('*')
                .eq('id', itemId)
                .single()

            if (equipError) throw equipError
            setItem(equip)

            // 2. Check Role
            const { data: studio } = await supabase
                .from('studios')
                .select('owner_id')
                .eq('id', equip.studio_id)
                .single()

            setIsOwner(studio?.owner_id === user?.id)

            // 3. Fetch Units
            const { data: units, error: unitsError } = await supabase
                .from('equipment_items')
                .select('*')
                .eq('equipment_id', itemId)

            if (unitsError) throw unitsError

            // 4. Fetch Last Checkout for each unit
            if (units && units.length > 0) {
                const { data: trans } = await supabase
                    .from('transactions')
                    .select('equipment_item_id, type, created_at, user_id')
                    .eq('equipment_id', itemId)
                    .eq('type', 'checkout')
                    .order('created_at', { ascending: false })

                const processedUnits = units.map((u: any) => {
                    const lastCheckout = (trans || []).find(t => t.equipment_item_id === u.id)
                    return {
                        ...u,
                        last_user_name: lastCheckout ? 'Team Member' : undefined,
                        last_checkout_at: lastCheckout?.created_at
                    }
                })
                setPhysicalUnits(processedUnits)

                if (units[0].code_type) setViewMode(units[0].code_type)
            } else {
                setPhysicalUnits([])
            }

        } catch (error) {
            console.error('Error fetching item data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function generateAllVisualCodes() {
        const codes: Record<string, string> = {}
        for (const unit of physicalUnits) {
            if (unit.status !== 'available') continue

            const payload = generateItemPayload(unit.studio_id, unit.id)
            if (viewMode === 'barcode') {
                codes[unit.id] = generateBarcodeDataURL(unit.code)
            } else {
                codes[unit.id] = await generateQRDataURL(payload)
            }
        }
        setUnitCodes(codes)
    }

    const handleDelete = async () => {
        if (!item || !window.confirm('Are you sure you want to delete this equipment and all its units?')) return
        try {
            const { error } = await supabase.from('equipment').delete().eq('id', item.id)
            if (error) throw error
            navigate('/equipment')
        } catch (error) {
            console.error('Error deleting item:', error)
            alert('Failed to delete item')
        }
    }

    const downloadLabel = (unitId: string, code: string) => {
        const dataUrl = unitCodes[unitId]
        if (!dataUrl) return

        const link = document.createElement('a')
        link.download = `${code}.png`
        link.href = dataUrl
        link.click()
    }

    const handleUnitPhotoUpload = async (unitId: string, file: File) => {
        if (!item) return
        setUploadingUnitId(unitId)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${item.studio_id}/items/${unitId}/${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('equipment-photos')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
                .from('equipment-photos')
                .getPublicUrl(fileName)

            const photoUrl = urlData.publicUrl

            const { error: updateError } = await supabase
                .from('equipment_items')
                .update({ photo_url: photoUrl })
                .eq('id', unitId)

            if (updateError) throw updateError

            // Update local state
            setPhysicalUnits(prev => prev.map(u =>
                u.id === unitId ? { ...u, photo_url: photoUrl } : u
            ))
        } catch (error: any) {
            console.error('Error uploading photo:', error)
            alert(`Failed to upload photo: ${error.message}`)
        } finally {
            setUploadingUnitId(null)
        }
    }

    if (loading) return (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
        </div>
    )

    if (!item) return (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>Item not found</p>
        </div>
    )

    const availableUnits = physicalUnits.filter(u => u.status === 'available')
    const checkedOutUnits = physicalUnits.filter(u => u.status !== 'available')

    return (
        <div style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-12)' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-5)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button
                        onClick={() => navigate('/equipment')}
                        className="btn btn-secondary"
                        style={{ padding: 'var(--space-2)' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: 'var(--text-lg)' }}>Details</h1>
                </div>

                {isOwner && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate(`/equipment/${id}/edit`)}
                            style={{ padding: 'var(--space-2)' }}
                        >
                            <Edit2 size={18} />
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleDelete}
                            style={{ padding: 'var(--space-2)', color: 'var(--color-error)' }}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
            </header>

            {/* Equipment Photo & Info */}
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                {item.photo_url ? (
                    <img
                        src={item.photo_url}
                        alt={item.name}
                        style={{
                            width: '100%',
                            height: '180px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)'
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100px',
                        background: 'var(--color-bg-base)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <ImageIcon size={36} />
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '2px' }}>{item.name}</h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{item.category}</p>
                    </div>
                    {item.sku && (
                        <div style={{
                            fontSize: 'var(--text-xs)',
                            background: 'var(--color-bg-base)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-mono)',
                            border: '1px solid var(--color-border)'
                        }}>
                            {item.sku}
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-4)',
                    marginTop: 'var(--space-5)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-base)',
                    borderRadius: 'var(--radius-md)'
                }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-success)' }}>{item.available_quantity}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{item.total_quantity}</div>
                    </div>
                </div>
            </div>

            {/* OWNER ONLY: Available Units with QR/Barcode */}
            {isOwner && (
                <section style={{ marginBottom: 'var(--space-8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <div className="section-header" style={{ marginBottom: 0 }}>
                            <CheckCircle2 size={14} />
                            AVAILABLE ({availableUnits.length})
                        </div>

                        <div style={{ display: 'flex', background: 'var(--color-bg-surface)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                            <button
                                onClick={() => setViewMode('qr')}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: viewMode === 'qr' ? 'var(--color-brand)' : 'transparent',
                                    color: viewMode === 'qr' ? 'white' : 'var(--color-text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                QR
                            </button>
                            <button
                                onClick={() => setViewMode('barcode')}
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                    border: 'none',
                                    background: viewMode === 'barcode' ? 'var(--color-brand)' : 'transparent',
                                    color: viewMode === 'barcode' ? 'white' : 'var(--color-text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                BAR
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        {availableUnits.map((unit, index) => (
                            <div key={unit.id} className="card" style={{ padding: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    {/* Unit Photo */}
                                    <div style={{ position: 'relative' }}>
                                        {unit.photo_url ? (
                                            <img
                                                src={unit.photo_url}
                                                alt={`Unit ${index + 1}`}
                                                style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    objectFit: 'cover',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--color-border)'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: 'var(--radius-md)',
                                                background: 'var(--color-bg-base)',
                                                border: '2px dashed var(--color-border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-text-tertiary)',
                                                cursor: 'pointer'
                                            }}
                                                onClick={() => {
                                                    const input = document.createElement('input')
                                                    input.type = 'file'
                                                    input.accept = 'image/*'
                                                    input.capture = 'environment'
                                                    input.onchange = (e) => {
                                                        const file = (e.target as HTMLInputElement).files?.[0]
                                                        if (file) handleUnitPhotoUpload(unit.id, file)
                                                    }
                                                    input.click()
                                                }}
                                            >
                                                {uploadingUnitId === unit.id ? (
                                                    <div className="loading-spinner" style={{ width: '20px', height: '20px' }}></div>
                                                ) : (
                                                    <Camera size={20} />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Unit #{index + 1}</div>
                                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{unit.code}</div>
                                    </div>

                                    {/* QR/Barcode */}
                                    <div style={{
                                        background: 'white',
                                        padding: '8px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid #000',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <img
                                            src={unitCodes[unit.id]}
                                            alt="Code"
                                            style={{
                                                height: viewMode === 'barcode' ? '40px' : '60px',
                                                width: viewMode === 'barcode' ? 'auto' : '60px',
                                                display: 'block'
                                            }}
                                        />
                                        <div style={{
                                            fontSize: '9px',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 900,
                                            color: '#000',
                                            letterSpacing: '0.02em',
                                            textAlign: 'center'
                                        }}>
                                            {unit.code}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => downloadLabel(unit.id, unit.code)}
                                        className="btn btn-secondary"
                                        style={{ padding: 'var(--space-2)' }}
                                        title="Download Label"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>

                                {!unit.photo_url && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--color-warning)',
                                        background: 'var(--color-warning-light)',
                                        padding: '6px 10px',
                                        borderRadius: 'var(--radius-sm)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <Camera size={12} />
                                        Tap the camera icon to add a photo of this unit
                                    </div>
                                )}
                            </div>
                        ))}
                        {availableUnits.length === 0 && (
                            <div className="empty-state">
                                <p className="empty-state-text">No units currently available.</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* EVERYONE: Checked Out Units */}
            <section>
                <div className="section-header">
                    <Clock size={14} />
                    CHECKED OUT ({checkedOutUnits.length})
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {checkedOutUnits.map((unit) => (
                        <div key={unit.id} className="card" style={{ padding: 'var(--space-3)', borderLeft: '3px solid var(--color-error)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    {unit.photo_url && (
                                        <img
                                            src={unit.photo_url}
                                            alt={unit.code}
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                objectFit: 'cover',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                        />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{unit.code}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                            <User size={12} />
                                            <span>{unit.last_user_name || 'Team Member'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                    <div style={{ fontWeight: 600 }}>TAKEN</div>
                                    <div>{unit.last_checkout_at ? new Date(unit.last_checkout_at).toLocaleDateString() : 'Unknown'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {checkedOutUnits.length === 0 && (
                        <div className="empty-state">
                            <p className="empty-state-text">All units are in studio.</p>
                        </div>
                    )}
                </div>
            </section>

            {isOwner && availableUnits.length > 0 && (
                <div style={{ marginTop: 'var(--space-8)' }}>
                    <button className="btn" onClick={() => navigate('/equipment/print-all')} style={{ width: '100%' }}>
                        <Printer size={18} />
                        Print All Labels
                    </button>
                </div>
            )}

            {/* SPACER: Prevents the bottom nav from blocking the last button */}
            <div style={{ height: '140px' }} aria-hidden="true" />
        </div>
    )
}
