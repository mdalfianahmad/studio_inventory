import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Box, Download, Check, Square, CheckSquare, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateItemPayload, generateQRDataURL } from '../utils/qr'
import { generateBarcodeDataURL } from '../utils/barcode'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import '../styles/components.css'

interface EquipmentItem {
    id: string
    code: string
    equipment_id: string
    studio_id: string
}

interface EquipmentWithItems {
    id: string
    name: string
    items: EquipmentItem[]
}

export default function BulkPrintLabels() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [allEquipment, setAllEquipment] = useState<EquipmentWithItems[]>([])
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
    const [unitCodes, setUnitCodes] = useState<Record<string, string>>({})
    const [viewMode, setViewMode] = useState<'qr' | 'barcode'>('qr')
    const [isSaving, setIsSaving] = useState(false)
    const [saveProgress, setSaveProgress] = useState(0)
    const [saveComplete, setSaveComplete] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedEquip, setExpandedEquip] = useState<string[]>([])
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium')
    const gridRef = useRef<HTMLDivElement>(null)

    // Label size configurations (aspect ratio maintained)
    const labelSizes = {
        small: { width: 140, qrSize: 80, fontSize: 9, padding: 8 },
        medium: { width: 180, qrSize: 110, fontSize: 12, padding: 12 },
        large: { width: 240, qrSize: 150, fontSize: 14, padding: 16 }
    }

    const activeStudioId = localStorage.getItem('active_studio_id')

    useEffect(() => {
        if (!activeStudioId) {
            navigate('/onboarding')
            return
        }
        fetchEverything()
    }, [activeStudioId])

    useEffect(() => {
        if (allEquipment.length > 0) {
            generateAllCodes()
        }
    }, [viewMode, allEquipment])

    async function fetchEverything() {
        try {
            setLoading(true)
            const { data: equipment, error: equipError } = await supabase
                .from('equipment')
                .select('id, name')
                .eq('studio_id', activeStudioId)
                .order('name')

            if (equipError) throw equipError

            const { data: items, error: itemsError } = await supabase
                .from('equipment_items')
                .select('*')
                .eq('studio_id', activeStudioId)

            if (itemsError) throw itemsError

            const grouped = (equipment || []).map(e => ({
                ...e,
                items: (items || []).filter(i => i.equipment_id === e.id)
            })).filter(e => e.items.length > 0)

            setAllEquipment(grouped)
            // Default select ALL units
            const allUnitIds = items?.map(i => i.id) || []
            setSelectedUnitIds(allUnitIds)
        } catch (error) {
            console.error('Error fetching bulk print data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function generateAllCodes() {
        const codes: Record<string, string> = {}
        for (const group of allEquipment) {
            for (const unit of group.items) {
                const payload = generateItemPayload(unit.studio_id, unit.id)
                if (viewMode === 'barcode') {
                    codes[unit.id] = generateBarcodeDataURL(unit.code)
                } else {
                    codes[unit.id] = await generateQRDataURL(payload)
                }
            }
        }
        setUnitCodes(codes)
    }

    const toggleUnit = (id: string) => {
        setSelectedUnitIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const toggleGroup = (equip: EquipmentWithItems) => {
        const unitIds = equip.items.map(i => i.id)
        const allSelected = unitIds.every(id => selectedUnitIds.includes(id))

        if (allSelected) {
            // Deselect all in group
            setSelectedUnitIds(prev => prev.filter(id => !unitIds.includes(id)))
        } else {
            // Select all in group
            setSelectedUnitIds(prev => [...new Set([...prev, ...unitIds])])
        }
    }

    const toggleAll = () => {
        const totalUnits = allEquipment.reduce((acc, e) => acc + e.items.length, 0)
        if (selectedUnitIds.length === totalUnits) {
            setSelectedUnitIds([])
        } else {
            const allIds = allEquipment.flatMap(e => e.items.map(i => i.id))
            setSelectedUnitIds(allIds)
        }
    }

    const handleBulkSave = async () => {
        if (!gridRef.current) return
        setIsSaving(true)
        setSaveProgress(0)
        setSaveComplete(false)

        try {
            const zip = new JSZip()
            const labels = gridRef.current.querySelectorAll('.label-card')
            const total = labels.length

            if (total === 0) {
                alert('No labels selected to save.')
                setIsSaving(false)
                return
            }

            for (let i = 0; i < labels.length; i++) {
                const label = labels[i] as HTMLElement
                const canvas = await html2canvas(label, {
                    scale: 3,
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false
                })

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
                if (blob) {
                    const name = label.getAttribute('data-name')?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'label'
                    const unitCode = label.getAttribute('data-code') || i
                    zip.file(`${name}_${unitCode}.png`, blob)
                }
                setSaveProgress(Math.round(((i + 1) / total) * 100))
            }

            const content = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(content)
            const link = document.createElement('a')
            link.href = url
            link.download = `studio_labels_${new Date().getTime()}.zip`
            link.click()
            URL.revokeObjectURL(url)

            setSaveComplete(true)
            setTimeout(() => {
                setIsSaving(false)
                setSaveComplete(false)
            }, 3000)
        } catch (error) {
            console.error('Save failed:', error)
            alert('Failed to save labels.')
            setIsSaving(false)
        }
    }

    const filteredList = allEquipment.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Preview grid only shows selected units
    const previewData = allEquipment.map(group => ({
        ...group,
        items: group.items.filter(i => selectedUnitIds.includes(i.id))
    })).filter(group => group.items.length > 0)

    const totalAvailableUnits = allEquipment.reduce((acc, e) => acc + e.items.length, 0)

    if (loading) return <div className="container" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>Preparing Labels...</div>

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            <header className="no-print" style={{
                marginBottom: 'var(--space-6)',
                paddingTop: 'var(--space-4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button className="btn btn-secondary" onClick={() => navigate('/equipment')} style={{ padding: '8px', borderRadius: '10px' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Bulk Label Export</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        {/* QR/Barcode Toggle */}
                        <div style={{ display: 'flex', background: 'var(--color-bg-surface-hover)', padding: '3px', borderRadius: '12px', marginRight: '6px' }}>
                            <button
                                onClick={() => setViewMode('qr')}
                                style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '9px', border: 'none', background: viewMode === 'qr' ? 'white' : 'transparent', color: viewMode === 'qr' ? 'var(--color-brand)' : 'var(--color-text-secondary)', cursor: 'pointer', boxShadow: viewMode === 'qr' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                            >
                                QR
                            </button>
                            <button
                                onClick={() => setViewMode('barcode')}
                                style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '9px', border: 'none', background: viewMode === 'barcode' ? 'white' : 'transparent', color: viewMode === 'barcode' ? 'var(--color-brand)' : 'var(--color-text-secondary)', cursor: 'pointer', boxShadow: viewMode === 'barcode' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                            >
                                Barcode
                            </button>
                        </div>
                        {/* Label Size Selector */}
                        <div style={{ display: 'flex', background: 'var(--color-bg-surface-hover)', padding: '3px', borderRadius: '12px', marginRight: '6px' }}>
                            {(['small', 'medium', 'large'] as const).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setLabelSize(size)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        borderRadius: '9px',
                                        border: 'none',
                                        background: labelSize === size ? 'white' : 'transparent',
                                        color: labelSize === size ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                                        cursor: 'pointer',
                                        boxShadow: labelSize === size ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                    }}
                                >
                                    {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-secondary" onClick={handleBulkSave} disabled={isSaving || selectedUnitIds.length === 0} style={{ padding: '10px 16px' }}>
                            {saveComplete ? <Check size={18} /> : <Download size={18} />}
                            <span style={{ marginLeft: '6px' }}>{isSaving ? `Exporting ${saveProgress}%` : saveComplete ? 'Exported!' : 'Export Images'}</span>
                        </button>
                        <button className="btn" onClick={() => window.print()} disabled={selectedUnitIds.length === 0} style={{ padding: '10px 16px' }}>
                            <Printer size={18} />
                            <span style={{ marginLeft: '6px' }}>Print</span>
                        </button>
                    </div>
                </div>

                <div className="card" style={{
                    padding: 'var(--space-4)',
                    borderRadius: '20px',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <div>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-brand)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Select Labels for Export</span>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{selectedUnitIds.length} label{selectedUnitIds.length !== 1 ? 's' : ''} selected</div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                <input
                                    placeholder="Filter gear..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        fontSize: '12px', padding: '6px 8px 6px 28px', borderRadius: '8px', border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-base)', width: '120px'
                                    }}
                                />
                            </div>
                            <button onClick={toggleAll} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-brand)', background: 'var(--color-brand-light)', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                                {selectedUnitIds.length === totalAvailableUnits ? 'Clear' : 'Select All'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                        {filteredList.map(item => {
                            const groupSelectedCount = item.items.filter(i => selectedUnitIds.includes(i.id)).length
                            const isAllSelected = groupSelectedCount === item.items.length
                            const isExpanded = expandedEquip.includes(item.id)
                            const hasSelection = groupSelectedCount > 0

                            return (
                                <div key={item.id} style={{ width: '100%', marginBottom: '4px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', borderRadius: '12px',
                                        background: isAllSelected ? 'var(--color-brand-light)' : (hasSelection ? 'var(--color-bg-surface-hover)' : 'var(--color-bg-base)'),
                                        border: '1px solid',
                                        borderColor: isAllSelected ? 'var(--color-brand)' : (hasSelection ? 'var(--color-brand-light)' : 'var(--color-border)'),
                                        transition: 'all 0.1s ease'
                                    }}>
                                        <button
                                            onClick={() => toggleGroup(item)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0 }}
                                        >
                                            <div style={{ color: isAllSelected ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}>
                                                {isAllSelected ? <CheckSquare size={18} /> : (hasSelection ? <Square size={18} style={{ opacity: 0.5 }} /> : <Square size={18} />)}
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: (isAllSelected || hasSelection) ? 700 : 500, color: 'var(--color-text-primary)' }}>
                                                {item.name}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 500, background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                                {groupSelectedCount}/{item.items.length}
                                            </span>
                                        </button>

                                        {item.items.length > 1 && (
                                            <button
                                                onClick={() => setExpandedEquip(prev => isExpanded ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                                style={{ background: isExpanded ? 'var(--color-brand-light)' : 'none', border: 'none', color: isExpanded ? 'var(--color-brand)' : 'var(--color-text-tertiary)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        )}
                                    </div>

                                    {(isExpanded || (item.items.length === 1 && searchQuery)) && item.items.length > 0 && (
                                        <div style={{
                                            display: 'flex', flexWrap: 'wrap', gap: '8px',
                                            padding: '8px 12px 6px 42px',
                                            animation: 'fadeIn 0.2s ease-out'
                                        }}>
                                            {item.items.map((unit, idx) => {
                                                const isUnitSelected = selectedUnitIds.includes(unit.id)
                                                return (
                                                    <button
                                                        key={unit.id}
                                                        onClick={() => toggleUnit(unit.id)}
                                                        style={{
                                                            fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px',
                                                            border: '1px solid',
                                                            borderColor: isUnitSelected ? 'var(--color-brand)' : 'var(--color-border)',
                                                            background: isUnitSelected ? 'var(--color-brand)' : 'transparent',
                                                            color: isUnitSelected ? 'white' : 'var(--color-text-secondary)',
                                                            cursor: 'pointer', transition: 'all 0.1s ease'
                                                        }}
                                                    >
                                                        Unit {idx + 1}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </header>

            <div ref={gridRef} className="print-grid" style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${labelSizes[labelSize].width}px, 1fr))`,
                gap: 'var(--space-4)',
                background: 'white',
                padding: 'var(--space-4)'
            }}>
                {previewData.map(group => (
                    group.items.map((unit) => {
                        const originalIndex = allEquipment.find(e => e.id === group.id)?.items.findIndex(i => i.id === unit.id) ?? 0
                        const sizeConfig = labelSizes[labelSize]
                        return (
                            <div
                                key={unit.id}
                                className="label-card"
                                data-name={group.name}
                                data-code={unit.code}
                                style={{
                                    border: '1px solid #eee',
                                    padding: `${sizeConfig.padding}px`,
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    pageBreakInside: 'avoid',
                                    background: 'white',
                                    minWidth: `${sizeConfig.width - 20}px`
                                }}
                            >
                                <div style={{
                                    fontSize: `${Math.max(9, sizeConfig.fontSize - 2)}px`,
                                    fontWeight: 800,
                                    marginBottom: '2px',
                                    textTransform: 'uppercase',
                                    color: '#000'
                                }}>
                                    {group.name}
                                </div>
                                <div style={{
                                    fontSize: `${Math.max(7, sizeConfig.fontSize - 4)}px`,
                                    color: '#666',
                                    marginBottom: `${sizeConfig.padding / 2}px`
                                }}>
                                    UNIT #{originalIndex + 1}
                                </div>
                                <div style={{
                                    border: '1px solid #000',
                                    padding: `${sizeConfig.padding}px`,
                                    background: 'white',
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    minWidth: `${sizeConfig.qrSize + 20}px`
                                }}>
                                    <img
                                        src={unitCodes[unit.id]}
                                        alt="Code"
                                        style={{
                                            width: viewMode === 'qr' ? `${sizeConfig.qrSize}px` : `${sizeConfig.qrSize + 30}px`,
                                            height: 'auto',
                                            display: 'block',
                                            marginBottom: `${sizeConfig.padding / 2}px`
                                        }}
                                    />
                                    <div style={{
                                        fontSize: `${sizeConfig.fontSize}px`,
                                        fontFamily: 'monospace',
                                        fontWeight: 900,
                                        color: '#000000',
                                        letterSpacing: '0.05em',
                                        textAlign: 'center',
                                        width: '100%',
                                        lineHeight: 1
                                    }}>
                                        {unit.code}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ))}
            </div>

            {selectedUnitIds.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <Box size={40} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-4)' }} />
                    <p style={{ color: 'var(--color-text-secondary)' }}>Select specific units above to preview their labels.</p>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media print {
                    .no-print, .bottom-nav { display: none !important; }
                    body { background: white !important; }
                    .container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    .print-grid { 
                        display: grid !important; 
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 15px !important;
                        background: white !important;
                    }
                }
            `}</style>
        </div>
    )
}
