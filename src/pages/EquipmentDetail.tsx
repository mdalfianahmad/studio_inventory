import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Trash2, Edit2, User, CheckCircle2, Clock, Download, Image as ImageIcon } from 'lucide-react'
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

    if (loading) return <div className="container" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>Loading Details...</div>
    if (!item) return <div className="container" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>Item not found</div>

    const availableUnits = physicalUnits.filter(u => u.status === 'available')
    const checkedOutUnits = physicalUnits.filter(u => u.status !== 'available')

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-6)',
                paddingTop: 'var(--space-4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button onClick={() => navigate('/equipment')} style={{ padding: 'var(--space-1)' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: 'var(--text-xl)' }}>Item Details</h1>
                </div>

                {isOwner && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-secondary" onClick={() => navigate(`/equipment/${id}/edit`)}>
                            <Edit2 size={18} />
                        </button>
                        <button className="btn btn-secondary" onClick={handleDelete} style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
            </header>

            {/* Equipment Photo & Info - VISIBLE TO ALL */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                {item.photo_url ? (
                    <img
                        src={item.photo_url}
                        alt={item.name}
                        style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            marginBottom: 'var(--space-4)'
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '120px',
                        background: 'var(--color-bg-surface)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <ImageIcon size={40} />
                    </div>
                )}

                <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-1)' }}>{item.name}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{item.category}</p>
                    {item.sku && (
                        <div style={{ fontSize: 'var(--text-xs)', background: 'var(--color-bg-base)', padding: '4px 10px', borderRadius: '6px', fontFamily: 'var(--font-mono)', border: '1px solid var(--color-border)' }}>
                            {item.sku}
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--color-bg-surface)', borderRadius: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Available</div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e' }}>{item.available_quantity}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total</div>
                        <div style={{ fontSize: '28px', fontWeight: 800 }}>{item.total_quantity}</div>
                    </div>
                </div>
            </div>

            {/* OWNER ONLY: Available Units with QR/Barcode */}
            {isOwner && (
                <section style={{ marginBottom: 'var(--space-10)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontWeight: 800, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} />
                            AVAILABLE UNITS ({availableUnits.length})
                        </h3>

                        <div style={{ display: 'flex', background: 'var(--color-bg-surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <button
                                onClick={() => setViewMode('qr')}
                                style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', border: 'none', background: viewMode === 'qr' ? 'var(--color-brand)' : 'transparent', color: viewMode === 'qr' ? 'white' : 'var(--color-text-secondary)', cursor: 'pointer' }}
                            >
                                QR
                            </button>
                            <button
                                onClick={() => setViewMode('barcode')}
                                style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', border: 'none', background: viewMode === 'barcode' ? 'var(--color-brand)' : 'transparent', color: viewMode === 'barcode' ? 'white' : 'var(--color-text-secondary)', cursor: 'pointer' }}
                            >
                                BAR
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                        {availableUnits.map((unit, index) => (
                            <div key={unit.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>Unit #{index + 1}</div>
                                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{unit.code}</div>
                                </div>

                                <div style={{
                                    background: 'white',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: '1px solid #eee',
                                    textAlign: 'center'
                                }}>
                                    <img
                                        src={unitCodes[unit.id]}
                                        alt="Code"
                                        style={{ height: viewMode === 'barcode' ? '40px' : '64px', display: 'block' }}
                                    />
                                    {viewMode === 'qr' && (
                                        <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{unit.code}</div>
                                    )}
                                </div>

                                <button
                                    onClick={() => downloadLabel(unit.id, unit.code)}
                                    className="btn btn-secondary"
                                    style={{ padding: '8px' }}
                                    title="Download as PNG"
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        ))}
                        {availableUnits.length === 0 && (
                            <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-8)' }}>
                                No units currently available.
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* EVERYONE: Checked Out Units */}
            <section>
                <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} />
                    CHECKED OUT ({checkedOutUnits.length})
                </h3>

                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {checkedOutUnits.map((unit) => (
                        <div key={unit.id} className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{unit.code}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                        <User size={14} />
                                        <span>Currently with: {unit.last_user_name || 'Team Member'}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                                    <div style={{ fontWeight: 600 }}>TAKEN AT</div>
                                    <div>{unit.last_checkout_at ? new Date(unit.last_checkout_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {checkedOutUnits.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-8)' }}>
                            All units are in studio.
                        </div>
                    )}
                </div>
            </section>

            {isOwner && availableUnits.length > 0 && (
                <div style={{ marginTop: 'var(--space-10)' }}>
                    <button className="btn" onClick={() => navigate('/equipment/print-all')} style={{ width: '100%' }}>
                        <Printer size={18} />
                        Print All Studio Labels
                    </button>
                </div>
            )}
        </div>
    )
}
