import React, { useState } from 'react';
import Auth from './views/Auth';
import DashboardEnseignant from './views/DashboardEnseignant';
import DashboardEtudiant from './views/DashboardEtudiant';
import DashboardAdmin from './views/DashboardAdmin';
import ViewResource from './views/ViewResource';
import { useLanguage } from './utils/LanguageContext';

export default function App() {
  const { lang, setLang, theme, setTheme, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'catalog', 'guide', 'uploads', 'users', 'resources', 'study'
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setSelectedResourceId(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSelectedResourceId(null);
  };

  const handleViewResource = (resourceId) => {
    setSelectedResourceId(resourceId);
    setActiveTab('study');
  };

  // Dynamic role info badge styling for the Sidebar footer
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'enseignant':
        return { color: 'var(--secondary)', text: t('teacher') };
      case 'admin':
        return { color: 'var(--accent-red)', text: t('admin') };
      default:
        return { color: 'var(--primary)', text: t('student') };
    }
  };

  // Renders correct tab views based on activeTab and user role
  const renderMainContent = () => {
    if (!currentUser) return null;

    switch (activeTab) {
      case 'study':
        return (
          <ViewResource 
            resourceId={selectedResourceId} 
            currentUser={currentUser} 
            onBack={() => {
              setActiveTab(currentUser.role === 'etudiant' ? 'catalog' : 'uploads');
              setSelectedResourceId(null);
            }} 
          />
        );
      
      // Student view toggles
      case 'dashboard':
        if (currentUser.role === 'etudiant') {
          return <DashboardEtudiant currentUser={currentUser} viewMode="stats" onViewResource={handleViewResource} />;
        } else if (currentUser.role === 'enseignant') {
          return <DashboardEnseignant currentUser={currentUser} viewMode="stats" onViewResource={handleViewResource} />;
        } else {
          return <DashboardAdmin currentUser={currentUser} viewMode="stats" onViewResource={handleViewResource} />;
        }
      
      case 'catalog':
        return <DashboardEtudiant currentUser={currentUser} viewMode="catalog" onViewResource={handleViewResource} />;
      
      case 'guide':
        return <DashboardEtudiant currentUser={currentUser} viewMode="guide" />;

      // Teacher view toggles
      case 'uploads':
        return <DashboardEnseignant currentUser={currentUser} viewMode="uploads" onViewResource={handleViewResource} />;

      // Admin view toggles
      case 'users':
        return <DashboardAdmin currentUser={currentUser} viewMode="users" onViewResource={handleViewResource} />;
      
      case 'resources':
        return <DashboardAdmin currentUser={currentUser} viewMode="resources" onViewResource={handleViewResource} />;

      default:
        return <div style={{ padding: '2rem' }}>Tab not found.</div>;
    }
  };

  // Translates titles for the top header panel
  const getViewTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return currentUser?.role === 'admin' ? t('portal_admin') : t('dashboard');
      case 'catalog':
        return t('catalog');
      case 'guide':
        return t('guide');
      case 'uploads':
        return t('uploads');
      case 'users':
        return t('admin_users_title');
      case 'resources':
        return t('admin_resources_title');
      case 'study':
        return t('courses_card_study_btn');
      default:
        return "EduPath";
    }
  };

  // Helper component to render language / theme switcher
  const renderControls = (isHeader = false) => {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: isHeader ? 'none' : '1px solid var(--border-glass)', 
        paddingBottom: isHeader ? '0' : '0.8rem', 
        marginBottom: isHeader ? '0' : '0.8rem', 
        gap: '0.8rem' 
      }}>
        {/* Language select buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '0.25rem', 
          background: 'rgba(0,0,0,0.15)', 
          padding: '0.2rem', 
          borderRadius: '8px',
          border: '1px solid var(--border-glass)'
        }}>
          {['fr', 'en', 'ar'].map(l => (
            <button 
              key={l}
              onClick={() => setLang(l)}
              style={{ 
                padding: '0.2rem 0.5rem', 
                fontSize: '0.72rem', 
                border: 'none', 
                background: lang === l ? 'var(--primary)' : 'transparent', 
                color: 'white', 
                borderRadius: '6px', 
                minWidth: '28px',
                cursor: 'pointer',
                fontWeight: '700'
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        
        {/* Theme toggle buttons */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ 
            padding: '0.35rem', 
            fontSize: '1rem', 
            border: '1px solid var(--border-glass)', 
            background: 'rgba(0,0,0,0.15)', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '32px', 
            height: '32px' 
          }}
          title={theme === 'dark' ? "Mode Clair" : "Mode Sombre"}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Dynamic header with controls on guest page */}
        <header className="glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2.2rem',
          borderRadius: '0 0 20px 20px',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          width: '100%',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(16px)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="sidebar-logo-badge">E</div>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800' }}>EduPath</h1>
          </div>
          {renderControls(true)}
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Auth onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  const roleStyle = getRoleBadgeStyle(currentUser.role);

  return (
    <div className="app-layout">
      
      {/* Sidebar mobile overlay backdrop */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {/* Sidebar Panel */}
      <aside className={`sidebar-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div>
          {/* Logo Brand */}
          <div className="sidebar-logo-section">
            <div className="sidebar-logo-badge">E</div>
            <span className="sidebar-logo-text gradient-text">EduPath</span>
          </div>

          {/* Navigation Links */}
          <nav className="sidebar-menu">
            
            {/* Student Links */}
            {currentUser.role === 'etudiant' && (
              <>
                <div 
                  className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">📊</span>
                  <span>{t('dashboard')}</span>
                </div>
                <div 
                  className={`sidebar-item ${activeTab === 'catalog' || activeTab === 'study' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('catalog'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">📚</span>
                  <span>{t('catalog')}</span>
                </div>
                <div 
                  className={`sidebar-item ${activeTab === 'guide' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('guide'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">💡</span>
                  <span>{t('guide')}</span>
                </div>
              </>
            )}

            {/* Teacher Links */}
            {currentUser.role === 'enseignant' && (
              <>
                <div 
                  className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">📊</span>
                  <span>{t('dashboard')}</span>
                </div>
                <div 
                  className={`sidebar-item ${activeTab === 'uploads' || activeTab === 'study' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('uploads'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">⚙️</span>
                  <span>{t('uploads')}</span>
                </div>
              </>
            )}

            {/* Admin Links */}
            {currentUser.role === 'admin' && (
              <>
                <div 
                  className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">📈</span>
                  <span>{t('dashboard')}</span>
                </div>
                <div 
                  className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('users'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">👥</span>
                  <span>{t('users')}</span>
                </div>
                <div 
                  className={`sidebar-item ${activeTab === 'resources' || activeTab === 'study' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('resources'); setSelectedResourceId(null); setIsSidebarOpen(false); }}
                >
                  <span className="sidebar-icon">🛡️</span>
                  <span>{t('resources')}</span>
                </div>
              </>
            )}

          </nav>
        </div>

        {/* Sidebar Footer Controls & Profile card */}
        <div className="sidebar-footer">
          {renderControls(false)}
          <div className="sidebar-profile">
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name">{currentUser.nom}</span>
              <span className="sidebar-profile-role" style={{ color: roleStyle.color }}>
                {roleStyle.text}
              </span>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => { handleLogout(); setIsSidebarOpen(false); }}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel layout area */}
      <main className="main-panel">
        
        {/* Header bar */}
        <header className="view-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button 
              className="hamburger-btn" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <h2 className="view-header-title">{getViewTitle()}</h2>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>
            {currentUser.role === 'etudiant' ? t('portal_student') : currentUser.role === 'enseignant' ? t('portal_teacher') : t('portal_admin')}
          </div>
        </header>

        {/* View content panel */}
        <section className="view-body">
          {renderMainContent()}
        </section>

      </main>

    </div>
  );
}
