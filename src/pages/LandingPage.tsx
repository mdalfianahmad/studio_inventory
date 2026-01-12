import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { QrCode, Users, Camera, ClipboardCheck, ArrowRight, Smartphone } from 'lucide-react'
import '../styles/components.css'

export default function LandingPage() {
    const navigate = useNavigate()
    const { user, loading } = useAuth()

    // If already logged in, redirect to dashboard
    if (!loading && user) {
        navigate('/')
        return null
    }

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        })
    }

    const handleAzureLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'azure',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                scopes: 'email openid profile'
            }
        })
    }

    const features = [
        {
            icon: <Users size={32} />,
            step: '1',
            title: 'Create or Join a Studio',
            description: 'Set up your studio space or accept an invitation from your team.'
        },
        {
            icon: <Camera size={32} />,
            step: '2',
            title: 'Add Your Equipment',
            description: 'List your gear with photos and auto-generated tracking codes.'
        },
        {
            icon: <QrCode size={32} />,
            step: '3',
            title: 'Print Labels',
            description: 'Generate QR codes or barcodes for each item and print them.'
        },
        {
            icon: <ClipboardCheck size={32} />,
            step: '4',
            title: 'Track Check-outs',
            description: 'Scan to check out equipment and capture condition photos.'
        }
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--color-bg-base)',
            color: 'var(--color-text-base)',
            overflow: 'hidden'
        }}>
            {/* Hero Section */}
            <header style={{
                padding: 'var(--space-8) var(--space-4)',
                textAlign: 'center',
                position: 'relative'
            }}>
                {/* Decorative elements */}
                <div style={{
                    position: 'absolute',
                    top: '-100px',
                    right: '-100px',
                    width: '300px',
                    height: '300px',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(40px)'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-50px',
                    left: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
                    borderRadius: '50%',
                    filter: 'blur(40px)'
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--color-bg-surface)',
                        padding: '8px 16px',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: 'var(--space-6)',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)'
                    }}>
                        <Smartphone size={14} />
                        Mobile-First Equipment Tracking
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2rem, 8vw, 3.5rem)',
                        fontWeight: 900,
                        lineHeight: 1.1,
                        marginBottom: 'var(--space-4)',
                        color: 'var(--color-text-primary)'
                    }}>
                        Studio Inventory
                    </h1>

                    <p style={{
                        fontSize: 'var(--text-lg)',
                        color: 'var(--color-text-secondary)',
                        maxWidth: '500px',
                        margin: '0 auto var(--space-8)',
                        lineHeight: 1.6
                    }}>
                        Track your studio equipment with QR codes, photo documentation, and team collaboration.
                    </p>

                    {/* Login Buttons */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                        maxWidth: '320px',
                        margin: '0 auto'
                    }}>
                        <button
                            onClick={handleGoogleLogin}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '16px 24px',
                                background: 'white',
                                color: '#1f2937',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        <button
                            onClick={handleAzureLogin}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '16px 24px',
                                background: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'transform 0.2s, background 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 23 23">
                                <path fill="#f25022" d="M1 1h10v10H1z" />
                                <path fill="#00a4ef" d="M1 12h10v10H1z" />
                                <path fill="#7fba00" d="M12 1h10v10H12z" />
                                <path fill="#ffb900" d="M12 12h10v10H12z" />
                            </svg>
                            Continue with Microsoft
                        </button>
                    </div>
                </div>
            </header>

            {/* How It Works */}
            <section style={{
                padding: 'var(--space-12) var(--space-4)',
                background: 'var(--color-brand-light)'
            }}>
                <h2 style={{
                    textAlign: 'center',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 800,
                    marginBottom: 'var(--space-2)'
                }}>
                    How It Works
                </h2>
                <p style={{
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-8)'
                }}>
                    Get started in minutes
                </p>

                <div style={{
                    display: 'grid',
                    gap: 'var(--space-4)',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                gap: 'var(--space-4)',
                                padding: 'var(--space-5)',
                                background: 'var(--color-bg-surface)',
                                borderRadius: '16px',
                                border: '1px solid var(--color-border)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '12px',
                                background: 'var(--color-brand)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {feature.icon}
                            </div>
                            <div>
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: 'var(--color-brand)',
                                    marginBottom: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em'
                                }}>
                                    Step {feature.step}
                                </div>
                                <h3 style={{
                                    fontSize: 'var(--text-md)',
                                    fontWeight: 700,
                                    marginBottom: '4px'
                                }}>
                                    {feature.title}
                                </h3>
                                <p style={{
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--color-text-secondary)',
                                    lineHeight: 1.5
                                }}>
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer CTA */}
            <section style={{
                padding: 'var(--space-12) var(--space-4)',
                textAlign: 'center'
            }}>
                <p style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-4)'
                }}>
                    Ready to organize your studio?
                </p>
                <button
                    onClick={handleGoogleLogin}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '14px 28px',
                        background: 'var(--color-brand)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-md)'
                    }}
                >
                    Get Started Free
                    <ArrowRight size={18} />
                </button>
            </section>

            {/* Footer */}
            <footer style={{
                padding: 'var(--space-6) var(--space-4)',
                textAlign: 'center',
                borderTop: '1px solid var(--color-border)',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--text-xs)'
            }}>
                © {new Date().getFullYear()} Studio Inventory. Built for creative teams.
            </footer>
        </div>
    )
}
