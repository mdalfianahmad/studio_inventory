import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Building2, Package, ChevronRight, Users, Plus, Mail, LogOut } from 'lucide-react'
import '../styles/components.css'

interface Studio {
    id: string
    name: string
    owner_id: string
}

interface Invitation {
    id: string
    studio_id: string
    email: string
    role: string
    status: string
    studios: {
        name: string
    }
}

interface Transaction {
    id: string
    type: 'checkout' | 'checkin'
    created_at: string
    equipment: {
        name: string
    }
}

export default function Dashboard() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [ownedStudios, setOwnedStudios] = useState<Studio[]>([])
    const [memberStudios, setMemberStudios] = useState<any[]>([])
    const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([])
    const [recentActivity, setRecentActivity] = useState<any[]>([])
    const [myCheckouts, setMyCheckouts] = useState<Transaction[]>([])

    useEffect(() => {
        if (user) {
            loadDashboardData()
        }
    }, [user])

    async function loadDashboardData() {
        if (!user) return
        setLoading(true)

        try {
            // 1. Fetch Owned Studios
            const { data: owned } = await supabase
                .from('studios')
                .select('*')
                .eq('owner_id', user.id)

            setOwnedStudios(owned || [])

            // 2. Fetch Member Studios (where not owner)
            const { data: memberOf } = await supabase
                .from('studio_users')
                .select(`
                    role,
                    studios (*)
                `)
                .eq('user_id', user.id)
                .neq('role', 'owner')

            setMemberStudios(memberOf || [])

            // 3. Fetch Pending Invitations for this user's email
            const userEmail = user.email
            if (userEmail) {
                const { data: invites } = await supabase
                    .from('studio_invitations')
                    .select('*, studios(name)')
                    .eq('email', userEmail.toLowerCase())
                    .eq('status', 'pending')

                // Filter out invites for studios the user is ALREADY a member of
                const filteredInvites = (invites || []).filter(inv => {
                    const isAlreadyMember = (memberOf as any[])?.some(m => m.studios?.id === inv.studio_id)
                    const isOwner = owned?.some(o => o.id === inv.studio_id)
                    return !isAlreadyMember && !isOwner
                })

                setPendingInvitations(filteredInvites)
            }

            // 4. Fetch My current checkouts
            const { data: checkouts } = await supabase
                .from('transactions')
                .select(`
                    id, type, created_at,
                    equipment (name)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10)

            setMyCheckouts(checkouts as any || [])

            // 5. If owner, fetch recent activity for their studios
            if (owned && owned.length > 0) {
                const { data: activity } = await supabase
                    .from('transactions')
                    .select(`
                        id, type, created_at,
                        user_id,
                        equipment (name)
                    `)
                    .in('studio_id', owned.map(s => s.id))
                    .order('created_at', { ascending: false })
                    .limit(5)

                setRecentActivity(activity || [])
            }

            // Redirect if absolutely no connection to any studio and no pending invites
            if ((!owned || owned.length === 0) && (!memberOf || memberOf.length === 0) && (!pendingInvitations || pendingInvitations.length === 0)) {
                navigate('/onboarding')
            }

        } catch (error) {
            console.error('Dashboard load error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAcceptInvitation = async (invitation: Invitation) => {
        if (!user) return
        setLoading(true)
        try {
            // 1. Check if already a member to avoid unique constraint error
            const { data: existing } = await supabase
                .from('studio_users')
                .select('id')
                .eq('studio_id', invitation.studio_id)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!existing) {
                // Add user to studio_users
                const { error: insertError } = await supabase.from('studio_users').insert({
                    studio_id: invitation.studio_id,
                    user_id: user.id,
                    role: invitation.role,
                    status: 'active'
                })
                if (insertError) {
                    // If it failed because of membership already existing, we can ignore and continue to update invite
                    if (!insertError.message.includes('duplicate key')) throw insertError
                }
            }

            // 2. Update invitation status to accepted (crucial for owner view to clear)
            const { error: updateError } = await supabase
                .from('studio_invitations')
                .update({
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', invitation.id)

            if (updateError) throw updateError

            // Set as active studio
            localStorage.setItem('active_studio_id', invitation.studio_id)

            // Reload data
            await loadDashboardData()
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            alert(`Failed to accept invitation: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-12)' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                <p>Loading Dashboard...</p>
            </div>
        )
    }

    const isOwner = ownedStudios.length > 0
    const isOnlyMember = !isOwner && memberStudios.length > 0
    const isNewUser = !isOwner && memberStudios.length === 0

    return (
        <div className="container" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-12)' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-6)'
            }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-xl)' }}>
                        {isOwner ? 'Studio Manager' : 'My Dashboard'}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                        {user?.email}
                    </p>
                </div>
                <button
                    onClick={signOut}
                    className="btn btn-secondary"
                    style={{ padding: '8px', borderRadius: '8px' }}
                    title="Sign Out"
                >
                    <LogOut size={18} />
                </button>
            </header>

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
                <section style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        marginBottom: 'var(--space-3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Mail size={14} />
                        PENDING INVITATIONS
                    </h3>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        {pendingInvitations.map(inv => (
                            <div
                                key={inv.id}
                                className="card"
                                style={{
                                    padding: 'var(--space-4)',
                                    borderLeft: '4px solid var(--color-brand)'
                                }}
                            >
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                    {inv.studios?.name || 'Studio'}
                                </div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                    You've been invited as {inv.role}
                                </div>
                                <button
                                    className="btn"
                                    style={{ width: '100%' }}
                                    onClick={() => handleAcceptInvitation(inv)}
                                >
                                    Accept Invitation
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* New User - No Studios */}
            {isNewUser && pendingInvitations.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <Users size={48} style={{ margin: '0 auto var(--space-4)', color: 'var(--color-text-tertiary)' }} />
                    <h2 style={{ marginBottom: 'var(--space-2)' }}>Welcome!</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                        You don't have any studio access yet. Ask a studio owner to invite you, or create your own.
                    </p>
                    <button className="btn" onClick={() => navigate('/onboarding')}>
                        <Plus size={18} />
                        Create a Studio
                    </button>
                </div>
            )}

            {/* Owner View */}
            {isOwner && (
                <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
                    {/* Stat Row */}
                    <div className="dashboard-grid">
                        <div className="card stat-card">
                            <div className="stat-value">{ownedStudios.length}</div>
                            <div className="stat-label">Owned Studios</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{recentActivity.length}</div>
                            <div className="stat-label">Recent Actions</div>
                        </div>
                    </div>

                    {/* Studio List */}
                    <div>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                            YOUR STUDIOS
                        </h3>
                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            {ownedStudios.map(s => (
                                <div
                                    key={s.id}
                                    className="card"
                                    onClick={() => {
                                        localStorage.setItem('active_studio_id', s.id);
                                        navigate('/equipment');
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        padding: 'var(--space-3)',
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s ease'
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--color-brand-light)', color: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Building2 size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Primary Manager</div>
                                    </div>
                                    <ChevronRight size={16} color="var(--color-text-tertiary)" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card">
                        <h3 style={{ marginBottom: 'var(--space-4)' }}>Latest Transactions</h3>
                        {recentActivity.length > 0 ? (
                            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                                {recentActivity.map(a => (
                                    <div key={a.id} style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.type === 'checkout' ? '#ef4444' : '#22c55e', marginTop: '6px' }} />
                                        <div style={{ flex: 1 }}>
                                            <div><strong>{a.equipment.name}</strong> was {a.type === 'checkout' ? 'borrowed' : 'returned'}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{new Date(a.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>No recent activity to show.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Member View */}
            {isOnlyMember && (
                <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <Package size={20} color="var(--color-brand)" />
                            <h3 style={{ fontSize: 'var(--text-md)' }}>My Recent Activity</h3>
                        </div>

                        {myCheckouts.length > 0 ? (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {myCheckouts.slice(0, 5).map(t => (
                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-sm)' }}>
                                        <span style={{ fontWeight: 600 }}>{t.equipment.name}</span>
                                        <span style={{ fontSize: 'var(--text-xs)', color: t.type === 'checkout' ? '#ef4444' : '#22c55e' }}>
                                            {t.type === 'checkout' ? 'Borrowed' : 'Returned'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                No activity yet. Scan some equipment to get started!
                            </p>
                        )}
                    </div>

                    {/* Studios I'm a member of */}
                    <div>
                        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                            MY STUDIOS
                        </h3>
                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            {memberStudios.map((m, i) => (
                                <div
                                    key={i}
                                    className="card"
                                    onClick={() => {
                                        localStorage.setItem('active_studio_id', m.studios.id);
                                        navigate('/equipment');
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        padding: 'var(--space-3)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-base)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Building2 size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{m.studios.name}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{m.role}</div>
                                    </div>
                                    <ChevronRight size={16} color="var(--color-text-tertiary)" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
