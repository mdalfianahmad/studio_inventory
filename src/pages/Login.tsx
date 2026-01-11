import { useState } from 'react'
import { supabase } from '../lib/supabase'
// import { useNavigate } from 'react-router-dom'
import '../styles/components.css' // We will create this

export default function Login() {
    const [loading, setLoading] = useState(false)
    // const navigate = useNavigate()

    const handleLogin = async (provider: 'google' | 'azure') => {
        try {
            setLoading(true)
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
        } catch (error) {
            console.error('Error logging in:', error)
            alert('Error logging in. Please check console for details.') // Simple feedback
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">Studio Inventory</h1>
                <p className="login-subtitle">Manage your equipment with ease.</p>

                <div className="login-actions">
                    <button
                        className="btn btn-secondary login-btn"
                        onClick={() => handleLogin('google')}
                        disabled={loading}
                    >
                        {/* Simple SVG Icon placeholder */}
                        <span className="icon">G</span>
                        Sign in with Google
                    </button>

                    <button
                        className="btn btn-secondary login-btn"
                        onClick={() => handleLogin('azure')}
                        disabled={loading}
                    >
                        <span className="icon">M</span>
                        Sign in with Microsoft
                    </button>
                </div>
            </div>
        </div>
    )
}
