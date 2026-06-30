import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function Auth({ onLoginSuccess }) {
  const { t, lang } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showDemos, setShowDemos] = useState(false);

  // Signup states
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [role, setRole] = useState('etudiant');
  const [specialite, setSpecialite] = useState('');
  const [niveauEtude, setNiveauEtude] = useState('');
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des utilisateurs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user) => {
    setLoginError('');
    let password = 'password123'; // Default fallback
    if (user.email === 'jean.martin@edupath.fr') password = 'jean123';
    else if (user.email === 'lucas.bernard@etu.edupath.fr') password = 'lucas123';
    else if (user.email === 'admin@edupath.fr') password = 'admin123';

    try {
      const res = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password })
      });

      if (res.ok) {
        const loggedInUser = await res.json();
        onLoginSuccess(loggedInUser);
      } else {
        const errData = await res.json();
        setLoginError(errData.error || "Erreur de connexion démo.");
      }
    } catch (err) {
      setLoginError("Impossible de contacter le serveur.");
    }
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError(lang === 'fr' ? "L'email et le mot de passe sont requis." : lang === 'ar' ? "البريد الإلكتروني وكلمة المرور مطلوبان." : "Email and password are required.");
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      });

      if (res.ok) {
        const user = await res.json();
        onLoginSuccess(user);
      } else {
        const data = await res.json();
        setLoginError(data.error || (lang === 'fr' ? "Email ou mot de passe incorrect." : lang === 'ar' ? "البريد الإلكتروني أو كلمة المرور غير صحيحة." : "Invalid email or password."));
      }
    } catch (err) {
      setLoginError(lang === 'fr' ? "Impossible de contacter le serveur." : lang === 'ar' ? "تعذر الاتصال بالخادم." : "Could not connect to server.");
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');

    if (!nom || !email || !signupPassword) {
      setSignupError(lang === 'fr' ? "Tous les champs requis doivent être remplis." : lang === 'ar' ? "يجب ملء جميع الحقول المطلوبة." : "All required fields must be filled.");
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          email,
          role,
          motDePasse: signupPassword,
          specialite: role === 'enseignant' ? specialite : undefined,
          niveauEtude: role === 'etudiant' ? niveauEtude : undefined
        })
      });

      if (res.ok) {
        const user = await res.json();
        onLoginSuccess(user);
      } else {
        const data = await res.json();
        setSignupError(data.error || "Une erreur est survenue lors de l'inscription.");
      }
    } catch (err) {
      setSignupError(lang === 'fr' ? "Impossible de contacter le serveur." : lang === 'ar' ? "تعذر الاتصال بالخادم." : "Could not connect to server.");
    }
  };

  return (
    <div className="auth-layout-grid animate-fade-in">
      
      {/* Colonne gauche : Introduction cognitive */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <span style={{ 
            background: 'rgba(139, 92, 246, 0.1)', 
            color: 'var(--primary)', 
            padding: '0.3rem 0.8rem', 
            borderRadius: '99px',
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: '1px solid rgba(139, 92, 246, 0.2)'
          }}>
            {t('subtitle')}
          </span>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '1rem', lineHeight: '1.2' }}>
            {t('welcome')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.8rem', lineHeight: '1.5' }}>
            {t('tagline')}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>🧠</span>
            <div>
              <h4 style={{ fontWeight: '750', fontSize: '0.9rem' }}>{t('mindmap_title')}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{t('mindmap_desc')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--secondary)' }}>📇</span>
            <div>
              <h4 style={{ fontWeight: '750', fontSize: '0.9rem' }}>{t('bloom_title')}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{t('bloom_desc')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--accent-green)' }}>🔁</span>
            <div>
              <h4 style={{ fontWeight: '750', fontSize: '0.9rem' }}>{t('sm2_title')}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{t('sm2_desc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Colonne droite : Formulaire de connexion / inscription */}
      <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.8rem', minHeight: '520px', width: '100%' }}>
        
        {authMode === 'login' ? (
          /* CONNEXION (LOGIN) */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>{t('login_mode_btn')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {lang === 'fr' ? "Connectez-vous à votre espace personnel avec vos identifiants." : lang === 'ar' ? "قم بتسجيل الدخول إلى مساحتك الشخصية باستخدام بيانات الاعتماد الخاصة بك." : "Log in to your personal space using your credentials."}
              </p>
            </div>

            {loginError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem'
              }}>
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                  {t('email_addr')}
                </label>
                <input 
                  type="email" 
                  placeholder="nom@exemple.com" 
                  value={loginEmail} 
                  onChange={e => setLoginEmail(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                  {lang === 'fr' ? "Mot de passe" : lang === 'ar' ? "كلمة المرور" : "Password"}
                </label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={loginPassword} 
                  onChange={e => setLoginPassword(e.target.value)} 
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem', marginTop: '0.5rem' }}
              >
                {t('login_btn')}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setAuthMode('signup')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {t('switch_to_signup')}
              </button>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '0.5rem 0' }} />

            {/* Test Profiles Collapsible Grid */}
            <div>
              <button
                onClick={() => setShowDemos(!showDemos)}
                style={{
                  background: 'var(--bg-overlay-light)',
                  border: '1px solid var(--border-glass)',
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.82rem',
                  width: '100%',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <span>👤 {t('demo_profiles_label')}</span>
                <span>{showDemos ? '▲' : '▼'}</span>
              </button>

              {showDemos && (
                <div style={{ 
                  marginTop: '0.8rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.6rem', 
                  maxHeight: '220px', 
                  overflowY: 'auto', 
                  paddingRight: '4px',
                  animation: 'fadeIn 0.25s ease'
                }}>
                  {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading...</p>
                  ) : (
                    users.map(user => {
                      let roleColor = 'var(--primary)';
                      let roleText = t('student');
                      let badgeClass = 'badge-memorisation';
                      
                      if (user.role === 'enseignant') {
                        roleColor = 'var(--secondary)';
                        roleText = t('teacher');
                        badgeClass = 'badge-comprehension';
                      } else if (user.role === 'admin') {
                        roleColor = 'var(--accent-red)';
                        roleText = t('admin');
                        badgeClass = 'badge-evaluation';
                      }

                      return (
                        <div 
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          style={{
                            padding: '0.8rem 1rem',
                            borderRadius: '10px',
                            background: 'var(--bg-overlay-light)',
                            border: '1px solid var(--border-glass)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-overlay-medium)';
                            e.currentTarget.style.borderColor = roleColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--bg-overlay-light)';
                            e.currentTarget.style.borderColor = 'var(--border-glass)';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                            <span style={{ fontWeight: '750', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{user.nom}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.email}</span>
                          </div>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>
                            {roleText}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* INSCRIPTION (SIGNUP) */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>{t('signup_mode_btn')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {t('create_profile_desc')}
              </p>
            </div>

            {signupError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem'
              }}>
                ⚠️ {signupError}
              </div>
            )}

            <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                  {t('full_name')}
                </label>
                <input 
                  type="text" 
                  placeholder="Marie Dupont" 
                  value={nom} 
                  onChange={e => setNom(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                  {t('email_addr')}
                </label>
                <input 
                  type="email" 
                  placeholder="marie.dupont@edupath.fr" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                  {lang === 'fr' ? "Mot de passe" : lang === 'ar' ? "كلمة المرور" : "Password"}
                </label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={signupPassword} 
                  onChange={e => setSignupPassword(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                  {t('role_label')}
                </label>
                <div className="role-card-container">
                  <div 
                    className={`role-select-card etudiant ${role === 'etudiant' ? 'active' : ''}`}
                    onClick={() => setRole('etudiant')}
                  >
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.1rem' }}>📖</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700' }}>{t('student')}</div>
                  </div>
                  <div 
                    className={`role-select-card enseignant ${role === 'enseignant' ? 'active' : ''}`}
                    onClick={() => setRole('enseignant')}
                  >
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.1rem' }}>🎓</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700' }}>{t('teacher')}</div>
                  </div>
                </div>
              </div>

              {role === 'enseignant' && (
                <div className="animate-fade-in">
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                    {t('admin_table_spec')}
                  </label>
                  <input 
                    type="text" 
                    placeholder={t('specialty_placeholder')}
                    value={specialite} 
                    onChange={e => setSpecialite(e.target.value)} 
                  />
                </div>
              )}

              {role === 'etudiant' && (
                <div className="animate-fade-in">
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: '600' }}>
                    {t('admin_table_spec')}
                  </label>
                  <input 
                    type="text" 
                    placeholder={t('grade_placeholder')}
                    value={niveauEtude} 
                    onChange={e => setNiveauEtude(e.target.value)} 
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ marginTop: '0.5rem', padding: '0.75rem', fontSize: '0.88rem' }}
              >
                {t('register_button')}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setAuthMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {t('switch_to_login')}
              </button>
            </div>

          </div>
        )}

      </div>
      
    </div>
  );
}
