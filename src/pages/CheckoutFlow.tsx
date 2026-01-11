import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Check, X, Package, ShoppingCart, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Scanner from '../components/Scanner'
import '../styles/components.css'

interface CartItem {
    unitId: string
    equipmentId: string
    code: string
    equipmentName: string
    photoUrl: string | null
    photoFile: File | null
}

type FlowStep = 'scan' | 'confirm-item' | 'photo' | 'cart' | 'success'
type Mode = 'checkout' | 'checkin'

export default function CheckoutFlow() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [mode, setMode] = useState<Mode>('checkout')
    const [step, setStep] = useState<FlowStep>('scan')
    const [cart, setCart] = useState<CartItem[]>([])
    const [currentItem, setCurrentItem] = useState<CartItem | null>(null)
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)

    const studioId = localStorage.getItem('active_studio_id')

    const handleScan = async (code: string) => {
        setError(null)
        setProcessing(true)

        try {
            // Parse QR payload
            let unitId = code
            try {
                const parsed = JSON.parse(code)
                if (parsed.item) unitId = parsed.item
            } catch {
                // It's a raw unit code, search by code
            }

            // Find the equipment item
            const { data: unit, error: unitError } = await supabase
                .from('equipment_items')
                .select('*, equipment(id, name, photo_url)')
                .or(`id.eq.${unitId},code.eq.${code}`)
                .single()

            if (unitError || !unit) {
                setError('Item not found. Make sure you are scanning a valid label.')
                setProcessing(false)
                return
            }

            // Check if already in cart
            if (cart.some(c => c.unitId === unit.id)) {
                setError('This item is already in your cart.')
                setProcessing(false)
                return
            }

            // Check item status
            if (mode === 'checkout' && unit.status !== 'available') {
                setError('This item is already checked out.')
                setProcessing(false)
                return
            }

            if (mode === 'checkin' && unit.status === 'available') {
                setError('This item is not currently checked out.')
                setProcessing(false)
                return
            }

            // Set current item and move to confirm
            setCurrentItem({
                unitId: unit.id,
                equipmentId: unit.equipment.id,
                code: unit.code,
                equipmentName: unit.equipment.name,
                photoUrl: null,
                photoFile: null
            })
            setStep('confirm-item')

        } catch (err) {
            console.error('Scan error:', err)
            setError('Failed to process scan. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && currentItem) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
            setCurrentItem({ ...currentItem, photoFile: file })
        }
    }

    const confirmPhoto = () => {
        if (!currentItem || !currentItem.photoFile) return

        setCart([...cart, { ...currentItem, photoUrl: photoPreview }])
        setCurrentItem(null)
        setPhotoPreview(null)
        setStep('scan')
    }

    const removeFromCart = (unitId: string) => {
        setCart(cart.filter(c => c.unitId !== unitId))
    }

    const proceedToCart = () => {
        if (cart.length === 0) {
            setError('Add at least one item to proceed.')
            return
        }
        setStep('cart')
    }

    const confirmTransaction = async () => {
        if (!user || !studioId || cart.length === 0) return

        setProcessing(true)
        try {
            for (const item of cart) {
                // 1. Upload photo if exists
                let photoUrl = null
                if (item.photoFile) {
                    const fileExt = item.photoFile.name.split('.').pop()
                    const fileName = `${studioId}/${item.unitId}/${Date.now()}.${fileExt}`

                    await supabase.storage
                        .from('transaction-photos')
                        .upload(fileName, item.photoFile)

                    const { data: urlData } = supabase.storage
                        .from('transaction-photos')
                        .getPublicUrl(fileName)

                    photoUrl = urlData.publicUrl
                }

                // 2. Create transaction record
                await supabase.from('transactions').insert({
                    studio_id: studioId,
                    equipment_id: item.equipmentId,
                    equipment_item_id: item.unitId,
                    user_id: user.id,
                    type: mode,
                    quantity: 1,
                    photo_url: photoUrl
                })

                // 3. Update equipment_item status
                const newStatus = mode === 'checkout' ? 'checked_out' : 'available'
                await supabase
                    .from('equipment_items')
                    .update({ status: newStatus })
                    .eq('id', item.unitId)

                // 4. Update equipment available_quantity
                const delta = mode === 'checkout' ? -1 : 1
                const { data: equip } = await supabase
                    .from('equipment')
                    .select('available_quantity')
                    .eq('id', item.equipmentId)
                    .single()

                if (equip) {
                    await supabase
                        .from('equipment')
                        .update({ available_quantity: equip.available_quantity + delta })
                        .eq('id', item.equipmentId)
                }
            }

            setStep('success')
        } catch (err) {
            console.error('Transaction error:', err)
            setError('Failed to complete transaction. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                paddingTop: 'var(--space-4)'
            }}>
                <button onClick={() => step === 'scan' ? navigate('/') : setStep('scan')} style={{ padding: 'var(--space-1)' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: 'var(--text-xl)' }}>
                    {mode === 'checkout' ? 'Check Out' : 'Check In'}
                </h1>
            </header>

            {/* Mode Toggle */}
            {step === 'scan' && (
                <div style={{ display: 'flex', background: 'var(--color-bg-surface)', padding: '4px', borderRadius: '12px', marginBottom: 'var(--space-4)' }}>
                    <button
                        onClick={() => setMode('checkout')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: mode === 'checkout' ? 'var(--color-brand)' : 'transparent',
                            color: mode === 'checkout' ? 'white' : 'var(--color-text-secondary)'
                        }}
                    >
                        Check Out
                    </button>
                    <button
                        onClick={() => setMode('checkin')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: mode === 'checkin' ? 'var(--color-brand)' : 'transparent',
                            color: mode === 'checkin' ? 'white' : 'var(--color-text-secondary)'
                        }}
                    >
                        Check In
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: 'var(--space-3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    marginBottom: 'var(--space-4)',
                    color: '#ef4444',
                    fontSize: 'var(--text-sm)'
                }}>
                    <AlertCircle size={16} />
                    {error}
                    <button onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* STEP: Scan */}
            {step === 'scan' && (
                <>
                    <Scanner onScan={handleScan} />

                    {cart.length > 0 && (
                        <div style={{ marginTop: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                    {cart.length} item(s) in cart
                                </span>
                                <button
                                    onClick={proceedToCart}
                                    className="btn"
                                    style={{ padding: '8px 16px' }}
                                >
                                    <ShoppingCart size={16} />
                                    View Cart
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* STEP: Confirm Item */}
            {step === 'confirm-item' && currentItem && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <Package size={48} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-brand)' }} />
                    <h2 style={{ marginBottom: 'var(--space-2)' }}>{currentItem.equipmentName}</h2>
                    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                        {currentItem.code}
                    </p>

                    <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                        Please take a photo of the current condition
                    </p>

                    <button className="btn" onClick={() => { setStep('photo'); fileInputRef.current?.click(); }}>
                        <Camera size={18} />
                        Take Photo
                    </button>
                </div>
            )}

            {/* STEP: Photo Capture */}
            {step === 'photo' && (
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        style={{ display: 'none' }}
                    />

                    {photoPreview ? (
                        <>
                            <img
                                src={photoPreview}
                                alt="Condition"
                                style={{
                                    width: '100%',
                                    height: '300px',
                                    objectFit: 'cover',
                                    borderRadius: '12px',
                                    marginBottom: 'var(--space-4)'
                                }}
                            />
                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => { setPhotoPreview(null); fileInputRef.current?.click(); }}
                                    style={{ flex: 1 }}
                                >
                                    Retake
                                </button>
                                <button
                                    className="btn"
                                    onClick={confirmPhoto}
                                    style={{ flex: 1 }}
                                >
                                    <Check size={18} />
                                    Confirm
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '100%',
                                height: '200px',
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
                            <span>Tap to capture</span>
                        </button>
                    )}
                </div>
            )}

            {/* STEP: Cart Review */}
            {step === 'cart' && (
                <>
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>
                        {mode === 'checkout' ? 'Items to Check Out' : 'Items to Return'}
                    </h3>

                    <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                        {cart.map(item => (
                            <div key={item.unitId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)' }}>
                                {item.photoUrl && (
                                    <img
                                        src={item.photoUrl}
                                        alt="Condition"
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{item.equipmentName}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{item.code}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.photoFile && <Check size={16} color="#22c55e" />}
                                    <button onClick={() => removeFromCart(item.unitId)} style={{ padding: '4px', color: '#ef4444' }}>
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button className="btn btn-secondary" onClick={() => setStep('scan')} style={{ flex: 1 }}>
                            Add More
                        </button>
                        <button
                            className="btn"
                            onClick={confirmTransaction}
                            disabled={processing}
                            style={{ flex: 1 }}
                        >
                            {processing ? 'Processing...' : `Confirm ${mode === 'checkout' ? 'Checkout' : 'Return'}`}
                        </button>
                    </div>
                </>
            )}

            {/* STEP: Success */}
            {step === 'success' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)'
                    }}>
                        <Check size={32} color="#22c55e" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-2)' }}>
                        {mode === 'checkout' ? 'Checked Out!' : 'Returned!'}
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                        {cart.length} item(s) successfully {mode === 'checkout' ? 'checked out' : 'returned'}.
                    </p>
                    <button className="btn" onClick={() => navigate('/')}>
                        Back to Dashboard
                    </button>
                </div>
            )}
        </div>
    )
}
