import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Users, UserPlus, Mail, X } from 'lucide-react'
import '../styles/components.css'

interface Member {
    id: string
    user_id: string
    role: string
    status: string
    email?: string
}

interface Invitation {
    id: string
    email: string
    role: string
    status: string
    created_at: string
}

export default function MemberManagement() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [members, setMembers] = useState<Member[]>([])
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [showInviteForm, setShowInviteForm] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('colleague')
    const [sending, setSending] = useState(false)

    const studioId = localStorage.getItem('active_studio_id')

    useEffect(() => {
        if (studioId) {
            loadMembers()
        } else {
            navigate('/')
        }
    }, [studioId])

    async function loadMembers() {
        if (!studioId) return
        setLoading(true)

        try {
            // Fetch current members
            const { data: memberData } = await supabase
                .from('studio_users')
                .select('*')
                .eq('studio_id', studioId)

            setMembers(memberData || [])

            // Fetch pending invitations
            const { data: inviteData } = await supabase
                .from('studio_invitations')
                .select('*')
                .eq('studio_id', studioId)
                .eq('status', 'pending')

            setInvitations(inviteData || [])
        } catch (error) {
            console.error('Error loading members:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault()
        if (!studioId || !user || !inviteEmail.trim()) return

        setSending(true)
        try {
            // Check if already invited
            const { data: existing } = await supabase
                .from('studio_invitations')
                .select('id')
                .eq('studio_id', studioId)
                .eq('email', inviteEmail.toLowerCase())
                .single()

            if (existing) {
                alert('This email has already been invited.')
                return
            }

            // Create invitation
            const { error } = await supabase.from('studio_invitations').insert({
                studio_id: studioId,
                email: inviteEmail.toLowerCase(),
                role: inviteRole,
                invited_by: user.id
            })

            if (error) throw error

            setInviteEmail('')
            setShowInviteForm(false)
            loadMembers()
        } catch (error: any) {
            console.error('Error sending invitation:', error)
            alert(error.message || 'Failed to send invitation')
        } finally {
            setSending(false)
        }
    }

    async function handleRemoveMember(memberId: string) {
        if (!window.confirm('Are you sure you want to remove this member?')) return

        try {
            await supabase.from('studio_users').delete().eq('id', memberId)
            loadMembers()
        } catch (error) {
            console.error('Error removing member:', error)
            alert('Failed to remove member')
        }
    }

    async function handleCancelInvitation(invitationId: string) {
        try {
            await supabase.from('studio_invitations').delete().eq('id', invitationId)
            loadMembers()
        } catch (error) {
            console.error('Error canceling invitation:', error)
        }
    }

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
                marginBottom: 'var(--space-6)',
                paddingTop: 'var(--space-4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button onClick={() => navigate('/')} style={{ padding: 'var(--space-1)' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: 'var(--text-xl)' }}>Team Members</h1>
                </div>
                <button
                    className="btn"
                    onClick={() => setShowInviteForm(true)}
                    style={{ padding: '8px 12px' }}
                >
                    <UserPlus size={18} />
                    Invite
                </button>
            </header>

            {/* Invite Form Modal */}
            {showInviteForm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-4)',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h2 style={{ fontSize: 'var(--text-lg)' }}>Invite Member</h2>
                            <button onClick={() => setShowInviteForm(false)} style={{ padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleInvite} style={{ display: 'grid', gap: 'var(--space-4)' }}>
                            <div>
                                <label className="label">Email Address</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Role</label>
                                <select
                                    className="input"
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value)}
                                >
                                    <option value="colleague">Colleague (Can checkout/checkin)</option>
                                    <option value="admin">Admin (Can add equipment)</option>
                                </select>
                            </div>

                            <button type="submit" className="btn" disabled={sending}>
                                {sending ? 'Sending...' : 'Send Invitation'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Current Members */}
            <section style={{ marginBottom: 'var(--space-8)' }}>
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
                    <Users size={14} />
                    ACTIVE MEMBERS ({members.length})
                </h3>

                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {members.map(member => (
                        <div
                            key={member.id}
                            className="card"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 'var(--space-4)'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {member.user_id === user?.id ? 'You' : `User ${member.user_id.substring(0, 8)}...`}
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                                    {member.role}
                                </div>
                            </div>
                            {member.role !== 'owner' && member.user_id !== user?.id && (
                                <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', color: 'var(--color-error)', fontSize: '12px', fontWeight: 600 }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <section>
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
                        PENDING INVITATIONS ({invitations.length})
                    </h3>

                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        {invitations.map(inv => (
                            <div
                                key={inv.id}
                                className="card"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-4)',
                                    borderLeft: '4px solid var(--color-brand)'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>{inv.email}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                                        Invited as {inv.role} • {new Date(inv.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancelInvitation(inv.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-error)' }}
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
