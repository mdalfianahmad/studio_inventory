import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/components.css'

export default function EditEquipment() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        sku: ''
    })

    useEffect(() => {
        if (id) fetchEquipment(id)
    }, [id])

    async function fetchEquipment(equipmentId: string) {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .eq('id', equipmentId)
                .single()

            if (error) throw error
            if (data) {
                setFormData({
                    name: data.name,
                    category: data.category,
                    sku: data.sku || ''
                })
            }
        } catch (error) {
            console.error('Error fetching equipment:', error)
            alert('Failed to load equipment data')
            navigate('/equipment')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!id) return
        setSaving(true)

        try {
            const { error } = await supabase
                .from('equipment')
                .update({
                    name: formData.name,
                    category: formData.category,
                    sku: formData.sku || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)

            if (error) throw error
            navigate(`/equipment/${id}`)
        } catch (error: any) {
            console.error('Error updating equipment:', error)
            alert(`Failed to update: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="container" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>Loading Data...</div>

    return (
        <div className="container">
            <header style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-6)',
                paddingTop: 'var(--space-4)'
            }}>
                <button onClick={() => navigate(-1)} style={{ padding: 'var(--space-1)' }}>
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: 'var(--text-xl)' }}>Edit Equipment</h1>
            </header>

            <div className="card">
                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div>
                        <label className="label">Name</label>
                        <input
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Category</label>
                        <select
                            className="input"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                        >
                            <option>Camera</option>
                            <option>Lens</option>
                            <option>Light</option>
                            <option>Audio</option>
                            <option>Grip</option>
                            <option>Cable</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Base SKU / Reference</label>
                        <input
                            className="input"
                            value={formData.sku}
                            onChange={e => setFormData({ ...formData, sku: e.target.value })}
                        />
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                            Note: Changing the base SKU does not rename existing physical unit IDs.
                        </p>
                    </div>

                    <button type="submit" className="btn" disabled={saving} style={{ marginTop: 'var(--space-2)' }}>
                        <Save size={18} />
                        {saving ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    )
}
