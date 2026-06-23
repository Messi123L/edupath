import React from 'react';

export default function Navbar({ currentUser, onLogout }) {
  // Obtenir la couleur thématique du badge du rôle
  const getRoleStyles = (role) => {
    switch (role) {
      case 'enseignant':
        return { color: 'var(--secondary)', bg: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', text: '🎓 Enseignant' };
      case 'admin':
        return { color: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', text: '🛠️ Administrateur' };
      default:
        return { color: 'var(--primary)', bg: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', text: '📖 Étudiant' };
    }
  };

  const roleInfo = currentUser ? getRoleStyles(currentUser.role) : null;

  return (
    <nav className="glass-panel" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 2rem',
      borderRadius: '0 0 20px 20px',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      marginBottom: '2rem',
      width: '100%',
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Logo Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '900',
          fontSize: '1.25rem',
          color: 'white',
          boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
        }}>
          E
        </div>
        <h1 className="gradient-text" style={{ fontSize: '1.5rem', margin: 0, letterSpacing: '-0.03em', fontWeight: '800' }}>
          EduPath
        </h1>
      </div>

      {/* User Information & Action Section */}
      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {currentUser.nom}
            </div>
            <div style={{
              fontSize: '0.68rem',
              color: roleInfo.color,
              background: roleInfo.bg,
              border: roleInfo.border,
              padding: '0.15rem 0.6rem',
              borderRadius: '99px',
              textTransform: 'uppercase',
              fontWeight: '800',
              letterSpacing: '0.04em',
              display: 'inline-block',
              alignSelf: 'flex-end'
            }}>
              {roleInfo.text}
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={onLogout} 
            style={{ 
              padding: '0.45rem 1rem', 
              fontSize: '0.82rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)'
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}
