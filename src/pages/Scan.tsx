import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Scanner from '../components/Scanner'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import type { QRPayload } from '../utils/qr'
import { ArrowLeft, CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react'
import '../styles/components.css'

type Equipment = Database['public']['Tables']['equipment']['Row']
type ScanMode = 'checkout' | 'checkin'
type ScanView = 'scanner' | 'confirm' | 'processing' | 'success'

export default function ScanPage() {
    const navigate = useNavigate()
    const [mode, setMode] = useState<ScanMode>('checkout')
    const [view, setView] = useState<ScanView>('scanner')
    const [scannedItem, setScannedItem] = useState<Equipment | null>(null)
    const [scannedUnit, setScannedUnit] = useState<any | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleScan = async (decodedText: string) => {
        if (scannedItem || scannedUnit || view !== 'scanner') return

        try {
            setView('processing')
            let itemId: string | null = null
            let equipmentId: string | null = null

            // 1. Try JSON payload (QR)
            try {
                const payload: QRPayload = JSON.parse(decodedText)
                if (payload.type === 'item') {
                    itemId = payload.id
                } else if (payload.type === 'equipment') {
                    equipmentId = payload.id
                }
            } catch (e) {
                // Not JSON, check raw code
                const { data: itemByCode } = await supabase
                    .from('equipment_items')
                    .select('id')
                    .eq('code', decodedText)
                    .single()

                if (itemByCode) {
                    itemId = itemByCode.id
                } else {
                    equipmentId = decodedText
                }
            }

            // 2. Fetch data
            if (itemId) {
                const { data: unit, error: unitError } = await supabase
                    .from('equipment_items')
                    .select('*, equipment(*)')
                    .eq('id', itemId)
                    .single()

                if (unitError || !unit) throw new Error('Physical unit not found')

                setScannedUnit(unit)
                setScannedItem(unit.equipment)
                setQuantity(1)
                setView('confirm')
            } else if (equipmentId) {
                const { data, error } = await supabase
                    .from('equipment')
                    .select('*')
                    .eq('id', equipmentId)
                    .single()

                if (error || !data) throw new Error('Equipment template not found')
                setScannedItem(data)
                setScannedUnit(null)
                setView('confirm')
            }
        } catch (error: any) {
            console.error('Scan error:', error)
            setMessage({ type: 'error', text: error.message || 'Invalid code or item not found.' })
            setView('scanner')
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const handleConfirm = async (navigateHome: boolean = false) => {
        if (!scannedItem) return
        setView('processing')

        try {
            const { user } = (await supabase.auth.getUser()).data
            if (!user) throw new Error('User not logged in')

            const studioId = scannedItem.studio_id

            if (scannedUnit) {
                if (mode === 'checkout' && scannedUnit.status === 'checked_out') {
                    throw new Error('Item is already checked out')
                }
                if (mode === 'checkin' && scannedUnit.status === 'available') {
                    throw new Error('Item is already in studio')
                }

                const newStatus = mode === 'checkout' ? 'checked_out' : 'available'

                await supabase
                    .from('equipment_items')
                    .update({ status: newStatus })
                    .eq('id', scannedUnit.id)

                const countAdjustment = mode === 'checkout' ? -1 : 1
                await supabase
                    .from('equipment')
                    .update({ available_quantity: Math.max(0, scannedItem.available_quantity + countAdjustment) })
                    .eq('id', scannedItem.id)

                // Log Transaction (including quantity 1 for consistency)
                await supabase.from('transactions').insert({
                    studio_id: studioId,
                    equipment_id: scannedItem.id,
                    equipment_item_id: scannedUnit.id,
                    user_id: user.id,
                    type: mode,
                    quantity: 1
                })

            } else {
                let newQuantity = scannedItem.available_quantity
                if (mode === 'checkout') {
                    if (quantity > scannedItem.available_quantity) throw new Error('Not enough items available')
                    newQuantity -= quantity
                } else {
                    if (scannedItem.available_quantity + quantity > scannedItem.total_quantity) throw new Error('Return exceeds total')
                    newQuantity += quantity
                }

                await supabase
                    .from('equipment')
                    .update({ available_quantity: newQuantity })
                    .eq('id', scannedItem.id)

                await supabase.from('transactions').insert({
                    studio_id: studioId,
                    equipment_id: scannedItem.id,
                    user_id: user.id,
                    type: mode,
                    quantity: quantity
                })
            }

            if (navigateHome) {
                navigate('/')
            } else {
                setMessage({ type: 'success', text: `Success: ${scannedUnit ? '1 unit' : quantity + ' items'}` })
                setView('success')
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Transaction failed' })
            setView('confirm')
        }
    }

    const nextScan = () => {
        setScannedItem(null)
        setScannedUnit(null)
        setQuantity(1)
        setMessage(null)
        setView('scanner')
    }

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                paddingTop: 'var(--space-4)'
            }}>
                <button onClick={() => navigate('/')} style={{ padding: 'var(--space-1)' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: 'var(--text-xl)' }}>
                    {view === 'confirm' ? 'Confirm Action' : view === 'success' ? 'Confirmed' : 'Scan Equipment'}
                </h1>
            </header>

            {view === 'scanner' && (
                <>
                    <div style={{ display: 'flex', marginBottom: 'var(--space-6)', background: 'var(--color-bg-surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                        <button
                            className={`btn ${mode === 'checkout' ? '' : 'btn-secondary'}`}
                            style={{ flex: 1, borderRadius: '8px', height: '44px' }}
                            onClick={() => { setMode('checkout'); nextScan(); }}
                        >
                            Check Out
                        </button>
                        <button
                            className={`btn ${mode === 'checkin' ? '' : 'btn-secondary'}`}
                            style={{ flex: 1, borderRadius: '8px', height: '44px' }}
                            onClick={() => { setMode('checkin'); nextScan(); }}
                        >
                            Check In
                        </button>
                    </div>

                    {message && message.type === 'error' && (
                        <div className="card text-error" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <XCircle size={20} />
                            {message.text}
                        </div>
                    )}

                    <div className="card" style={{ padding: '0', overflow: 'hidden', position: 'relative' }}>
                        <Scanner onScan={handleScan} />
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                            Scan {mode === 'checkout' ? 'to take out' : 'to return in'}
                        </div>
                    </div>
                </>
            )}

            {view === 'confirm' && scannedItem && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div style={{
                        display: 'inline-flex',
                        padding: '12px',
                        borderRadius: '50%',
                        background: mode === 'checkout' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: mode === 'checkout' ? '#ef4444' : '#22c55e',
                        marginBottom: 'var(--space-4)'
                    }}>
                        {mode === 'checkout' ? <ArrowRight size={32} /> : <ArrowLeft size={32} />}
                    </div>

                    <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: '4px' }}>{scannedItem.name}</h2>
                    {scannedUnit && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-brand)', marginBottom: 'var(--space-6)' }}>
                            ID: {scannedUnit.code}
                        </div>
                    )}

                    {!scannedUnit && (
                        <div style={{ marginBottom: 'var(--space-8)' }}>
                            <label className="label">Quantity</label>
                            <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: '56px', height: '56px', fontSize: '24px' }}>-</button>
                                <span style={{ fontSize: '32px', fontWeight: 700 }}>{quantity}</span>
                                <button className="btn btn-secondary" onClick={() => {
                                    const max = mode === 'checkout' ? scannedItem.available_quantity : (scannedItem.total_quantity - scannedItem.available_quantity);
                                    setQuantity(Math.min(max || 1, quantity + 1))
                                }} style={{ width: '56px', height: '56px', fontSize: '24px' }}>+</button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <button className="btn" onClick={() => handleConfirm(false)} style={{ height: '60px', fontSize: '18px' }}>
                            Confirm & Next Scan
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleConfirm(true)}>
                            Confirm & Finish
                        </button>
                        <button className="btn btn-secondary" onClick={nextScan} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)' }}>
                            Discard & Cancel
                        </button>
                    </div>
                </div>
            )}

            {view === 'success' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <div style={{ color: '#22c55e', marginBottom: 'var(--space-4)' }}>
                        <CheckCircle size={64} style={{ margin: '0 auto' }} />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-2)' }}>Success!</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-8)' }}>
                        Item has been {mode === 'checkout' ? 'checked out' : 'returned'}.
                    </p>

                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <button className="btn" onClick={nextScan} style={{ height: '56px' }}>
                            Scan Next Item
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                            <Home size={18} />
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            )}

            {view === 'processing' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
                    <p>Processing...</p>
                </div>
            )}
        </div>
    )
}
