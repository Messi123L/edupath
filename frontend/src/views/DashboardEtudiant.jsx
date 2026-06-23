import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function DashboardEtudiant({ currentUser, viewMode, onViewResource }) {
  const { t, lang } = useLanguage();
  const [resources, setResources] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Récupérer les ressources validées
      const resResources = await fetch('http://localhost:5000/api/resources?role=etudiant');
      if (resResources.ok) {
        const data = await resResources.json();
        setResources(data);
      }

      // 2. Récupérer les statistiques de révision de l'étudiant
      const resStats = await fetch(`http://localhost:5000/api/students/${currentUser.id}/stats`);
      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }

    } catch (err) {
      console.error("Erreur de chargement des données étudiant:", err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 18) return t('greeting_morning');
    return t('greeting_evening');
  };

  // --- RENDU 1 : VUE STATISTIQUES (OVERVIEW) ---
  const renderStatsView = () => {
    const localeStr = lang === 'ar' ? 'ar-EG' : (lang === 'fr' ? 'fr-FR' : 'en-US');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Welcome card */}
        <div className="glass-panel" style={{ 
          padding: '2rem', 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.03) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.4rem' }}>
              {getGreeting()}, <span className="gradient-text">{currentUser.nom}</span> !
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t('greeting_ready')}
            </p>
          </div>
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.25)',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-glass)'
          }}>
            📅 {new Date().toLocaleDateString(localeStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.2rem'
        }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--primary)',
            borderRight: lang === 'ar' ? '4px solid var(--primary)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('total_reviews')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary)', marginTop: '0.3rem' }}>
              {stats ? stats.totalReviews : 0}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('total_reviews_desc')}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-green)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-green)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('learned_concepts')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-green)', marginTop: '0.3rem' }}>
              {stats ? stats.learnedCards : 0}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('learned_concepts_desc')}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-orange)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-orange)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('daily_reviews')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-orange)', marginTop: '0.3rem' }}>
              {stats ? stats.reviewDueCount : 0}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('daily_reviews_desc')}
            </p>
          </div>
        </div>

        {/* Due Revision Alert Box */}
        {stats && stats.reviewDueCount > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: 'var(--accent-orange)',
            padding: '1.2rem',
            borderRadius: '16px',
            fontSize: '0.88rem',
            fontWeight: '700',
            textAlign: 'center',
            animation: 'pulse 2.5s infinite'
          }}>
            {t('daily_reviews_alert').replace('{count}', stats.reviewDueCount)}
          </div>
        )}

        {/* Bloom levels charts */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.3rem' }}>{t('bloom_counts_title')}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            {t('bloom_counts_desc')}
          </p>

          {stats && Object.keys(stats.bloomCounts).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {Object.entries(stats.bloomCounts).map(([level, count]) => {
                const total = stats.totalReviews || 1;
                const pct = Math.round((count / total) * 100);
                
                return (
                  <div key={level} style={{
                    background: 'rgba(0,0,0,0.18)',
                    border: '1px solid var(--border-glass)',
                    padding: '1.1rem 1.4rem',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{level}</span>
                      <span style={{ fontWeight: '800', color: 'var(--secondary)' }}>{count} {lang === 'fr' ? 'concept(s)' : lang === 'ar' ? 'مفهوم/مفاهيم' : 'concept(s)'}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${pct}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {pct}% {lang === 'fr' ? "du volume d'étude" : lang === 'ar' ? "من حجم الدراسة" : "of study volume"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t('bloom_counts_empty')}
            </div>
          )}
        </div>

      </div>
    );
  };

  // --- RENDU 2 : CATALOGUE DE COURS ---
  const renderCatalogView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('courses_catalog_desc')}
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{lang === 'fr' ? 'Chargement des ressources...' : lang === 'ar' ? 'جاري تحميل الموارد...' : 'Loading resources...'}</p>
        ) : resources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }} className="glass-panel">
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🎓</span>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '700' }}>{t('courses_empty')}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              {t('courses_empty_desc')}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {resources.map(res => (
              <div 
                key={res.id}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  background: 'rgba(15, 23, 42, 0.45)',
                  minHeight: '180px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.8rem' }}>{res.type === 'pdf' ? '📄' : '🎥'}</span>
                    <span className="badge badge-memorisation" style={{ fontSize: '0.62rem' }}>
                      {res.type === 'pdf' ? t('courses_card_type_pdf') : t('courses_card_type_video')}
                    </span>
                  </div>
                  
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'white', lineHeight: '1.3', marginTop: '0.2rem' }}>
                    {res.titre}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>{t('courses_card_author')} : <strong style={{ color: 'var(--secondary)' }}>{res.enseignantNom}</strong></span>
                    <span>{t('courses_card_published')} : {new Date(res.dateCreation).toLocaleDateString(lang === 'ar' ? 'ar-EG' : (lang === 'fr' ? 'fr-FR' : 'en-US'))}</span>
                  </div>
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={() => onViewResource(res.id)}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.82rem' }}
                >
                  {t('courses_card_study_btn')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- RENDU 3 : GUIDE PEDAGOGIQUE ---
  const renderGuideView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="glass-panel">
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.4rem', fontWeight: '800' }}>{t('guide_title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t('guide_intro')}
            </p>
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ 
              borderLeft: lang === 'ar' ? 'none' : '4px solid var(--primary)', 
              borderRight: lang === 'ar' ? '4px solid var(--primary)' : 'none', 
              paddingLeft: lang === 'ar' ? '0' : '1.2rem',
              paddingRight: lang === 'ar' ? '1.2rem' : '0'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '750', color: 'white', marginBottom: '0.3rem' }}>
                {t('guide_sect1_title')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {t('guide_sect1_desc')}
              </p>
            </div>

            <div style={{ 
              borderLeft: lang === 'ar' ? 'none' : '4px solid var(--secondary)', 
              borderRight: lang === 'ar' ? '4px solid var(--secondary)' : 'none', 
              paddingLeft: lang === 'ar' ? '0' : '1.2rem',
              paddingRight: lang === 'ar' ? '1.2rem' : '0'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '750', color: 'white', marginBottom: '0.3rem' }}>
                {t('guide_sect2_title')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {t('guide_sect2_desc')}
              </p>
              <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: lang === 'ar' ? '0' : '1.5rem', paddingRight: lang === 'ar' ? '1.5rem' : '0', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <li>{t('guide_bloom_lvl1')}</li>
                <li>{t('guide_bloom_lvl2')}</li>
                <li>{t('guide_bloom_lvl3')}</li>
                <li>{t('guide_bloom_lvl4')}</li>
                <li>{t('guide_bloom_lvl5')}</li>
                <li>{t('guide_bloom_lvl6')}</li>
              </ul>
            </div>

            <div style={{ 
              borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-green)', 
              borderRight: lang === 'ar' ? '4px solid var(--accent-green)' : 'none', 
              paddingLeft: lang === 'ar' ? '0' : '1.2rem',
              paddingRight: lang === 'ar' ? '1.2rem' : '0'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '750', color: 'white', marginBottom: '0.3rem' }}>
                {t('guide_sect3_title')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {t('guide_sect3_desc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Rendu de la sous-vue active selon viewMode
  switch (viewMode) {
    case 'stats':
      return renderStatsView();
    case 'catalog':
      return renderCatalogView();
    case 'guide':
      return renderGuideView();
    default:
      return renderStatsView();
  }
}
