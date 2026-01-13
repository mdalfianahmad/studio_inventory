import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Building2, Package, ChevronRight, Users, Plus, Mail, LogOut, AlertCircle } from 'lucide-react'
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
    approval_status: 'pending' | 'approved' | 'denied' | null
    equipment: {
        name: string
    }
    profiles?: {
        email: string
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
    const [pendingApprovals, setPendingApprovals] = useState<Transaction[]>([])

    const loadDashboardData = useCallback(async () => {
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
                    id, type, created_at, approval_status,
                    equipment (name)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10)

            setMyCheckouts(checkouts as any || [])

            // 5. Activity and Approvals if has any studio
            const allStudioIds = [
                ...(owned || []).map(s => s.id),
                ...(memberOf || []).map(m => m.studios.id)
            ]

            if (allStudioIds.length > 0) {
                // Recent activity for all my studios
                const { data: activity } = await supabase
                    .from('transactions')
                    .select(`
                        id, type, created_at,
                        equipment (name)
                    `)
                    .in('studio_id', allStudioIds)
                    .order('created_at', { ascending: false })
                    .limit(5)

                setRecentActivity(activity || [])

                // Pending Approvals (For Owners)
                if (owned && owned.length > 0) {
                    const { data: pending } = await supabase
                        .from('transactions')
                        .select(`
                            id, type, created_at, approval_status,
                            equipment (name),
                            profiles:user_id (email)
                        `)
                        .in('studio_id', owned.map(s => s.id))
                        .eq('approval_status', 'pending')
                        .order('created_at', { ascending: false })

                    setPendingApprovals(pending as any || [])
                }
            }

            if ((!owned || owned.length === 0) && (!memberOf || memberOf.length === 0) && (!pendingInvitations || pendingInvitations.length === 0)) {
                navigate('/onboarding')
            }

        } catch (error) {
            console.error('Dashboard load error:', error)
        } finally {
            setLoading(false)
        }
    }, [user, navigate])

    useEffect(() => {
        if (user) {
            loadDashboardData()
        }
    }, [user, loadDashboardData])

    const handleAcceptInvitation = async (invitation: Invitation) => {
        if (!user) return
        setLoading(true)
        try {
            const { data: existing } = await supabase
                .from('studio_users')
                .select('id')
                .eq('studio_id', invitation.studio_id)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!existing) {
                const { error: insertError } = await supabase.from('studio_users').insert({
                    studio_id: invitation.studio_id,
                    user_id: user.id,
                    role: invitation.role,
                    status: 'active'
                })
                if (insertError && !insertError.message.includes('duplicate key')) throw insertError
            }

            const { error: updateError } = await supabase
                .from('studio_invitations')
                .update({
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', invitation.id)

            if (updateError) throw updateError
            localStorage.setItem('active_studio_id', invitation.studio_id)
            await loadDashboardData()
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            alert(`Failed to accept invitation: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateApproval = async (transactionId: string, status: 'approved' | 'denied') => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('transactions')
                .update({ approval_status: status })
                .eq('id', transactionId)

            if (error) throw error
            await loadDashboardData()
        } catch (error: any) {
            console.error('Error updating approval:', error)
            alert(`Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
            </div>
        )
    }

    const isOwner = ownedStudios.length > 0
    const isOnlyMember = !isOwner && memberStudios.length > 0
    const isNewUser = !isOwner && memberStudios.length === 0

    return (
        <div style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-12)' }}>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-6)'
            }}>
                <div>
                    <h1 style={{ marginBottom: '2px' }}>
                        {isOwner ? 'Studio Manager' : 'Dashboard'}
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                        {user?.email}
                    </p>
                </div>
                <button
                    onClick={signOut}
                    className="btn btn-secondary"
                    style={{ padding: '10px' }}
                    title="Sign Out"
                >
                    <LogOut size={18} />
                </button>
            </header>

            {pendingInvitations.length > 0 && (
                <section style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="section-header">
                        <Mail size={14} />
                        PENDING INVITATIONS
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        {pendingInvitations.map(inv => (
                            <div key={inv.id} className="card" style={{ borderLeft: '3px solid var(--color-info)' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                    {inv.studios?.name || 'Studio'}
                                </div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                    Invited as {inv.role}
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

            {isOwner && pendingApprovals.length > 0 && (
                <section style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="section-header" style={{ color: 'var(--color-warning)' }}>
                        <AlertCircle size={14} />
                        APPROVALS REQUIRED ({pendingApprovals.length})
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        {pendingApprovals.map(appr => (
                            <div key={appr.id} className="card" style={{ borderLeft: '3px solid var(--color-warning)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{appr.equipment.name}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                                            {appr.profiles?.email} • {new Date(appr.created_at).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        background: 'var(--color-bg-base)',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                        color: 'var(--color-warning)',
                                        textTransform: 'uppercase'
                                    }}>
                                        Pending
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        onClick={() => handleUpdateApproval(appr.id, 'approved')}
                                        className="btn"
                                        style={{ flex: 1, padding: '8px', fontSize: '13px', background: 'var(--color-success)', color: 'white' }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleUpdateApproval(appr.id, 'denied')}
                                        className="btn btn-secondary"
                                        style={{ flex: 1, padding: '8px', fontSize: '13px', color: 'var(--color-error)' }}
                                    >
                                        Deny
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

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

            {isOwner && (
                <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
                    <div className="dashboard-grid">
                        <div className="card stat-card">
                            <div className="stat-value">{ownedStudios.length}</div>
                            <div className="stat-label">Studios</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{recentActivity.length}</div>
                            <div className="stat-label">Recent Events</div>
                        </div>
                    </div>

                    <section>
                        <div className="section-header">YOUR STUDIOS</div>
                        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
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
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-brand-light)',
                                        color: 'var(--color-brand)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Building2 size={22} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Owner</div>
                                    </div>
                                    <ChevronRight size={18} color="var(--color-text-tertiary)" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {(isOnlyMember || (isOwner && myCheckouts.length > 0)) && (
                <div style={{ display: 'grid', gap: 'var(--space-6)', marginTop: isOwner ? 'var(--space-6)' : 0 }}>
                    <section className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <Package size={20} color="var(--color-brand)" />
                            <h3 style={{ fontSize: 'var(--text-md)' }}>{isOwner ? 'Your Actions' : 'My Activity'}</h3>
                        </div>

                        {myCheckouts.length > 0 ? (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {myCheckouts.map(t => (
                                    <div key={t.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: 'var(--space-2) var(--space-3)',
                                        background: 'var(--color-bg-base)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t.equipment.name}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: t.approval_status === 'approved' ? 'var(--color-success)' :
                                                    t.approval_status === 'denied' ? 'var(--color-error)' :
                                                        t.type === 'checkin' ? 'var(--color-success)' : 'var(--color-warning)',
                                                textTransform: 'capitalize'
                                            }}>
                                                {t.approval_status || (t.type === 'checkout' ? 'Processing' : 'Returned')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                No activity yet. Scan equipment to get started!
                            </p>
                        )}
                    </section>

                    {isOnlyMember && (
                        <section>
                            <div className="section-header">MY STUDIOS</div>
                            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
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
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--color-bg-base)',
                                            color: 'var(--color-text-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Building2 size={22} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{m.studios.name}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{m.role}</div>
                                        </div>
                                        <ChevronRight size={18} color="var(--color-text-tertiary)" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    )
}
