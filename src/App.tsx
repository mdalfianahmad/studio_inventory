import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import EquipmentList from './pages/EquipmentList'
import AddEquipment from './pages/AddEquipment'
import EquipmentDetail from './pages/EquipmentDetail'
import EditEquipment from './pages/EditEquipment'
import BulkPrintLabels from './pages/BulkPrintLabels'
import MemberManagement from './pages/MemberManagement'
import CheckoutFlow from './pages/CheckoutFlow'
import ActivityLog from './pages/ActivityLog'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div style={{
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
        <p>Loading...</p>
      </div>
    </div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      {/* Public landing/login page */}
      <Route path="/login" element={
        loading ? (
          <div style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white'
          }}>
            <div className="loading-spinner"></div>
          </div>
        ) : session ? <Navigate to="/" replace /> : <LandingPage />
      } />

      {/* OAuth callback */}
      <Route path="/auth/callback" element={
        session ? <Navigate to="/" replace /> : (
          <div style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
              <p>Completing login...</p>
            </div>
          </div>
        )
      } />

      {/* Protected routes */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="equipment" element={<EquipmentList />} />
        <Route path="equipment/add" element={<AddEquipment />} />
        <Route path="equipment/:id" element={<EquipmentDetail />} />
        <Route path="equipment/:id/edit" element={<EditEquipment />} />
        <Route path="equipment/print-all" element={<BulkPrintLabels />} />
        <Route path="members" element={<MemberManagement />} />
        <Route path="scan" element={<CheckoutFlow />} />
        <Route path="activity" element={<ActivityLog />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
