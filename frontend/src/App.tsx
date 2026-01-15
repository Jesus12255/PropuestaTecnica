/**
 * App.tsx - Router principal con rutas protegidas
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RFPDetailPage from './pages/RFPDetailPage';
import QuestionsPage from './pages/QuestionsPage';
import RFPListPage from './pages/RFPListPage';
import SettingsPage from './pages/SettingsPage';
import CertificationsPage from './pages/CertificationsPage';
import ExperiencesPage from './pages/ExperiencesPage';
import ChaptersPage from './pages/ChaptersPage';

// Componente para rutas protegidas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Componente para rutas públicas (login)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Rutas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Listas de RFPs */}
        <Route
          path="/rfps"
          element={
            <ProtectedRoute>
              <RFPListPage filterStatus="all" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rfps/pending"
          element={
            <ProtectedRoute>
              <RFPListPage filterStatus="pending" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rfps/approved"
          element={
            <ProtectedRoute>
              <RFPListPage filterStatus="approved" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rfps/rejected"
          element={
            <ProtectedRoute>
              <RFPListPage filterStatus="rejected" />
            </ProtectedRoute>
          }
        />

        {/* Detalle RFP */}
        <Route
          path="/rfp/:id"
          element={
            <ProtectedRoute>
              <RFPDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rfp/:id/questions"
          element={
            <ProtectedRoute>
              <QuestionsPage />
            </ProtectedRoute>
          }
        />

        {/* Certificaciones */}
        <Route
          path="/certifications"
          element={
            <ProtectedRoute>
              <CertificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Experiencias */}
        <Route
          path="/experiences"
          element={
            <ProtectedRoute>
              <ExperiencesPage />
            </ProtectedRoute>
          }
        />

        {/* Capítulos */}
        <Route
          path="/chapters"
          element={
            <ProtectedRoute>
              <ChaptersPage />
            </ProtectedRoute>
          }
        />

        {/* Configuración */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect cualquier ruta desconocida */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
