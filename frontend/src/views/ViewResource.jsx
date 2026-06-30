import React, { useState, useEffect, useRef } from 'react';
import MindMapViewer from '../components/MindMapViewer';
import FlashcardDeck from '../components/FlashcardDeck';
import { useLanguage } from '../utils/LanguageContext';

// Basic markdown-to-HTML helper for Synthèse tab
const renderMarkdownToHtml = (md) => {
  if (!md) return '';
  
  // 1. Extract mermaid code blocks to preserve them from escaping
  const mermaidBlocks = [];
  let blockId = 0;
  
  let parsedMd = md.replace(/```mermaid([\s\S]*?)```/g, (match, code) => {
    const id = `__MERMAID_BLOCK_${blockId}__`;
    mermaidBlocks.push({ id, code: code.trim() });
    blockId++;
    return id;
  });

  // 2. Escape HTML characters in the rest of the text for safety
  let html = parsedMd
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold text: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic text: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');

  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Check if this line is a placeholder for a mermaid block
    if (trimmed.startsWith('__MERMAID_BLOCK_') && trimmed.endsWith('__')) {
      const match = mermaidBlocks.find(b => b.id === trimmed);
      if (match) {
        const listSuffix = inList ? '</ul>' : '';
        inList = false;
        // Output raw mermaid container with the raw code (unescaped)
        return `${listSuffix}<div class="mermaid" style="background: var(--bg-card); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; overflow-x: auto; border: 1px solid var(--border-glass); display: flex; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">${match.code}</div>`;
      }
    }

    // Unordered lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      let listPrefix = '';
      if (!inList) {
        inList = true;
        listPrefix = '<ul class="markdown-list">';
      }
      return `${listPrefix}<li>${content}</li>`;
    } 
    
    // Headings
    if (trimmed.startsWith('### ')) {
      const content = trimmed.substring(4);
      const listSuffix = inList ? '</ul>' : '';
      inList = false;
      return `${listSuffix}<h4 class="markdown-h4">${content}</h4>`;
    }
    if (trimmed.startsWith('## ')) {
      const content = trimmed.substring(3);
      const listSuffix = inList ? '</ul>' : '';
      inList = false;
      return `${listSuffix}<h3 class="markdown-h3">${content}</h3>`;
    }
    if (trimmed.startsWith('# ')) {
      const content = trimmed.substring(2);
      const listSuffix = inList ? '</ul>' : '';
      inList = false;
      return `${listSuffix}<h2 class="markdown-h2">${content}</h2>`;
    }

    // Paragraphs or empty lines
    const listSuffix = inList ? '</ul>' : '';
    inList = false;
    
    if (trimmed === '') {
      return listSuffix;
    }
    
    return `${listSuffix}<p class="markdown-p">${trimmed}</p>`;
  });

  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('\n');
};

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    videoId = match[2];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

export default function ViewResource({ resourceId, currentUser, onBack }) {
  const { t, lang } = useLanguage();
  const [resource, setResource] = useState(null);
  const [mindmapData, setMindmapData] = useState(null);
  const [activeTab, setActiveTab] = useState('mindmap'); // 'mindmap', 'flashcards', 'summary', 'chatbot'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSourceCollapsed, setIsSourceCollapsed] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Chatbot states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Comments states
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Podcast states
  const [podcastDialogue, setPodcastDialogue] = useState([]);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastError, setPodcastError] = useState('');
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [currentSpeechIdx, setCurrentSpeechIdx] = useState(-1);

  // Personal study notes states
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Fetch resource metadata and mindmap
  const fetchResourceDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 1. Récupérer les métadonnées de la ressource
      const resResource = await fetch(`http://localhost:5000/api/resources/${resourceId}?lang=${lang}`);
      if (!resResource.ok) {
        throw new Error(lang === 'fr' ? "Impossible de charger la ressource." : lang === 'ar' ? "تعذر تحميل المورد." : "Unable to load the resource.");
      }
      const dataResource = await resResource.json();
      setResource(dataResource);

      // 2. Récupérer les données de la carte mentale
      const resMindMap = await fetch(`http://localhost:5000/api/resources/${resourceId}/mindmap?lang=${lang}`);
      if (resMindMap.ok) {
        const dataMindmap = await resMindMap.json();
        setMindmapData(dataMindmap);
      } else {
        console.warn("Carte mentale non encore disponible.");
      }

    } catch (err) {
      setError(err.message || (lang === 'fr' ? "Une erreur est survenue lors du chargement." : lang === 'ar' ? "حدث خطأ أثناء التحميل." : "An error occurred during loading."));
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments
  const fetchComments = async () => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des commentaires:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Fetch data on load and when resource ID or language changes
  useEffect(() => {
    fetchResourceDetails();
    fetchComments();
  }, [resourceId, lang]);

  // Handle chatbot greeting message
  useEffect(() => {
    let welcomeMsg = '';
    if (lang === 'fr') {
      welcomeMsg = "Bonjour ! Je suis votre assistant de révision. Posez-moi des questions sur ce cours, et je vous répondrai en me basant uniquement sur son contenu.";
    } else if (lang === 'ar') {
      welcomeMsg = "مرحباً! أنا مساعد المراجعة الخاص بك. اطرح عليّ أسئلة حول هذا المقرر وسأجيبك بناءً على محتواه فقط.";
    } else {
      welcomeMsg = "Hello! I am your revision assistant. Ask me questions about this course, and I will answer you based strictly on its content.";
    }
    setChatMessages([
      { sender: 'bot', text: welcomeMsg, timestamp: new Date() }
    ]);
    setChatHistory([]);
  }, [resourceId, lang]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'chatbot' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Post chat query to assistant
  const handleSendMessage = async (e, directText = null) => {
    if (e) e.preventDefault();
    const messageToSend = directText || chatInput;
    if (!messageToSend.trim() || isChatLoading) return;

    const userMsgText = messageToSend.trim();
    if (!directText) setChatInput('');
    
    // Add user message to UI
    const newUserMsg = { sender: 'user', text: userMsgText, timestamp: new Date() };
    setChatMessages(prev => [...prev, newUserMsg]);

    setIsChatLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/api/resources/${resourceId}/chat?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsgText,
          history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error(lang === 'fr' ? "Erreur serveur de l'assistant IA." : lang === 'ar' ? "خطأ في خادم مساعد الذكاء الاصطناعي." : "Server error from AI assistant.");
      }

      const data = await response.json();
      const botResponseText = data.response;

      setChatMessages(prev => [...prev, { sender: 'bot', text: botResponseText, timestamp: new Date() }]);
      
      setChatHistory(prev => [
        ...prev,
        { sender: 'user', text: userMsgText },
        { sender: 'bot', text: botResponseText }
      ]);

    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        sender: 'bot',
        text: lang === 'fr' ? "Désolé, impossible de joindre l'assistant pour le moment." : lang === 'ar' ? "عذراً، تعذر الاتصال بالمساعد حالياً." : "Sorry, unable to contact the assistant right now.",
        isError: true,
        timestamp: new Date()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Post new comment
  const handlePostComment = async (e) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;

    const textToPost = newCommentText.trim();
    setNewCommentText('');
    setCommentsError('');

    try {
      const response = await fetch(`http://localhost:5000/api/resources/${resourceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auteurId: currentUser.id,
          auteurNom: currentUser.nom,
          auteurRole: currentUser.role,
          contenu: textToPost
        })
      });

      if (!response.ok) {
        throw new Error(lang === 'fr' ? "Impossible de publier le commentaire." : lang === 'ar' ? "تعذر نشر التعليق." : "Could not post comment.");
      }

      const newComment = await response.json();
      setComments(prev => [...prev, newComment]);
    } catch (err) {
      console.error(err);
      setCommentsError(err.message || "Error posting comment");
      setNewCommentText(textToPost);
    }
  };

  // Fetch Quiz on tab select or language change
  useEffect(() => {
    if (activeTab === 'quiz') {
      fetchQuiz();
    }
  }, [activeTab, resourceId, lang]);

  // Fetch Podcast on tab select or language change
  useEffect(() => {
    if (activeTab === 'podcast') {
      fetchPodcast();
    }
  }, [activeTab, resourceId, lang]);

  // Speech cleanup on tab change or unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeTab, resourceId, lang]);

  // Render Mermaid diagrams on summary tab active or summary text loaded
  useEffect(() => {
    if (activeTab === 'summary' && resource?.resume) {
      import('mermaid').then((m) => {
        m.default.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        setTimeout(() => {
          m.default.run({
            querySelector: '.mermaid'
          }).catch(err => console.error("Mermaid parsing error: ", err));
        }, 100);
      }).catch(err => console.error("Failed to load mermaid: ", err));
    }
  }, [activeTab, resource?.resume]);

  // Handle PowerPoint generation download
  const handleDownloadPowerPoint = async () => {
    try {
      setPptLoading(true);
      const response = await fetch(`http://localhost:5000/api/resources/${resourceId}/powerpoint?lang=${lang}`);
      if (!response.ok) {
        throw new Error(lang === 'fr' ? "Erreur lors de la génération du PowerPoint." : lang === 'ar' ? "خطأ أثناء توليد ملف البوربوينت." : "Error generating PowerPoint presentation.");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presentation_${resource.titre.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download PowerPoint");
    } finally {
      setPptLoading(false);
    }
  };

  // Handle PDF Revision Booklet download
  const handleDownloadPDF = async () => {
    try {
      setPdfLoading(true);
      const studentId = currentUser ? currentUser.id : '';
      const response = await fetch(`http://localhost:5000/api/resources/${resourceId}/pdf?etudiantId=${studentId}&lang=${lang}`);
      if (!response.ok) {
        throw new Error(lang === 'fr' ? "Erreur lors de la génération du livret PDF." : lang === 'ar' ? "خطأ أثناء توليد كتيب المراجعة PDF." : "Error generating PDF booklet.");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Livret_${resource.titre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download PDF booklet");
    } finally {
      setPdfLoading(false);
    }
  };

  const fetchQuiz = async () => {
    try {
      setQuizLoading(true);
      setQuizError('');
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/quiz?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data);
      } else {
        throw new Error("Impossible de charger le quiz.");
      }
    } catch (err) {
      setQuizError(err.message);
    } finally {
      setQuizLoading(false);
    }
  };

  const fetchPodcast = async () => {
    try {
      setPodcastLoading(true);
      setPodcastError('');
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/podcast?lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setPodcastDialogue(data);
      } else {
        throw new Error("Impossible de charger le script du podcast.");
      }
    } catch (err) {
      setPodcastError(err.message);
    } finally {
      setPodcastLoading(false);
    }
  };

  const fetchNotes = async () => {
    if (!currentUser) return;
    try {
      setNotesLoading(true);
      setNotesError('');
      const res = await fetch(`http://localhost:5000/api/resources/${resourceId}/notes?etudiantId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      } else {
        throw new Error(lang === 'fr' ? "Impossible de charger vos notes." : lang === 'ar' ? "تعذر تحميل ملاحظاتك." : "Unable to load your notes.");
      }
    } catch (err) {
      setNotesError(err.message);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSaveNote = async (e) => {
    if (e) e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || !currentUser) return;

    try {
      setNotesLoading(true);
      setNotesError('');
      let res;
      if (currentNoteId) {
        // Edit mode
        res = await fetch(`http://localhost:5000/api/notes/${currentNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titre: noteTitle.trim(), contenu: noteContent.trim() })
        });
      } else {
        // Create mode
        res = await fetch(`http://localhost:5000/api/resources/${resourceId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            etudiantId: currentUser.id,
            titre: noteTitle.trim(),
            contenu: noteContent.trim()
          })
        });
      }

      if (res.ok) {
        setIsEditingNote(false);
        setCurrentNoteId(null);
        setNoteTitle('');
        setNoteContent('');
        fetchNotes();
      } else {
        throw new Error(lang === 'fr' ? "Impossible d'enregistrer la note." : lang === 'ar' ? "تعذر حفظ الملاحظة." : "Unable to save the note.");
      }
    } catch (err) {
      setNotesError(err.message);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm(lang === 'fr' ? "Voulez-vous vraiment supprimer cette note ?" : lang === 'ar' ? "هل تريد حقًا حذف هذه الملاحظة؟" : "Are you sure you want to delete this note?")) return;
    try {
      setNotesLoading(true);
      const res = await fetch(`http://localhost:5000/api/notes/${noteId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchNotes();
      } else {
        throw new Error(lang === 'fr' ? "Impossible de supprimer la note." : lang === 'ar' ? "تعذر حذف الملاحظة." : "Unable to delete note.");
      }
    } catch (err) {
      setNotesError(err.message);
      setNotesLoading(false);
    }
  };

  // Fetch notes on notes tab select
  useEffect(() => {
    if (activeTab === 'notes') {
      fetchNotes();
    }
  }, [activeTab, resourceId]);

  const utteranceRef = useRef(null);

  useEffect(() => {
    if (podcastPlaying && currentSpeechIdx >= 0 && currentSpeechIdx < podcastDialogue.length) {
      const line = podcastDialogue[currentSpeechIdx];
      
      const activeBubble = document.getElementById(`podcast-bubble-${currentSpeechIdx}`);
      if (activeBubble) {
        activeBubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(line.text);
      utteranceRef.current = utterance;
      
      if (lang === 'en') {
        utterance.lang = 'en-US';
      } else if (lang === 'ar') {
        utterance.lang = 'ar-SA';
      } else {
        utterance.lang = 'fr-FR';
      }
      
      if (line.speaker.toLowerCase() === 'sophie') {
        utterance.pitch = 1.25;
        utterance.rate = 0.95;
      } else {
        utterance.pitch = 0.85;
        utterance.rate = 1.05;
      }
      
      utterance.onend = () => {
        if (currentSpeechIdx < podcastDialogue.length - 1) {
          setCurrentSpeechIdx(prev => prev + 1);
        } else {
          setPodcastPlaying(false);
          setCurrentSpeechIdx(-1);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.warn("Speech synthesis error", e);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [podcastPlaying, currentSpeechIdx, podcastDialogue]);

  const togglePodcastPlay = () => {
    if (podcastPlaying) {
      window.speechSynthesis.pause();
      setPodcastPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPodcastPlaying(true);
      } else {
        setPodcastPlaying(true);
        if (currentSpeechIdx === -1) {
          setCurrentSpeechIdx(0);
        }
      }
    }
  };

  const stopPodcast = () => {
    window.speechSynthesis.cancel();
    setPodcastPlaying(false);
    setCurrentSpeechIdx(-1);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '450px', gap: '1.5rem' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid rgba(139, 92, 246, 0.1)', 
          borderTopColor: 'var(--primary)', 
          borderRadius: '50%', 
          animation: 'pulse 1s infinite' 
        }}></div>
        <p style={{ animation: 'pulse 1.5s infinite', fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
          {t('mindmap_loading')}
        </p>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="glass-panel" style={{ maxWidth: '600px', margin: '4rem auto', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: 'var(--accent-red)', marginBottom: '1rem', fontSize: '1.3rem', fontWeight: '800' }}>{t('mindmap_error')}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.8rem', fontSize: '0.9rem' }}>{error || (lang === 'fr' ? "Ressource introuvable." : lang === 'ar' ? "المورد غير موجود." : "Resource not found.")}</p>
        <button className="btn btn-secondary" onClick={onBack}>{lang === 'fr' ? "Retour au tableau de bord" : lang === 'ar' ? "العودة إلى لوحة التحكم" : "Back to dashboard"}</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '0 1rem 4rem 1rem' }} className="animate-fade-in">
      
      {/* En-tête de la ressource */}
      <div className="glass-panel" style={{ 
        padding: '1.5rem 2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.2rem',
        marginBottom: '2rem',
        background: 'var(--bg-overlay-glass)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onBack} 
            style={{ 
              padding: '0.45rem 0.9rem', 
              fontSize: '0.8rem', 
              borderRadius: '10px',
              background: 'var(--bg-overlay-light)'
            }}
          >
            {t('back_btn')}
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>{resource.type === 'pdf' ? '📄' : '🎥'}</span>
              <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: '800' }}>{resource.titre}</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>
              {lang === 'fr' ? (
                <>Cours proposé par <strong style={{ color: 'var(--secondary)' }}>{resource.enseignantNom}</strong> • Pédagogie active IA</>
              ) : lang === 'ar' ? (
                <>مقرر دراسي مقدم من <strong style={{ color: 'var(--secondary)' }}>{resource.enseignantNom}</strong> • بيداغوجيا نشطة بالذكاء الاصطناعي</>
              ) : (
                <>Course proposed by <strong style={{ color: 'var(--secondary)' }}>{resource.enseignantNom}</strong> • AI active learning</>
              )}
            </p>
          </div>
        </div>

        {/* Boutons d'onglets & Options de vue */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-overlay-dark)', padding: '0.3rem', borderRadius: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'mindmap', label: t('mindmap_tab') },
              { id: 'flashcards', label: t('flashcards_tab') },
              { id: 'summary', label: t('summary_tab') },
              { id: 'chatbot', label: t('chatbot_tab') },
              { id: 'quiz', label: lang === 'fr' ? 'Quiz interactif' : lang === 'ar' ? 'اختبار تفاعلي' : 'Interactive Quiz' },
              { id: 'podcast', label: lang === 'fr' ? 'Studio Podcast' : lang === 'ar' ? 'استوديو البودكاست' : 'Podcast Studio' },
              { id: 'notes', label: t('notes_tab') }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.55rem 1.2rem',
                  fontSize: '0.82rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  transition: 'all 0.3s ease',
                  boxShadow: activeTab === tab.id ? '0 4px 10px rgba(139, 92, 246, 0.2)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsSourceCollapsed(prev => !prev)}
            className="btn btn-secondary"
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.82rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 'bold',
              border: '1px solid var(--border-glass)',
              background: isSourceCollapsed ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              borderColor: isSourceCollapsed ? 'var(--secondary)' : 'var(--border-glass)',
              color: isSourceCollapsed ? 'var(--secondary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <span>{isSourceCollapsed ? '👁️' : '🖥️'}</span>
            <span>
              {isSourceCollapsed 
                ? (lang === 'fr' ? 'Afficher la source' : lang === 'ar' ? 'عرض المصدر' : 'Show Source') 
                : (lang === 'fr' ? 'Plein écran' : lang === 'ar' ? 'ملء الشاشة' : 'Full Screen')}
            </span>
          </button>
        </div>
      </div>

      {/* NotebookLM Split Workspace Container */}
      <div 
        className="notebooklm-workspace"
        style={{
          gridTemplateColumns: isSourceCollapsed ? '1fr' : undefined,
          gap: isSourceCollapsed ? '0px' : undefined
        }}
      >
        {/* Left Side: Source Document Viewer */}
        <div 
          className="notebooklm-source-pane"
          style={{
            display: isSourceCollapsed ? 'none' : 'flex'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span>{resource.type === 'pdf' ? '📄' : '🎥'}</span>
              {resource.type === 'pdf' ? (lang === 'fr' ? 'Source PDF originale' : lang === 'ar' ? 'مصدر PDF الأصلي' : 'Original PDF Source') : (lang === 'fr' ? 'Vidéo du cours' : lang === 'ar' ? 'فيديو المقرر' : 'Course Video')}
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {resource.type === 'pdf' ? 'PDF Viewer' : 'Video Player'}
            </span>
          </div>

          <div style={{ flex: 1, height: '100%', overflow: 'hidden', borderRadius: '12px' }}>
            {resource.type === 'pdf' ? (
              <iframe
                src={`http://localhost:5000/uploads/${resource.cheminFichier.split(/[\\/]/).pop()}`}
                title={resource.titre}
                width="100%"
                height="100%"
                style={{
                  border: 'none',
                  background: 'var(--bg-overlay-dark)',
                  borderRadius: '12px'
                }}
              />
            ) : (
              // Video handler
              (() => {
                const youtubeEmbedUrl = getYouTubeEmbedUrl(resource.cheminFichier);
                if (youtubeEmbedUrl) {
                  return (
                    <iframe
                      src={youtubeEmbedUrl}
                      title={resource.titre}
                      width="100%"
                      height="100%"
                      style={{ border: 'none', borderRadius: '12px' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                } else if (resource.cheminFichier && (resource.cheminFichier.endsWith('.mp4') || resource.cheminFichier.endsWith('.webm'))) {
                  return (
                    <video
                      src={resource.cheminFichier}
                      controls
                      width="100%"
                      style={{ height: '100%', objectFit: 'contain', background: 'black', borderRadius: '12px' }}
                    />
                  );
                } else {
                  return (
                    <div className="glass-panel" style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '1.2rem',
                      padding: '2rem',
                      textAlign: 'center',
                      background: 'var(--bg-overlay-medium)',
                      border: 'none'
                    }}>
                      <span style={{ fontSize: '3rem' }}>🎥</span>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{resource.titre}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '300px' }}>
                        {lang === 'fr' 
                          ? "Cette vidéo est sur une plateforme externe et ne peut pas être intégrée directement." 
                          : lang === 'ar' 
                          ? "هذا الفيديو مستضاف على منصة خارجية ولا يمكن دمجه مباشرة." 
                          : "This video is on an external platform and cannot be embedded directly."}
                      </p>
                      <a
                        href={resource.cheminFichier}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        {lang === 'fr' ? "Lancer la vidéo de cours ↗" : lang === 'ar' ? "تشغيل فيديو المقرر ↗" : "Launch Course Video ↗"}
                      </a>
                    </div>
                  );
                }
              })()
            )}
          </div>
        </div>

        {/* Right Side: AI Tools */}
        <div className="notebooklm-ai-pane">
          {activeTab === 'mindmap' && (
            mindmapData ? (
              <MindMapViewer mindmapData={mindmapData} title={resource.titre} />
            ) : (
              <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.8rem' }}>⏳</span>
                <p style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{t('mindmap_empty')}</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                  {lang === 'fr' ? "Le traitement de fond de ce document par notre IA est peut-être en cours. Veuillez patienter..." : lang === 'ar' ? "قد يكون معالجة هذا المستند في الخلفية بواسطة الذkاء الاصطناعي قيد التشغيل حالياً. يرجى الانتظار..." : "Background processing of this document by our AI may be in progress. Please wait..."}
                </p>
              </div>
            )
          )}

          {activeTab === 'flashcards' && (
            <FlashcardDeck resourceId={resource.id} currentUser={currentUser} />
          )}

          {activeTab === 'summary' && (
            <div className="glass-panel summary-container animate-fade-in" style={{ padding: '2rem', minHeight: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>📄</span>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>
                    {lang === 'fr' ? `Synthèse du cours : ${resource.titre}` : lang === 'ar' ? `ملخص المقرر: ${resource.titre}` : `Summary of course: ${resource.titre}`}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {resource.resume && (
                    <button
                      onClick={handleDownloadPowerPoint}
                      disabled={pptLoading}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.0rem',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        cursor: pptLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      {pptLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '0.3rem' }}></span>
                          {lang === 'fr' ? "Génération..." : lang === 'ar' ? "جاري التوليد..." : "Generating..."}
                        </>
                      ) : (
                        <>
                          <span>📊</span>
                          {lang === 'fr' ? "Présentation PPTX" : lang === 'ar' ? "عرض PowerPoint" : "PowerPoint Deck"}
                        </>
                      )}
                    </button>
                  )}
                  {resource.resume && (
                    <button
                      onClick={handleDownloadPDF}
                      disabled={pdfLoading}
                      className="btn btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1.0rem',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                        color: 'white',
                        border: 'none',
                        cursor: pdfLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      {pdfLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '0.3rem' }}></span>
                          {lang === 'fr' ? "Génération..." : lang === 'ar' ? "جاري التوليد..." : "Generating..."}
                        </>
                      ) : (
                        <>
                          <span>📕</span>
                          {lang === 'fr' ? "Exporter Livret PDF" : lang === 'ar' ? "تصدير كتيب PDF" : "Export PDF Booklet"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {resource.resume ? (
                <div 
                  className="markdown-body" 
                  dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(resource.resume) }} 
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.8rem' }}>⏳</span>
                  <p style={{ fontWeight: '600' }}>
                    {lang === 'fr' ? "Le résumé de ce cours est en cours de génération..." : lang === 'ar' ? "جاري توليد ملخص هذا مقرر..." : "The summary for this course is being generated..."}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chatbot' && (
            <div className="glass-panel chatbot-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '550px' }}>
              {/* Header */}
              <div style={{ 
                padding: '1rem 1.5rem', 
                borderBottom: '1px solid var(--border-glass)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'var(--bg-overlay-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="chat-avatar-ai" style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: 'white'
                  }}>
                    AI
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '700' }}>{t('chatbot_tab')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NotebookLM Context Model</span>
                  </div>
                </div>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setChatHistory([]);
                    let welcomeMsg = '';
                    if (lang === 'fr') {
                      welcomeMsg = "Bonjour ! Je suis votre assistant de révision. Posez-moi des questions sur ce cours, et je vous répondrai en me basant uniquement sur son contenu.";
                    } else if (lang === 'ar') {
                      welcomeMsg = "مرحباً! أنا مساعد المراجعة الخاص بك. اطرح عليّ أسئلة حول هذا المقرر وسأجيبك بناءً على محتواه فقط.";
                    } else {
                      welcomeMsg = "Hello! I am your revision assistant. Ask me questions about this course, and I will answer you based strictly on its content.";
                    }
                    setChatMessages([{ sender: 'bot', text: welcomeMsg, timestamp: new Date() }]);
                  }}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
                >
                  {lang === 'fr' ? "Réinitialiser" : lang === 'ar' ? "إعادة ضبط" : "Reset"}
                </button>
              </div>

              {/* Messages body */}
              <div className="chat-messages" style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem' 
              }}>
                {chatMessages.map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div 
                      key={index} 
                      className={`chat-bubble-wrapper ${isUser ? 'user' : 'bot'}`}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        alignItems: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: '600', color: isUser ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {isUser ? currentUser.nom : 'AI Assistant'}
                        </span>
                        <span>•</span>
                        <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      
                      <div 
                        className={`chat-bubble ${isUser ? 'user' : 'bot'} ${msg.isError ? 'error' : ''}`}
                        style={{
                          padding: '0.8rem 1.1rem',
                          borderRadius: '16px',
                          fontSize: '0.88rem',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: isUser ? 'var(--primary)' : 'var(--bg-dark-accent)',
                          color: isUser ? 'white' : 'var(--text-primary)',
                          border: isUser ? 'none' : '1px solid var(--border-glass)',
                          borderEndEndRadius: isUser ? '4px' : '16px',
                          borderEndStartRadius: isUser ? '16px' : '4px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                
                {isChatLoading && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AI Assistant • ...</div>
                    <div className="chat-bubble bot" style={{
                      padding: '0.8rem 1.2rem',
                      borderRadius: '16px',
                      borderEndStartRadius: '4px',
                      background: 'var(--bg-dark-accent)',
                      border: '1px solid var(--border-glass)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <span className="dot-pulse-1" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'bounce-dot 1s infinite 0.1s' }}></span>
                      <span className="dot-pulse-2" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'bounce-dot 1s infinite 0.2s' }}></span>
                      <span className="dot-pulse-3" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', animation: 'bounce-dot 1s infinite 0.3s' }}></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Prompt Chips */}
              <div style={{ 
                padding: '0.5rem 1.5rem 0.75rem 1.5rem', 
                display: 'flex', 
                gap: '0.5rem', 
                flexWrap: 'wrap',
                background: 'var(--bg-overlay-light)',
                borderTop: '1px solid var(--border-glass)'
              }}>
                {[
                  { 
                    text: lang === 'fr' ? "Concepts clés" : lang === 'ar' ? "المفاهيم الأساسية" : "Key concepts",
                    query: lang === 'fr' ? "Quels sont les concepts clés de ce cours ?" : lang === 'ar' ? "ما هي المفاهيم الأساسية لهذا المقرر؟" : "What are the key concepts of this course?"
                  },
                  { 
                    text: lang === 'fr' ? "Explique avec analogie" : lang === 'ar' ? "اشرح لي بتشابه مبسط" : "Explain with analogy",
                    query: lang === 'fr' ? "Explique-moi les notions clés de ce cours sous forme d'une analogie simple." : lang === 'ar' ? "اشرح لي المفاهيم الأساسية لهذا المقرر بتشابه مبسط." : "Explain the key concepts of this course using a simple analogy."
                  },
                  { 
                    text: lang === 'fr' ? "Exemple concret" : lang === 'ar' ? "مثال عملي" : "Concrete example",
                    query: lang === 'fr' ? "Donne-moi un exemple concret d'application pratique de ces notions." : lang === 'ar' ? "أعطني مثالاً عملياً لتطبيق هذه المفاهيم." : "Give me a concrete example of practical application of these concepts."
                  }
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(null, chip.query)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-secondary)',
                      borderRadius: '30px',
                      padding: '0.4rem 0.9rem',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: '600'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.background = 'rgba(139,92,246,0.06)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-glass)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    disabled={isChatLoading}
                  >
                    💡 {chip.text}
                  </button>
                ))}
              </div>

              {/* Input form */}
              <form onSubmit={handleSendMessage} style={{ 
                padding: '1rem 1.5rem', 
                borderTop: '1px solid var(--border-glass)', 
                display: 'flex', 
                gap: '0.75rem',
                background: 'var(--bg-overlay-medium)'
              }}>
                <input 
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={lang === 'fr' ? "Posez une question sur le cours..." : lang === 'ar' ? "اطرح سؤالاً حول هذا المقرر..." : "Ask a question about the course..."}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    borderRadius: '10px',
                    padding: '0.7rem 1rem',
                    fontSize: '0.88rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  disabled={isChatLoading}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!chatInput.trim() || isChatLoading}
                  style={{
                    padding: '0 1.25rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'fr' ? "Envoyer" : lang === 'ar' ? "إرسال" : "Send"}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', minHeight: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <span style={{ fontSize: '1.6rem' }}>📝</span>
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>
                  {lang === 'fr' ? `Quiz interactif : ${resource.titre}` : lang === 'ar' ? `اختبار تفاعلي: ${resource.titre}` : `Interactive Quiz: ${resource.titre}`}
                </h3>
              </div>

              {quizLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid rgba(139,92,246,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s infinite linear' }}></span>
                  <p style={{ marginTop: '1rem', fontWeight: '600' }}>{lang === 'fr' ? "Génération du quiz par l'IA..." : lang === 'ar' ? "جاري توليد الاختبار بالذكاء الاصطناعي..." : "Generating quiz with AI..."}</p>
                </div>
              ) : quizError ? (
                <div style={{ textAlign: 'center', color: 'var(--accent-red)', padding: '2rem 0' }}>
                  <p>⚠️ {quizError}</p>
                  <button className="btn btn-secondary" onClick={fetchQuiz} style={{ marginTop: '1rem' }}>Réessayer</button>
                </div>
              ) : quizFinished ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ fontSize: '4rem' }}>{quizScore >= 3 ? '🎉' : '📚'}</div>
                  <div>
                    <h4 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                      {lang === 'fr' ? "Quiz Terminé !" : lang === 'ar' ? "تم الانتهاء من الاختبار!" : "Quiz Completed!"}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      {lang === 'fr' ? `Votre score est de : ` : lang === 'ar' ? `درجتك هي: ` : `Your score is: `}
                      <strong style={{ color: quizScore >= 3 ? 'var(--accent-green)' : 'var(--accent-orange)', fontSize: '1.6rem' }}>{quizScore}</strong> / 5
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setCurrentQuestionIdx(0);
                      setSelectedOption(null);
                      setIsAnswerChecked(false);
                      setQuizScore(0);
                      setQuizFinished(false);
                    }}
                    style={{ padding: '0.7rem 2rem', fontWeight: 'bold' }}
                  >
                    {lang === 'fr' ? "Recommencer le Quiz" : lang === 'ar' ? "إعادة بدء الاختبار" : "Restart Quiz"}
                  </button>
                </div>
              ) : quizQuestions.length > 0 ? (
                (() => {
                  const q = quizQuestions[currentQuestionIdx];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>Question {currentQuestionIdx + 1} sur 5</span>
                        <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${(currentQuestionIdx + 1) * 20}%`, height: '100%', background: 'var(--primary)' }} />
                        </div>
                      </div>

                      <h4 style={{ fontSize: '1.05rem', fontWeight: '700', lineHeight: '1.4', color: 'var(--text-primary)' }}>
                        {q.question}
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {q.options.map((opt, oIdx) => {
                          let optClass = 'quiz-option-btn';
                          if (selectedOption === oIdx) optClass += ' selected';
                          if (isAnswerChecked) {
                            if (oIdx === q.correctOptionIndex) optClass += ' correct';
                            else if (selectedOption === oIdx) optClass += ' incorrect';
                          }
                          return (
                            <button
                              key={oIdx}
                              className={optClass}
                              onClick={() => {
                                if (!isAnswerChecked) setSelectedOption(oIdx);
                              }}
                              disabled={isAnswerChecked}
                            >
                              <span style={{ 
                                display: 'inline-flex', 
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '50%', 
                                background: selectedOption === oIdx ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                                color: selectedOption === oIdx ? 'white' : 'var(--text-secondary)',
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '0.78rem',
                                fontWeight: 'bold' 
                              }}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {isAnswerChecked && (
                        <div className="glass-panel animate-fade-in" style={{ 
                          padding: '1.2rem', 
                          background: selectedOption === q.correctOptionIndex ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                          border: `1px solid ${selectedOption === q.correctOptionIndex ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '800', 
                            color: selectedOption === q.correctOptionIndex ? 'var(--accent-green)' : 'var(--accent-red)',
                            textTransform: 'uppercase'
                          }}>
                            {selectedOption === q.correctOptionIndex ? 'Correct !' : 'Incorrect'}
                          </span>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                            {q.explanation}
                          </p>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        {!isAnswerChecked ? (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setIsAnswerChecked(true);
                              if (selectedOption === q.correctOptionIndex) {
                                setQuizScore(s => s + 1);
                              }
                            }}
                            disabled={selectedOption === null}
                            style={{ padding: '0.6rem 2rem', fontWeight: 'bold' }}
                          >
                            {lang === 'fr' ? "Valider" : lang === 'ar' ? "تأكيد" : "Verify"}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedOption(null);
                              setIsAnswerChecked(false);
                              if (currentQuestionIdx < 4) {
                                setCurrentQuestionIdx(idx => idx + 1);
                              } else {
                                setQuizFinished(true);
                              }
                            }}
                            style={{ padding: '0.6rem 2rem', fontWeight: 'bold' }}
                          >
                            {currentQuestionIdx < 4 
                              ? (lang === 'fr' ? "Question suivante" : lang === 'ar' ? "السؤال التالي" : "Next Question")
                              : (lang === 'fr' ? "Terminer" : lang === 'ar' ? "إنهاء" : "Finish")
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                  <p>{lang === 'fr' ? "Aucun quiz disponible." : "No quiz available."}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'podcast' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <span style={{ fontSize: '1.6rem' }}>🎙️</span>
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>
                  {lang === 'fr' ? 'Studio Podcast IA' : lang === 'ar' ? 'استوديو البودكاست بالذكاء الاصطناعي' : 'AI Podcast Studio'}
                </h3>
              </div>

              {podcastLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid rgba(139,92,246,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s infinite linear' }}></span>
                  <p style={{ marginTop: '1rem', fontWeight: '600' }}>{lang === 'fr' ? "Génération du script audio par l'IA..." : lang === 'ar' ? "جاري كتابة الحوار الصوتي بالذكاء الاصطnaعي..." : "Generating audio script with AI..."}</p>
                </div>
              ) : podcastError ? (
                <div style={{ textAlign: 'center', color: 'var(--accent-red)', padding: '2rem 0' }}>
                  <p>⚠️ {podcastError}</p>
                  <button className="btn btn-secondary" onClick={fetchPodcast} style={{ marginTop: '1rem' }}>Réessayer</button>
                </div>
              ) : podcastDialogue.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '1.5rem',
                    background: 'var(--bg-overlay-medium)', 
                    padding: '1rem 1.5rem', 
                    borderRadius: '16px',
                    border: '1px solid var(--border-glass)',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <div className="podcast-host-card">
                        <div className={`podcast-host-avatar ${podcastPlaying && currentSpeechIdx >= 0 && podcastDialogue[currentSpeechIdx].speaker.toLowerCase() === 'sophie' ? 'active' : ''}`}>
                          👩‍🏫
                        </div>
                        <span className="podcast-host-name">Sophie (Expert)</span>
                      </div>

                      <div className="podcast-waveform">
                        {[...Array(10)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`podcast-wave-bar ${podcastPlaying ? 'active' : ''}`}
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>

                      <div className="podcast-host-card">
                        <div className={`podcast-host-avatar ${podcastPlaying && currentSpeechIdx >= 0 && podcastDialogue[currentSpeechIdx].speaker.toLowerCase() === 'marc' ? 'active' : ''}`}>
                          👨‍🎓
                        </div>
                        <span className="podcast-host-name">Marc (Étudiant)</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button 
                        className="btn btn-primary"
                        onClick={togglePodcastPlay}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.4rem', fontWeight: 'bold' }}
                      >
                        {podcastPlaying ? (
                          <><span style={{ fontSize: '1rem' }}>⏸</span> {lang === 'fr' ? 'Pause' : 'Pause'}</>
                        ) : (
                          <><span style={{ fontSize: '1rem' }}>▶</span> {lang === 'fr' ? 'Lancer la lecture' : 'Play Podcast'}</>
                        )}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={stopPodcast}
                        disabled={currentSpeechIdx === -1}
                        style={{ padding: '0.65rem 1rem' }}
                      >
                        ⏹ {lang === 'fr' ? 'Arrêter' : 'Stop'}
                      </button>
                    </div>
                  </div>

                  <div style={{ 
                    maxHeight: '320px', 
                    overflowY: 'auto', 
                    padding: '0.5rem',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    background: 'var(--bg-overlay-dark)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {podcastDialogue.map((line, idx) => {
                      const isActive = currentSpeechIdx === idx;
                      const isSophie = line.speaker.toLowerCase() === 'sophie';
                      
                      return (
                        <div 
                          key={idx}
                          id={`podcast-bubble-${idx}`}
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start',
                            padding: '0.8rem 1rem',
                            borderRadius: '12px',
                            background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                            border: `1px solid ${isActive ? 'rgba(139,92,246,0.25)' : 'transparent'}`,
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{isSophie ? '👩‍🏫' : '👨‍🎓'}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <strong style={{ fontSize: '0.8rem', color: isSophie ? 'var(--primary)' : 'var(--secondary)' }}>
                              {line.speaker}
                            </strong>
                            <p style={{ 
                              fontSize: '0.86rem', 
                              margin: 0, 
                              lineHeight: '1.45', 
                              color: isActive ? 'white' : 'var(--text-secondary)',
                              fontWeight: isActive ? '600' : 'normal'
                            }}>
                              {line.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
                  <p>{lang === 'fr' ? "Aucun podcast disponible." : "No podcast available."}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', minHeight: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>📝</span>
                  <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '800' }}>
                    {t('notes_title')}
                  </h3>
                </div>
                {!isEditingNote && (
                  <button 
                    onClick={() => {
                      setIsEditingNote(true);
                      setCurrentNoteId(null);
                      setNoteTitle('');
                      setNoteContent('');
                    }}
                    className="btn btn-primary"
                    style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}
                  >
                    {t('add_note_btn')}
                  </button>
                )}
              </div>

              {notesError && (
                <div style={{ color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.8rem 1.2rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.86rem' }}>
                  ⚠️ {notesError}
                </div>
              )}

              {notesLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid rgba(139,92,246,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s infinite linear' }}></span>
                </div>
              ) : isEditingNote ? (
                /* Note Creation / Editing Form */
                <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {lang === 'fr' ? 'Titre de la note' : lang === 'ar' ? 'عنوان الملاحظة' : 'Note Title'}
                    </label>
                    <input 
                      type="text" 
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                      placeholder={t('note_title_placeholder')}
                      required
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.9rem',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        outline: 'none',
                        fontWeight: '700'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {lang === 'fr' ? 'Contenu de la note' : lang === 'ar' ? 'محتوى الملاحظة' : 'Note Content'}
                    </label>
                    <textarea 
                      rows="8"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      placeholder={t('note_content_placeholder')}
                      required
                      style={{
                        padding: '1rem',
                        fontSize: '0.88rem',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        outline: 'none',
                        lineHeight: '1.5',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setIsEditingNote(false)}
                      className="btn btn-secondary"
                      style={{ padding: '0.6rem 1.4rem' }}
                    >
                      {t('cancel_btn')}
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      style={{ padding: '0.6rem 1.8rem', fontWeight: 'bold' }}
                    >
                      {t('save_note_btn')}
                    </button>
                  </div>
                </form>
              ) : notes.length > 0 ? (
                /* Notes list container */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {notes.map((note) => (
                    <div 
                      key={note.id}
                      className="comment-card" // reuse comments styles
                      style={{
                        padding: '1.25rem',
                        borderRadius: '14px',
                        border: '1px solid var(--border-glass)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {note.titre}
                        </h4>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '0.84rem', 
                          color: 'var(--text-secondary)', 
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}>
                          {note.contenu}
                        </p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(note.dateCreation).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            onClick={() => {
                              setIsEditingNote(true);
                              setCurrentNoteId(note.id);
                              setNoteTitle(note.titre);
                              setNoteContent(note.contenu);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem' }}
                          >
                            {t('edit_note_btn')}
                          </button>
                          <button 
                            onClick={() => handleDeleteNote(note.id)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.3rem 0.6rem', 
                              fontSize: '0.74rem', 
                              color: 'var(--accent-red)',
                              borderColor: 'rgba(239, 68, 68, 0.2)' 
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {t('delete_note_btn')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.8rem' }}>📝</span>
                  <p style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{t('notes_empty')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section Commentaires / Espace de Discussion Publique */}
      <div className="glass-panel comments-section animate-fade-in" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>💬</span>
          {t('comments_title')}
          <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)', background: 'var(--bg-overlay-medium)', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
            {comments.length}
          </span>
        </h3>

        {/* Formulaire pour ajouter un commentaire */}
        {currentUser && (
          <form onSubmit={handlePostComment} style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {/* User Avatar */}
              <div className="comment-user-avatar" style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: currentUser.role === 'admin' ? 'var(--accent-red)' : currentUser.role === 'enseignant' ? 'var(--primary)' : 'var(--secondary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                flexShrink: 0
              }}>
                {currentUser.nom ? currentUser.nom.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea
                  rows="3"
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  placeholder={lang === 'fr' ? "Ajouter une question ou remarque sur ce cours..." : lang === 'ar' ? "أضف سؤالاً أو ملاحظة حول هذا المقرر..." : "Add a question or remark about this course..."}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    borderRadius: '12px',
                    padding: '0.8rem 1rem',
                    fontSize: '0.88rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    transition: 'border-color 0.2s ease'
                  }}
                />
                {commentsError && (
                  <span style={{ color: 'var(--accent-red)', fontSize: '0.78rem' }}>{commentsError}</span>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!newCommentText.trim()}
                    style={{
                      padding: '0.5rem 1.5rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'fr' ? "Poster le commentaire" : lang === 'ar' ? "نشر التعليق" : "Post Comment"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Liste des commentaires */}
        {commentsLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            ⏳ {lang === 'fr' ? "Chargement des commentaires..." : lang === 'ar' ? "جاري تحميل التعليقات..." : "Loading comments..."}
          </div>
        ) : comments.length === 0 ? (
          <div style={{ 
            padding: '2.5rem', 
            textAlign: 'center', 
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-glass)',
            borderRadius: '12px',
            background: 'var(--bg-overlay-medium)'
          }}>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '500' }}>
              {t('comments_empty')}
            </p>
          </div>
        ) : (
          <div className="comments-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {comments.map((comment) => {
              // Determine role badge style
              let badgeColor = 'var(--secondary)';
              let badgeBg = 'rgba(20, 184, 166, 0.1)';
              let roleLabel = t('student');
              
              if (comment.auteurRole === 'admin') {
                badgeColor = 'var(--accent-red)';
                badgeBg = 'rgba(239, 68, 68, 0.1)';
                roleLabel = t('admin');
              } else if (comment.auteurRole === 'enseignant') {
                badgeColor = 'var(--primary)';
                badgeBg = 'rgba(139, 92, 246, 0.1)';
                roleLabel = t('teacher');
              }

              return (
                <div 
                  key={comment.id} 
                  className="comment-card" 
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1.2rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-overlay-light)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: comment.auteurRole === 'admin' ? 'var(--accent-red)' : comment.auteurRole === 'enseignant' ? 'var(--primary)' : 'var(--secondary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}>
                    {comment.auteurNom ? comment.auteurNom.substring(0, 2).toUpperCase() : '??'}
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{comment.auteurNom}</span>
                      
                      {/* Badge rôle */}
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: '800', 
                        color: badgeColor, 
                        background: badgeBg, 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {roleLabel}
                      </span>

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(comment.dateCreation).toLocaleDateString()} {new Date(comment.dateCreation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.85rem', 
                      lineHeight: '1.5', 
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {comment.contenu}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

