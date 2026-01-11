import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Box, QrCode, History, Users } from 'lucide-react'
import '../styles/components.css'

export default function Layout() {
    const { user } = useAuth()
    const location = useLocation()
    const isEditingOnboarding = location.pathname === '/onboarding'
    const [isOwner, setIsOwner] = useState(false)

    useEffect(() => {
        checkOwnership()
    }, [user])

    async function checkOwnership() {
        const studioId = localStorage.getItem('active_studio_id')
        if (!studioId || !user) return

        const { data: studio } = await supabase
            .from('studios')
            .select('owner_id')
            .eq('id', studioId)
            .single()

        setIsOwner(studio?.owner_id === user.id)
    }

    return (
        <div className="app-layout">
            <main className="app-main container">
                <Outlet />
            </main>

            {!isEditingOnboarding && (
                <nav className="bottom-nav">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={22} />
                        <span>Home</span>
                    </NavLink>

                    <NavLink
                        to="/equipment"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Box size={22} />
                        <span>Items</span>
                    </NavLink>

                    <NavLink
                        to="/scan"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <div style={{
                            background: 'var(--color-brand)',
                            color: 'white',
                            padding: '10px',
                            borderRadius: '50%',
                            marginTop: '-20px',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <QrCode size={22} />
                        </div>
                        <span>Scan</span>
                    </NavLink>

                    <NavLink
                        to="/activity"
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <History size={22} />
                        <span>History</span>
                    </NavLink>

                    {isOwner && (
                        <NavLink
                            to="/members"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Users size={22} />
                            <span>Team</span>
                        </NavLink>
                    )}
                </nav>
            )}
        </div>
    )
}
