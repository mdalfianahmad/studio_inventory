import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, UserPlus, Building2, ChevronRight, Mail } from 'lucide-react'
import '../styles/components.css'

export default function Onboarding() {
    const { user } = useAuth()
    const [mode, setMode] = useState<'list' | 'create' | 'join'>('list')
    const [userStudios, setUserStudios] = useState<any[]>([])
    const [studioName, setStudioName] = useState('')
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [pendingInvitations, setPendingInvitations] = useState<any[]>([])

    useEffect(() => {
        if (user) {
            fetchUserStudios()
            fetchPendingInvitations()
        }
    }, [user])

    async function fetchPendingInvitations() {
        if (!user?.email) return
        try {
            const { data, error } = await supabase
                .from('studio_invitations')
                .select('*, studios(name)')
                .eq('email', user.email.toLowerCase())
                .eq('status', 'pending')

            if (error) throw error
            setPendingInvitations(data || [])
        } catch (error) {
            console.error('Error fetching invitations:', error)
        }
    }

    const handleAcceptInvitation = async (invitation: any) => {
        if (!user) return
        setActionLoading(true)
        try {
            // 1. Check if already a member
            const { data: existing } = await supabase
                .from('studio_users')
                .select('id')
                .eq('studio_id', invitation.studio_id)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!existing) {
                // Add to studio_users
                const { error: linkError } = await supabase
                    .from('studio_users')
                    .insert({
                        studio_id: invitation.studio_id,
                        user_id: user.id,
                        role: invitation.role,
                        status: 'active'
                    })
                if (linkError) {
                    if (!linkError.message.includes('duplicate key')) throw linkError
                }
            }

            // 2. Update invitation status to accepted
            const { error: updateError } = await supabase
                .from('studio_invitations')
                .update({
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', invitation.id)

            if (updateError) throw updateError

            // 3. Set active studio and redirect
            localStorage.setItem('active_studio_id', invitation.studio_id)
            window.location.href = '/'
        } catch (error: any) {
            console.error('Error accepting invitation:', error)
            alert(`Failed to accept: ${error.message}`)
        } finally {
            setActionLoading(false)
        }
    }

    async function fetchUserStudios() {
        if (!user) return
        try {
            const { data, error } = await supabase
                .from('studio_users')
                .select(`
                    role,
                    studios (
                        id,
                        name
                    )
                `)
                .eq('user_id', user.id)

            if (error) throw error
            const studios = data?.map(d => ({ ...d.studios, role: d.role })) || []
            setUserStudios(studios)

            // If they have studios and we are in list mode, don't change
            // But if they have no studios and no pending invites, default to 'create'
            if (studios.length === 0 && pendingInvitations.length === 0) {
                setMode('create')
            } else if (studios.length === 0 && pendingInvitations.length > 0) {
                setMode('join')
            }
        } catch (error) {
            console.error('Error fetching studios:', error)
        } finally {
            setLoading(false)
        }
    }

    // Update dependencies for fetchUserStudios if necessary, though it depends on pendingInvitations too now
    useEffect(() => {
        if (user && !loading) {
            if (userStudios.length === 0 && pendingInvitations.length > 0) {
                setMode('join')
            }
        }
    }, [pendingInvitations, userStudios])

    const handleCreateStudio = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        setActionLoading(true)

        try {
            const { data: studio, error: studioError } = await supabase
                .from('studios')
                .insert({
                    name: studioName,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    owner_id: user.id
                })
                .select()
                .single()

            if (studioError) throw studioError

            const { error: linkError } = await supabase
                .from('studio_users')
                .insert({
                    studio_id: studio.id,
                    user_id: user.id,
                    role: 'owner',
                    status: 'active'
                })

            if (linkError) throw linkError

            localStorage.setItem('active_studio_id', studio.id)
            window.location.href = '/'
        } catch (error: any) {
            console.error('Error creating studio:', error)
            alert(`Failed to create studio: ${error.message}`)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return (
        <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-12)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
            <p>Loading your profile...</p>
        </div>
    )

    return (
        <div className="container" style={{ paddingTop: 'var(--space-8)' }}>
            <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                {/* User Profile Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-8)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-bg-base)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'var(--color-brand)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold'
                    }}>
                        {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user?.user_metadata?.full_name || user?.email}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Account Active</div>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="card">
                    {mode === 'list' && userStudios.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>My Studios</h2>
                            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                                {userStudios.map(s => (
                                    <button
                                        key={s.id}
                                        className="card"
                                        onClick={() => {
                                            localStorage.setItem('active_studio_id', s.id)
                                            window.location.href = '/'
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                            width: '100%', textAlign: 'left', padding: 'var(--space-3)',
                                            border: '1px solid var(--color-border)', cursor: 'pointer'
                                        }}
                                    >
                                        <Building2 size={20} color="var(--color-brand)" />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>{s.role}</div>
                                        </div>
                                        <ChevronRight size={16} color="var(--color-text-tertiary)" />
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMode('create')}>
                                    <Plus size={16} /> New Studio
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMode('join')}>
                                    <UserPlus size={16} /> Join
                                </button>
                            </div>
                        </div>
                    )}

                    {(mode === 'create' || mode === 'join' || userStudios.length === 0) && (
                        <div>
                            {/* Simple Tabs */}
                            <div style={{
                                display: 'flex',
                                borderBottom: '1px solid var(--color-border)',
                                marginBottom: 'var(--space-6)'
                            }}>
                                <button
                                    onClick={() => setMode('create')}
                                    style={{
                                        padding: 'var(--space-3) var(--space-4)',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: mode === 'create' ? '2px solid var(--color-brand)' : '2px solid transparent',
                                        color: mode === 'create' ? 'var(--color-text-base)' : 'var(--color-text-tertiary)',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Create Studio
                                </button>
                                <button
                                    onClick={() => setMode('join')}
                                    style={{
                                        padding: 'var(--space-3) var(--space-4)',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: mode === 'join' ? '2px solid var(--color-brand)' : '2px solid transparent',
                                        color: mode === 'join' ? 'var(--color-text-base)' : 'var(--color-text-tertiary)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    Join Studio
                                    {pendingInvitations.length > 0 && (
                                        <span style={{
                                            position: 'absolute', top: '8px', right: '0px',
                                            width: '8px', height: '8px', background: '#ef4444',
                                            borderRadius: '50%', border: '2px solid white'
                                        }} />
                                    )}
                                </button>
                                {userStudios.length > 0 && (
                                    <button
                                        onClick={() => setMode('list')}
                                        style={{ marginLeft: 'auto', padding: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Back to list
                                    </button>
                                )}
                            </div>

                            {mode === 'create' ? (
                                <form onSubmit={handleCreateStudio}>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                        Establish a new inventory space for your team.
                                    </p>
                                    <div style={{ marginBottom: 'var(--space-6)' }}>
                                        <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                                            STUDIO NAME
                                        </label>
                                        <input
                                            className="input"
                                            value={studioName}
                                            onChange={(e) => setStudioName(e.target.value)}
                                            placeholder="e.g. Jamiyah Media Studio"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="btn" style={{ width: '100%' }} disabled={actionLoading}>
                                        {actionLoading ? 'Establishing Studio...' : 'Start Studio'}
                                    </button>
                                </form>
                            ) : (
                                <div>
                                    {pendingInvitations.length > 0 ? (
                                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                            {pendingInvitations.map(inv => (
                                                <div key={inv.id} className="card" style={{ padding: 'var(--space-4)', background: 'var(--color-bg-base)' }}>
                                                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>{inv.studios?.name}</div>
                                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                                        Invitation to join as {inv.role}
                                                    </div>
                                                    <button
                                                        className="btn"
                                                        style={{ width: '100%' }}
                                                        onClick={() => handleAcceptInvitation(inv)}
                                                        disabled={actionLoading}
                                                    >
                                                        {actionLoading ? 'Joining...' : 'Accept Invitation'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div>
                                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                                Have an invite link? Ask your administrator to send you one to join an existing studio.
                                            </p>
                                            <div className="input" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-8)' }}>
                                                <Mail size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                                <div>No pending invitations found</div>
                                                <div style={{ fontSize: '11px', marginTop: '4px' }}>Make sure the invitation was sent to {user?.email}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

