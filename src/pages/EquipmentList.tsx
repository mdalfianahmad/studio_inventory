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

    const getStockStatus = (available: number, total: number) => {
        if (available === 0) return 'out-of-stock'
        if (available <= total * 0.25) return 'low-stock'
        return 'in-stock'
    }

    return (
        <div style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-12)' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center', /* Changed from flex-start for better alignment */
                marginBottom: 'var(--space-6)'
            }}>
                <div>
                    <h1 style={{ marginBottom: '0px', fontSize: 'var(--text-2xl)' }}>Equipment</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                        {items.length} item{items.length !== 1 ? 's' : ''} in inventory
                    </p>
                </div>
                {isOwner && (
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Link
                            to="/equipment/print-all"
                            className="btn btn-secondary"
                            style={{ padding: '0 var(--space-4)', height: '42px' }}
                        >
                            <Printer size={18} />
                            <span>Labels</span>
                        </Link>
                        <Link
                            to="/equipment/add"
                            className="btn"
                            style={{ padding: '0 var(--space-4)', height: '42px' }}
                        >
                            <Plus size={18} />
                            <span>Add</span>
                        </Link>
                    </div>
                )}
            </header>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 'var(--space-8)' }}>
                <Search
                    size={18}
                    style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-tertiary)',
                        pointerEvents: 'none'
                    }}
                />
                <input
                    className="input"
                    placeholder="Search equipment..."
                    style={{ paddingLeft: '42px' }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                        Loading inventory...
                    </p>
                </div>
            ) : filteredItems.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {filteredItems.map(item => (
                        <Link
                            to={`/equipment/${item.id}`}
                            key={item.id}
                            className="card equipment-item"
                        >
                            <div className="equipment-thumb">
                                {item.photo_url ? (
                                    <img src={item.photo_url} alt={item.name} />
                                ) : (
                                    <Box size={22} />
                                )}
                            </div>
                            <div className="equipment-info">
                                <div className="equipment-name">{item.name}</div>
                                <div className="equipment-category">{item.category}</div>
                            </div>
                            <div className="equipment-count">
                                <div className={`equipment-available ${getStockStatus(item.available_quantity, item.total_quantity)}`}>
                                    {item.available_quantity}/{item.total_quantity}
                                </div>
                                <div className="equipment-total">available</div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Box size={40} className="empty-state-icon" />
                    <p className="empty-state-text">
                        {search ? 'No matching equipment found' : 'No equipment yet. Add some gear!'}
                    </p>
                </div>
            )}
        </div>
    )
}
