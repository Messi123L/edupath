import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function DashboardEnseignant({ currentUser, viewMode, onViewResource }) {
  const { t, lang } = useLanguage();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [titre, setTitre] = useState('');
  const [file, setFile] = useState(null);
  const [resourceType, setResourceType] = useState('pdf'); // 'pdf' ou 'video'
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Active jobs for polling
  const [activeJobs, setActiveJobs] = useState([]);

  useEffect(() => {
    fetchResources();
  }, []);

  // Cleanup polling timers
  useEffect(() => {
    const intervals = activeJobs.map(job => {
      return setInterval(() => pollJobStatus(job.id), 2500);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [activeJobs]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/resources?role=enseignant`);
      if (res.ok) {
        const data = await res.json();
        // Filter resources created by this teacher
        setResources(data.filter(r => r.creePar === currentUser.id));
      }
    } catch (err) {
      console.error("Erreur de chargement des ressources:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
      if (res.ok) {
        const job = await res.json();
        if (job.statut === 'termine') {
          setActiveJobs(prev => prev.filter(j => j.id !== jobId));
          fetchResources();
        } else if (job.statut === 'erreur') {
          setActiveJobs(prev => prev.filter(j => j.id !== jobId));
          alert(`${lang === 'fr' ? 'Erreur de génération IA' : lang === 'ar' ? 'خطأ في توليد الذكاء الاصطناعي' : 'AI generation error'} : ${job.erreurMessage}`);
          fetchResources();
        }
      }
    } catch (err) {
      console.error("Erreur lors du polling du job:", err);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    if (e.target.files[0] && !titre) {
      // Set default title
      const nameWithoutExt = e.target.files[0].name.replace(/\.[^/.]+$/, "");
      setTitre(nameWithoutExt);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadError('');

    if (!titre) {
      setUploadError("Le titre de la ressource est obligatoire.");
      return;
    }
    if (resourceType === 'pdf' && !file) {
      setUploadError("Veuillez sélectionner un fichier PDF.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('titre', titre);
      formData.append('creePar', currentUser.id);
      formData.append('type', resourceType);

      if (resourceType === 'pdf') {
        formData.append('file', file);
      } else {
        formData.append('videoUrl', videoUrl);
      }

      const res = await fetch('http://localhost:5000/api/resources/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const result = await res.json();
        
        // Reset form
        setTitre('');
        setFile(null);
        setVideoUrl('');
        const fileInput = document.getElementById('pdf-file-input');
        if (fileInput) fileInput.value = '';

        if (result.cached) {
          alert(lang === 'fr' ? "Ressource importée instantanément grâce au cache intelligent de l'IA !" : lang === 'ar' ? "تم استيراد المورد فوراً بفضل ذاكرة التخزين المؤقت الذكية للذكاء الاصطناعي!" : "Resource imported instantly thanks to the AI intelligent cache!");
          fetchResources();
        } else {
          setActiveJobs(prev => [...prev, { id: result.jobId, title: titre, resourceId: result.resource.id }]);
          fetchResources();
        }
      } else {
        const errorData = await res.json();
        setUploadError(errorData.error || (lang === 'fr' ? "Erreur de téléversement." : lang === 'ar' ? "خطأ في التحميل." : "Upload error."));
      }
    } catch (err) {
      setUploadError(lang === 'fr' ? "Impossible d'envoyer le fichier au serveur." : lang === 'ar' ? "تعذر إرسال الملف إلى الخادم." : "Unable to send file to server.");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/resources/${id}/validate`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchResources();
      }
    } catch (err) {
      console.error("Erreur de publication:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === 'fr' ? "Voulez-vous vraiment supprimer cette ressource ainsi que la carte mentale et les flashcards associées ?" : lang === 'ar' ? "هل تريد حقًا حذف هذا المورد بالإضافة إلى الخريطة الذهنية والبطاقات التعليمية المرتبطة به؟" : "Do you really want to delete this resource along with the associated mind map and flashcards?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/resources/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchResources();
      }
    } catch (err) {
      console.error("Erreur de suppression:", err);
    }
  };

  // --- RENDU 1 : VUE STATISTIQUES (TABLEAU DE BORD ENSEIGNANT) ---
  const renderStatsView = () => {
    const totalCreated = resources.length;
    const published = resources.filter(r => r.estValide).length;
    const drafts = totalCreated - published;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Welcome message */}
        <div className="glass-panel" style={{ 
          padding: '2rem', 
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.03) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.15)'
        }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.4rem' }}>
            {t('teacher_dashboard_title')}, <span className="gradient-text">{currentUser.nom}</span> !
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('teacher_dashboard_desc')}
          </p>
        </div>

        {/* Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.2rem'
        }}>
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.03) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--secondary)',
            borderRight: lang === 'ar' ? '4px solid var(--secondary)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('teacher_courses_imported')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--secondary)', marginTop: '0.3rem' }}>
              {totalCreated}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('teacher_courses_imported_desc')}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-green)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-green)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('teacher_courses_published')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-green)', marginTop: '0.3rem' }}>
              {published}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('teacher_courses_published_desc')}
            </p>
          </div>

          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(15, 23, 42, 0.5) 100%)',
            borderLeft: lang === 'ar' ? 'none' : '4px solid var(--accent-orange)',
            borderRight: lang === 'ar' ? '4px solid var(--accent-orange)' : 'none'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('teacher_courses_drafts')}
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-orange)', marginTop: '0.3rem' }}>
              {drafts}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {t('teacher_courses_drafts_desc')}
            </p>
          </div>
        </div>

        {/* Informative onboarding panel */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>{t('teacher_guide_title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {t('teacher_guide_desc')}
          </p>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: lang === 'ar' ? '0' : '1.2rem', paddingRight: lang === 'ar' ? '1.2rem' : '0', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
            <li>{t('teacher_guide_tip1')}</li>
            <li>{t('teacher_guide_tip2')}</li>
            <li>{t('teacher_guide_tip3')}</li>
          </ul>
        </div>

      </div>
    );
  };

  // --- RENDU 2 : IMPORTS & LISTE DES COURS ---
  const renderUploadsView = () => {
    return (
      <div className="teacher-upload-grid">
        
        {/* Formulaire d'importation et Jobs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.2rem' }}>{t('teacher_upload_title')}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.35' }}>
                {t('teacher_upload_desc')}
              </p>
            </div>

            {uploadError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.78rem'
              }}>
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                  {t('teacher_upload_type')}
                </label>
                <select value={resourceType} onChange={e => setResourceType(e.target.value)}>
                  <option value="pdf">{t('teacher_upload_pdf')}</option>
                  <option value="video">{t('teacher_upload_video')}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                  {t('teacher_upload_doc_title')}
                </label>
                <input 
                  type="text" 
                  placeholder={lang === 'fr' ? "Ex. Algorithmes de tri" : lang === 'ar' ? "مثال: خوارزميات الترتيب" : "e.g., Sorting algorithms"}
                  value={titre} 
                  onChange={e => setTitre(e.target.value)} 
                  required 
                />
              </div>

              {resourceType === 'pdf' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                    {t('teacher_upload_source')}
                  </label>
                  <div style={{
                    border: '1.5px dashed var(--border-glass)',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.18)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                  >
                    <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.3rem' }}>📥</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                      {file ? file.name : t('teacher_upload_choose')}
                    </span>
                    <input 
                      type="file" 
                      id="pdf-file-input"
                      accept=".pdf"
                      onChange={handleFileChange}
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                      required 
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    {t('teacher_upload_url')}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex. https://www.youtube.com/watch?v=..." 
                    value={videoUrl} 
                    onChange={e => setVideoUrl(e.target.value)} 
                    required 
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ justifyContent: 'center', marginTop: '0.4rem', padding: '0.7rem' }} 
                disabled={uploading}
              >
                {uploading ? t('teacher_upload_progress') : t('teacher_upload_submit')}
              </button>
            </form>
          </div>

          {/* Active Job Tracker */}
          {activeJobs.length > 0 && (
            <div className="glass-panel" style={{ 
              padding: '1.2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.8rem', 
              border: '1px solid rgba(6, 182, 212, 0.3)' 
            }}>
              <h3 style={{ fontSize: '0.88rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary)', animation: 'pulse-glow 1.5s infinite' }}></span>
                {t('teacher_active_jobs')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {activeJobs.map(job => (
                  <div key={job.id} style={{ 
                    fontSize: '0.78rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '0.6rem 0.8rem', 
                    borderRadius: '10px', 
                    border: '1px solid var(--border-glass)' 
                  }}>
                    <div style={{ fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{job.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                      {t('teacher_active_jobs_desc')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Liste des cours créés */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem', fontWeight: '800' }}>{t('teacher_list_title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {t('teacher_list_desc')}
            </p>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{lang === 'fr' ? 'Chargement de vos ressources...' : lang === 'ar' ? 'جاري تحميل مواردك...' : 'Loading your resources...'}</p>
          ) : resources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>📚</div>
              <p style={{ fontWeight: '600' }}>{t('teacher_list_empty')}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {t('teacher_list_empty_desc')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {resources.map(res => (
                <div 
                  key={res.id}
                  style={{
                    padding: '1.1rem 1.3rem',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.015)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{res.type === 'pdf' ? '📄' : '🎥'}</span>
                      <h3 style={{ fontSize: '1.02rem', fontWeight: '755', margin: 0, color: 'white' }}>
                        {res.titre}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {t('teacher_list_created_at')} {new Date(res.dateCreation).toLocaleDateString(lang === 'ar' ? 'ar-EG' : (lang === 'fr' ? 'fr-FR' : 'en-US'))}
                      </span>
                      {res.estValide ? (
                        <span className="badge badge-comprehension" style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem' }}>
                          {t('teacher_list_online')}
                        </span>
                      ) : (
                        <span className="badge badge-application" style={{ 
                          fontSize: '0.6rem', 
                          padding: '0.15rem 0.5rem',
                          background: 'rgba(245, 158, 11, 0.08)', 
                          color: 'var(--accent-orange)' 
                        }}>
                          {t('teacher_list_draft')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!res.estValide && (
                      <button 
                        className="btn btn-accent" 
                        onClick={() => handlePublish(res.id)}
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', borderRadius: '10px' }}
                      >
                        {t('teacher_list_publish_btn')}
                      </button>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => onViewResource(res.id)}
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', borderRadius: '10px' }}
                    >
                      {t('teacher_list_review_btn')}
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(res.id)}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', borderRadius: '10px' }}
                    >
                      {t('teacher_list_delete_btn')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  };

  switch (viewMode) {
    case 'stats':
      return renderStatsView();
    case 'uploads':
      return renderUploadsView();
    default:
      return renderStatsView();
  }
}
