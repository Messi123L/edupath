import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function FlashcardDeck({ resourceId, currentUser }) {
  const { t, lang } = useLanguage();
  const [cards, setCards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [selectedBloom, setSelectedBloom] = useState('');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionStats, setSessionStats] = useState({ knows: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  const bloomLevels = [
    { value: '', label: t('all_levels') },
    { value: 'Mémorisation', label: lang === 'fr' ? '1. Mémorisation' : lang === 'ar' ? '1. التذكر' : '1. Remembering' },
    { value: 'Compréhension', label: lang === 'fr' ? '2. Compréhension' : lang === 'ar' ? '2. الفهم' : '2. Understanding' },
    { value: 'Application', label: lang === 'fr' ? '3. Application' : lang === 'ar' ? '3. التطبيق' : '3. Applying' },
    { value: 'Analyse', label: lang === 'fr' ? '4. Analyse' : lang === 'ar' ? '4. التحليل' : '4. Analyzing' },
    { value: 'Évaluation', label: lang === 'fr' ? '5. Évaluation' : lang === 'ar' ? '5. التقييم' : '5. Evaluating' },
    { value: 'Création', label: lang === 'fr' ? '6. Création' : lang === 'ar' ? '6. الابتكار' : '6. Creating' }
  ];

  // Load flashcards
  useEffect(() => {
    fetchCards();
  }, [resourceId, lang]);

  // Filter flashcards when selection changes
  useEffect(() => {
    if (selectedBloom === '') {
      setFilteredCards(cards);
    } else {
      setFilteredCards(cards.filter(c => c.niveauBloom.toLowerCase() === selectedBloom.toLowerCase()));
    }
    // Reset session
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setSessionStats({ knows: 0, reviews: 0 });
  }, [selectedBloom, cards]);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/flashcards?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data);
        setFilteredCards(data);
      }
    } catch (error) {
      console.error("Erreur de chargement des flashcards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (rating) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    // Send review score to backend for SM-2
    try {
      await fetch(`http://localhost:5000/api/flashcards/${currentCard.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          rating: rating // 'sais' or 'revoir'
        })
      });
    } catch (error) {
      console.error("Erreur d'envoi de la statistique de révision :", error);
    }

    // Update local session stats
    setSessionStats(prev => ({
      knows: prev.knows + (rating === 'sais' ? 1 : 0),
      reviews: prev.reviews + (rating === 'revoir' ? 1 : 0)
    }));

    // Go to next card after flip animation
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex + 1 < filteredCards.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setSessionCompleted(true);
      }
    }, 250);
  };

  const restartSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
    setSessionStats({ knows: 0, reviews: 0 });
  };

  const getBloomBadgeClass = (level) => {
    switch (level) {
      case 'Mémorisation': return 'badge-memorisation';
      case 'Compréhension': return 'badge-comprehension';
      case 'Application': return 'badge-application';
      case 'Analyse': return 'badge-analyse';
      case 'Évaluation': return 'badge-evaluation';
      case 'Création': return 'badge-creation';
      default: return 'badge-memorisation';
    }
  };

  const translateBloomLevel = (lvl) => {
    if (!lvl) return '';
    const lower = lvl.toLowerCase();
    if (lower.includes('mémo') || lower.includes('remem') || lower.includes('ذكر')) return lang === 'fr' ? 'Mémorisation' : lang === 'ar' ? 'التذكر' : 'Remembering';
    if (lower.includes('compr') || lower.includes('under') || lower.includes('فهم')) return lang === 'fr' ? 'Compréhension' : lang === 'ar' ? 'الفهم' : 'Understanding';
    if (lower.includes('appli') || lower.includes('طبق')) return lang === 'fr' ? 'Application' : lang === 'ar' ? 'التطبيق' : 'Applying';
    if (lower.includes('analy') || lower.includes('حلل')) return lang === 'fr' ? 'Analyse' : lang === 'ar' ? 'التحليل' : 'Analyzing';
    if (lower.includes('éval') || lower.includes('eval') || lower.includes('قيم')) return lang === 'fr' ? 'Évaluation' : lang === 'ar' ? 'التقييم' : 'Evaluating';
    if (lower.includes('créa') || lower.includes('creat') || lower.includes('بتك')) return lang === 'fr' ? 'Création' : lang === 'ar' ? 'الابتكار' : 'Creating';
    return lvl;
  };

  const getEncouragementText = () => {
    const { knows, reviews } = sessionStats;
    const total = knows + reviews;
    if (total === 0) return t('flashcards_deck_completed');
    const ratio = knows / total;
    if (ratio === 1) {
      return lang === 'fr' 
        ? "🔥 Score Parfait ! Vous maîtrisez parfaitement ce module !" 
        : lang === 'ar' 
        ? "🔥 نتيجة مثالية! أنت تتقن هذا النموذج تمامًا!" 
        : "🔥 Perfect Score! You master this module perfectly!";
    }
    if (ratio >= 0.7) {
      return lang === 'fr' 
        ? "✨ Excellent travail ! Vos connexions neuronales sont solides." 
        : lang === 'ar' 
        ? "✨ عمل ممتاز! روابطك العصبية قوية." 
        : "✨ Excellent job! Your neural connections are solid.";
    }
    if (ratio >= 0.4) {
      return lang === 'fr' 
        ? "👍 Bien joué ! Continuez à réviser régulièrement pour consolider." 
        : lang === 'ar' 
        ? "👍 أحسنت! استمر في المراجعة بانتظام للترسيخ." 
        : "👍 Well done! Continue to review regularly to consolidate.";
    }
    return lang === 'fr' 
      ? "📚 Courage ! Repassez ces cartes régulièrement pour ancrer les concepts." 
      : lang === 'ar' 
      ? "📚 واصل المحاولة! راجع هذه البطاقات بانتظام لترسيخ المفاهيم." 
      : "📚 Keep going! Review these cards regularly to anchor concepts.";
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <p style={{ animation: 'pulse 1.5s infinite', color: 'var(--text-secondary)', fontWeight: '600' }}>{lang === 'fr' ? 'Chargement des flashcards...' : lang === 'ar' ? 'جاري تحميل البطاقات التعليمية...' : 'Loading flashcards...'}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.8rem' }}>📇</span>
        <p style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{lang === 'fr' ? "Aucune flashcard n'a été générée pour ce cours." : lang === 'ar' ? "لم يتم إنشاء أي بطاقات تعليمية لهذا المقرر." : "No flashcards have been generated for this course."}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{lang === 'fr' ? "L'analyse par l'IA a pu échouer ou n'est pas finalisée." : lang === 'ar' ? "قد تكون عملية التحليل بواسطة الذكاء الاصطناعي قد فشلت أو لم تنتهِ بعد." : "AI analysis may have failed or is not finalized."}</p>
      </div>
    );
  }

  const currentCard = filteredCards[currentIndex];

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem', fontWeight: '800' }}>{t('flashcards_deck_title')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {t('flashcards_deck_desc')}
          </p>
        </div>

        <div>
          <select
            value={selectedBloom}
            onChange={(e) => setSelectedBloom(e.target.value)}
            style={{ width: '230px', padding: '0.55rem 0.9rem', fontSize: '0.82rem', background: 'rgba(0,0,0,0.25)' }}
          >
            {bloomLevels.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredCards.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ⚠️ {t('flashcards_deck_empty')}
        </div>
      ) : !sessionCompleted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem', alignItems: 'center', width: '100%' }}>
          
          {/* Progress bar */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: '600' }}>
              <span>{lang === 'fr' ? `Carte ${currentIndex + 1} sur ${filteredCards.length}` : lang === 'ar' ? `بطاقة ${currentIndex + 1} من ${filteredCards.length}` : `Card ${currentIndex + 1} of ${filteredCards.length}`}</span>
              <span>{Math.round(((currentIndex) / filteredCards.length) * 100)}% {t('flashcards_deck_progress')}</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${((currentIndex) / filteredCards.length) * 100}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>
          </div>

          {/* 3D card wrapper */}
          <div className="flashcard-viewport">
            <div 
              className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              
              {/* Recto */}
              <div className="flashcard-face flashcard-front">
                <span className={`badge ${getBloomBadgeClass(currentCard.niveauBloom)}`} style={{ marginBottom: '1.8rem', alignSelf: 'flex-start' }}>
                  {t('bloom_level')} : {translateBloomLevel(currentCard.niveauBloom)}
                </span>
                <p style={{ fontSize: '1.25rem', fontWeight: '700', textAlign: 'center', lineHeight: '1.65', color: 'white' }}>
                  {currentCard.question}
                </p>
                <div style={{ marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔄</span> {lang === 'fr' ? "Cliquez pour retourner la carte" : lang === 'ar' ? "انقر لقلب البطاقة ورؤية الإجابة" : "Click to flip the card"}
                </div>
              </div>

              {/* Verso */}
              <div className="flashcard-face flashcard-back">
                <span className="badge" style={{ marginBottom: '1.8rem', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {lang === 'fr' ? "Réponse Explicative" : lang === 'ar' ? "الإجابة التوضيحية" : "Explanatory Answer"}
                </span>
                <p style={{ fontSize: '1.12rem', fontWeight: '600', textAlign: 'center', lineHeight: '1.65', color: 'var(--text-primary)' }}>
                  {currentCard.reponse}
                </p>
                <div style={{ marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔄</span> {lang === 'fr' ? "Cliquez pour revenir à la question" : lang === 'ar' ? "انقر للعودة إلى السؤال" : "Click to return to the question"}
                </div>
              </div>

            </div>
          </div>

          {/* SM-2 Buttons panel */}
          <div style={{ 
            height: '65px', 
            display: 'flex', 
            gap: '1.2rem', 
            justifyContent: 'center', 
            alignItems: 'center',
            opacity: isFlipped ? 1 : 0.35,
            pointerEvents: isFlipped ? 'auto' : 'none',
            transition: 'all 0.3s ease'
          }}>
            <button 
              className="btn btn-danger" 
              onClick={() => handleReview('revoir')}
              style={{ 
                padding: '0.75rem 2rem', 
                fontSize: '0.88rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.4) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)'
              }}
            >
              {t('flashcards_deck_revoir')}
            </button>
            <button 
              className="btn" 
              onClick={() => handleReview('sais')}
              style={{ 
                padding: '0.75rem 2rem', 
                fontSize: '0.88rem',
                borderRadius: '12px',
                color: 'white',
                background: 'linear-gradient(135deg, var(--accent-green) 0%, #166534 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                boxShadow: '0 4px 15px var(--accent-green-glow)'
              }}
            >
              {t('flashcards_deck_sais')}
            </button>
          </div>

        </div>
      ) : (
        /* Final celebration panel */
        <div className="animate-fade-in" style={{ padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.8rem', textAlign: 'center' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '18px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '2px solid var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.2rem',
            boxShadow: '0 0 20px var(--accent-green-glow)'
          }}>
            🎉
          </div>
          
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.4rem', fontWeight: '800' }}>{t('flashcards_deck_congrats')}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{getEncouragementText()}</p>
          </div>

          <div style={{ display: 'flex', gap: '2.5rem', background: 'rgba(0,0,0,0.3)', padding: '1.5rem 3rem', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-green)' }}>{sessionStats.knows}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>{lang === 'fr' ? "Je sais" : lang === 'ar' ? "أعرفها" : "I know"}</div>
            </div>
            <div style={{ borderRight: '1px solid var(--border-glass)' }} />
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-red)' }}>{sessionStats.reviews}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>{lang === 'fr' ? "À revoir" : lang === 'ar' ? "أود مراجعتها" : "To review"}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={restartSession} style={{ padding: '0.65rem 1.4rem' }}>
              {t('flashcards_deck_restart')}
            </button>
            {selectedBloom !== '' && (
              <button className="btn btn-primary" onClick={() => setSelectedBloom('')} style={{ padding: '0.65rem 1.4rem' }}>
                {t('all_levels')}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
