import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function DashboardAdmin({ currentUser, viewMode, onViewResource }) {
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // 1. Récupérer les stats globales
      const resStats = await fetch('http://localhost:5000/api/admin/stats');
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }

      // 2. Récupérer tous les utilisateurs
      const resUsers = await fetch('http://localhost:5000/api/admin/users');
      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsers(dataUsers);
      }

      // 3. Récupérer toutes les ressources (role bypass pour tout voir)
      const resResources = await fetch('http://localhost:5000/api/resources?role=enseignant');
      if (resResources.ok) {
        const dataResources = await resResources.json();
        setResources(dataResources);
      }

    } catch (err) {
      console.error("Erreur de chargement des données admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'fr' ? 'Erreur de mise à jour.' : lang === 'ar' ? 'خطأ في التحديث.' : 'Update error.'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser.id) {
      alert(lang === 'fr' ? "Vous ne pouvez pas supprimer votre propre compte Administrateur !" : lang === 'ar' ? "لا يمكنك حذف حساب مسؤول النظام الخاص بك!" : "You cannot delete your own Administrator account!");
      return;
    }
    if (!confirm(lang === 'fr' ? "Voulez-vous supprimer cet utilisateur ? Cette action détruira également toutes ses données (statistiques s'il est étudiant, cours et cartes s'il est enseignant)." : lang === 'ar' ? "هل تريد حذف هذا المستخدم؟ سيؤدي هذا الإجراء أيضًا إلى تدمير جميع بياناته (الإحصاءات إذا كان طالبًا، والمقررات والبطاقات إذا كان معلمًا)." : "Do you want to delete this user? This action will also destroy all their data (statistics if they are a student, courses and cards if they are a teacher).")) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleValidateResource = async (resourceId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/validate`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!confirm(lang === 'fr' ? "Voulez-vous supprimer définitivement ce cours du serveur ?" : lang === 'ar' ? "هل تريد حذف هذا المقرر نهائيًا من الخادم؟" : "Do you want to permanently delete this course from the server?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- RENDU 1 : STATISTIQUES GLOBALES ---
  const renderStatsView = () => {
    if (!stats) return <p style={{ color: 'var(--text-muted)' }}>{lang === 'fr' ? 'Chargement des données statistiques...' : lang === 'ar' ? 'جاري تحميل البيانات الإحصائية...' : 'Loading statistical data...'}</p>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Metric Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.2rem'
        }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--secondary)',
            borderRight: lang === 'ar' ? '4px solid var(--secondary)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('admin_users_count')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--secondary)', marginTop: '0.3rem' }}>
              {stats.users.total}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {lang === 'fr' ? `🎓 ${stats.users.teachers} Profs • 📖 ${stats.users.students} Étudiants` : lang === 'ar' ? `🎓 ${stats.users.teachers} معلمين • 📖 ${stats.users.students} طلاب` : `🎓 ${stats.users.teachers} Teachers • 📖 ${stats.users.students} Students`}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--primary)',
            borderRight: lang === 'ar' ? '4px solid var(--primary)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('admin_resources_count')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary)', marginTop: '0.3rem' }}>
              {stats.resources.total}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {lang === 'fr' ? `📄 ${stats.resources.pdf} PDF • 🎥 ${stats.resources.video} Vidéos` : lang === 'ar' ? `📄 ${stats.resources.pdf} ملف PDF • 🎥 ${stats.resources.video} فيديو` : `📄 ${stats.resources.pdf} PDF • 🎥 ${stats.resources.video} Videos`}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-orange)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-orange)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('admin_flashcards_count')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-orange)', marginTop: '0.3rem' }}>
              {stats.flashcards.total}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('admin_flashcards_desc')}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-green)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-green)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('admin_reviews_count')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-green)', marginTop: '0.3rem' }}>
              {stats.reviews.total}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('admin_reviews_desc')}
            </p>
          </div>
        </div>

        {/* Global info panel */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>{t('admin_guide_title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.55' }}>
            {t('admin_guide_desc')}
          </p>
        </div>

      </div>
    );
  };

  // --- RENDU 2 : CONTRÔLE DES UTILISATEURS ---
  const renderUsersView = () => {
    return (
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.2rem' }}>{t('admin_users_title')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {t('admin_users_sub')}
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{lang === 'fr' ? 'Chargement des utilisateurs...' : lang === 'ar' ? 'جاري تحميل المستخدمين...' : 'Loading users...'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: lang === 'ar' ? 'right' : 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_name')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_email')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_role')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_spec')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'left' : 'right' }}>{t('admin_table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '1.1rem 1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{u.nom}</td>
                    <td style={{ padding: '1.1rem 1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '1.1rem 1rem' }}>
                      <select 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ 
                          padding: '0.35rem 0.6rem', 
                          width: '135px', 
                          fontSize: '0.8rem', 
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.25)',
                          borderColor: 'var(--border-glass)'
                        }}
                        disabled={u.id === currentUser.id}
                      >
                        <option value="etudiant">{t('student')}</option>
                        <option value="enseignant">{t('teacher')}</option>
                        <option value="admin">{t('admin')}</option>
                      </select>
                    </td>
                    <td style={{ padding: '1.1rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {u.specialite ? (
                        <span style={{ color: 'var(--secondary)', fontWeight: '600' }}>{lang === 'fr' ? `Prof: ${u.specialite}` : lang === 'ar' ? `معلّم: ${u.specialite}` : `Teacher: ${u.specialite}`}</span>
                      ) : u.niveauEtude ? (
                        <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{lang === 'fr' ? `Étu: ${u.niveauEtude}` : lang === 'ar' ? `طالب: ${u.niveauEtude}` : `Student: ${u.niveauEtude}`}</span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '1.1rem 1rem', textAlign: lang === 'ar' ? 'left' : 'right' }}>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDeleteUser(u.id)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                        disabled={u.id === currentUser.id}
                      >
                        {lang === 'fr' ? 'Supprimer' : lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // --- RENDU 3 : CONTRÔLE DES RESSOURCES ---
  const renderResourcesView = () => {
    return (
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.2rem' }}>{t('admin_resources_title')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {t('admin_resources_sub')}
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{lang === 'fr' ? 'Chargement des ressources...' : lang === 'ar' ? 'جاري تحميل الموارد...' : 'Loading resources...'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: lang === 'ar' ? 'right' : 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_title')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{lang === 'fr' ? 'Type' : lang === 'ar' ? 'النوع' : 'Type'}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_author')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'right' : 'left' }}>{t('admin_table_status')}</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: lang === 'ar' ? 'left' : 'right' }}>{t('admin_table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(res => (
                  <tr key={res.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '1.1rem 1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{res.titre}</td>
                    <td style={{ padding: '1.1rem 1rem' }}>
                      {res.type === 'pdf' ? (lang === 'fr' ? '📄 PDF' : lang === 'ar' ? '📄 ملف PDF' : '📄 PDF') : (lang === 'fr' ? '🎥 Vidéo' : lang === 'ar' ? '🎥 فيديو' : '🎥 Video')}
                    </td>
                    <td style={{ padding: '1.1rem 1rem', color: 'var(--secondary)', fontWeight: '600' }}>{res.enseignantNom}</td>
                    <td style={{ padding: '1.1rem 1rem' }}>
                      {res.estValide ? (
                        <span className="badge badge-comprehension" style={{ fontSize: '0.65rem' }}>{lang === 'fr' ? 'Validé' : lang === 'ar' ? 'مقبول' : 'Validated'}</span>
                      ) : (
                        <span className="badge badge-application" style={{ 
                          fontSize: '0.65rem', 
                          background: 'rgba(245, 158, 11, 0.08)', 
                          color: 'var(--accent-orange)' 
                        }}>
                          {t('teacher_list_draft')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1.1rem 1rem', textAlign: lang === 'ar' ? 'left' : 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        {!res.estValide && (
                          <button 
                            className="btn btn-accent" 
                            onClick={() => handleToggleValidateResource(res.id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                          >
                            {t('admin_table_val_btn')}
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => onViewResource(res.id)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                        >
                          {t('admin_table_open_btn')}
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDeleteResource(res.id)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                        >
                          {t('admin_table_del_btn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  switch (viewMode) {
    case 'stats':
      return renderStatsView();
    case 'users':
      return renderUsersView();
    case 'resources':
      return renderResourcesView();
    default:
      return renderStatsView();
  }
}
