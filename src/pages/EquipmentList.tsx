import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Box, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Database } from '../types/database.types'
import '../styles/components.css'

type Equipment = Database['public']['Tables']['equipment']['Row']

export default function EquipmentList() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [items, setItems] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isOwner, setIsOwner] = useState(false)

    const activeStudioId = localStorage.getItem('active_studio_id')

    useEffect(() => {
        if (!activeStudioId) {
            navigate('/')
            return
        }
        fetchEquipment()
        checkRole()
    }, [activeStudioId])

    async function checkRole() {
        if (!user || !activeStudioId) return
        const { data: studio } = await supabase
            .from('studios')
            .select('owner_id')
            .eq('id', activeStudioId)
            .single()

        setIsOwner(studio?.owner_id === user.id)
    }

    async function fetchEquipment() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name')

            if (error) throw error
            setItems(data || [])
        } catch (error) {
            console.error('Error loading equipment:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="equipment-page" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <header style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>Equipment</h1>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>Inventory for your active studio</p>
                    </div>
                    {isOwner && (
                        <Link to="/equipment/add" className="btn btn-secondary" style={{
                            padding: '10px',
                            borderRadius: '12px',
                            background: 'var(--color-brand)',
                            color: 'white',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Plus size={20} />
                        </Link>
                    )}
                </div>
                {isOwner && (
                    <Link to="/equipment/print-all" className="btn btn-secondary" style={{ padding: '10px 14px', fontSize: 'var(--text-xs)', fontWeight: 700, borderRadius: '12px' }}>
                        <Printer size={16} />
                        Bulk Labels
                    </Link>
                )}
            </header>

            <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
                <Search className="search-icon" size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-tertiary)'
                }} />
                <input
                    className="input"
                    placeholder="Search name, category, or SKU..."
                    style={{ paddingLeft: '36px', height: '48px', borderRadius: '12px' }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
                    <p style={{ color: 'var(--color-text-tertiary)' }}>Fetching inventory...</p>
                </div>
            ) : (
                <div className="equipment-grid" style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {filteredItems.map(item => (
                        <Link to={`` + `/equipment/${item.id}`} key={item.id} className="card" style={{
                            padding: 'var(--space-4)',
                            textDecoration: 'none',
                            color: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-4)',
                            transition: 'transform 0.1s ease'
                        }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
                                <Box size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 700 }}>{item.name}</span>
                                    <span style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 800,
                                        color: item.available_quantity === 0 ? '#ef4444' : '#22c55e'
                                    }}>
                                        {item.available_quantity} / {item.total_quantity}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                    {item.category}
                                </div>
                            </div>
                        </Link>
                    ))}

                    {filteredItems.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', background: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--color-border)' }}>
                            <Box size={40} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-2)' }} />
                            <p style={{ color: 'var(--color-text-secondary)' }}>Empty inventory. Add some gear!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
