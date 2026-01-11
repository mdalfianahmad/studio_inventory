import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Filter, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import '../styles/components.css'

interface Transaction {
    id: string
    type: 'checkout' | 'checkin'
    created_at: string
    user_id: string
    photo_url: string | null
    equipment: {
        name: string
    }
    equipment_items: {
        code: string
    } | null
}

export default function ActivityLog() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [isOwner, setIsOwner] = useState(false)
    const [filter, setFilter] = useState<'all' | 'checkout' | 'checkin'>('all')
    const [showFilters, setShowFilters] = useState(false)

    const studioId = localStorage.getItem('active_studio_id')

    useEffect(() => {
        if (studioId && user) {
            checkOwnership()
            loadActivity()
        }
    }, [studioId, user])

    async function checkOwnership() {
        if (!studioId || !user) return

        const { data: studio } = await supabase
            .from('studios')
            .select('owner_id')
            .eq('id', studioId)
            .single()

        setIsOwner(studio?.owner_id === user.id)
    }

    async function loadActivity() {
        if (!studioId || !user) return
        setLoading(true)

        try {
            let query = supabase
                .from('transactions')
                .select(`
                    id, type, created_at, user_id, photo_url,
                    equipment (name),
                    equipment_items (code)
                `)
                .eq('studio_id', studioId)
                .order('created_at', { ascending: false })
                .limit(50)

            // If not owner, only show user's own transactions
            if (!isOwner) {
                query = query.eq('user_id', user.id)
            }

            // Apply type filter
            if (filter !== 'all') {
                query = query.eq('type', filter)
            }

            const { data, error } = await query

            if (error) throw error
            setTransactions(data as any || [])
        } catch (error) {
            console.error('Error loading activity:', error)
        } finally {
            setLoading(false)
        }
    }

    // Reload when filter or ownership changes
    useEffect(() => {
        if (studioId && user) {
            loadActivity()
        }
    }, [filter, isOwner])

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-12)' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
            </div>
        )
    }

    return (
        <div className="container" style={{ paddingBottom: 'var(--space-12)' }}>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-4)',
                paddingTop: 'var(--space-4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button onClick={() => navigate('/')} style={{ padding: 'var(--space-1)' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: 'var(--text-xl)' }}>
                        {isOwner ? 'All Activity' : 'My Activity'}
                    </h1>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px' }}
                >
                    <Filter size={16} />
                    <ChevronDown size={14} />
                </button>
            </header>

            {/* Filter Dropdown */}
            {showFilters && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-2)' }}>
                    {['all', 'checkout', 'checkin'].map(f => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f as any); setShowFilters(false); }}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: 'var(--space-3)',
                                textAlign: 'left',
                                border: 'none',
                                background: filter === f ? 'var(--color-bg-surface)' : 'transparent',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: filter === f ? 600 : 400,
                                textTransform: 'capitalize'
                            }}
                        >
                            {f === 'all' ? 'All Transactions' : f === 'checkout' ? 'Check Outs' : 'Returns'}
                        </button>
                    ))}
                </div>
            )}

            {/* Info Banner for Non-Owners */}
            {!isOwner && (
                <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--color-bg-surface)',
                    borderRadius: '8px',
                    marginBottom: 'var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)'
                }}>
                    Showing only your personal activity
                </div>
            )}

            {/* Transactions List */}
            {transactions.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {transactions.map(t => (
                        <div
                            key={t.id}
                            className="card"
                            style={{
                                padding: 'var(--space-4)',
                                borderLeft: `4px solid ${t.type === 'checkout' ? '#ef4444' : '#22c55e'}`
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                        {t.equipment?.name || 'Unknown Equipment'}
                                    </div>
                                    {t.equipment_items && (
                                        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                                            {t.equipment_items.code}
                                        </div>
                                    )}
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '8px',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: t.type === 'checkout' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                        color: t.type === 'checkout' ? '#ef4444' : '#22c55e'
                                    }}>
                                        {t.type === 'checkout' ? 'Checked Out' : 'Returned'}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    {t.photo_url && (
                                        <img
                                            src={t.photo_url}
                                            alt="Condition"
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                objectFit: 'cover',
                                                borderRadius: '6px',
                                                marginBottom: '4px'
                                            }}
                                        />
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-tertiary)', justifyContent: 'flex-end' }}>
                                        <Clock size={12} />
                                        {new Date(t.created_at).toLocaleString([], {
                                            dateStyle: 'short',
                                            timeStyle: 'short'
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-secondary)' }}>
                    No activity to show yet.
                </div>
            )}
        </div>
    )
}
