import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import db, { hashPassword } from './db.js';
import { extractTextFromPDF } from './pdf-extractor.js';
import { generateLearningMaterials, answerQuestionAboutDocument, generatePodcastScript, translateContent, generatePowerPointSlides } from './gemini.js';
import pptxgen from 'pptxgenjs';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS et JSON middleware
app.use(cors());
app.use(express.json());

// Assurer l'existence du dossier de téléversement
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Fonction utilitaire pour calculer le hash MD5 d'un fichier
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// --- ROUTES D'AUTHENTIFICATION & UTILISATEURS ---

// Lister les utilisateurs (sans mot de passe pour la sécurité)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.find('utilisateurs');
    const sanitized = users.map(({ motDePasse, ...u }) => u);
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connexion (Login) sécurisée
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }
    const user = await db.findOne('utilisateurs', u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    const hashed = hashPassword(password);
    if (user.motDePasse !== hashed) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    // Ne pas exposer le mot de passe dans la réponse
    const { motDePasse, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un utilisateur (inscription sécurisée avec mot de passe)
app.post('/api/users', async (req, res) => {
  try {
    const { nom, email, role, motDePasse, specialite, niveauEtude } = req.body;
    if (!nom || !email || !role || !motDePasse) {
      return res.status(400).json({ error: "Nom, email, rôle et mot de passe requis." });
    }
    if (role === 'admin') {
      return res.status(403).json({ error: "La création de comptes administrateurs est interdite." });
    }
    const existing = await db.findOne('utilisateurs', u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: "Cet email est déjà enregistré." });
    }
    
    const hashedPass = hashPassword(motDePasse);
    const newUser = await db.insert('utilisateurs', { 
      nom, 
      email, 
      role, 
      motDePasse: hashedPass, 
      specialite, 
      niveauEtude 
    });
    
    const { motDePasse: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- ROUTES DES RESSOURCES D'APPRENTISSAGE ---

// Lister les ressources
app.get('/api/resources', async (req, res) => {
  try {
    const { role } = req.query; // 'enseignant' ou 'etudiant'
    let resources = await db.find('ressources');
    
    // Si c'est un étudiant, il ne voit que les ressources validées par l'enseignant
    if (role === 'etudiant') {
      resources = resources.filter(r => r.estValide === true);
    }
    
    // Enrichir avec les informations de l'auteur de manière performante
    const users = await db.find('utilisateurs');
    const enriched = resources.map(resObj => {
      const creator = users.find(u => u.id === resObj.creePar);
      return {
        ...resObj,
        enseignantNom: creator ? creator.nom : 'Enseignant Inconnu'
      };
    });
    
    res.json(enriched.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper pour obtenir ou générer une traduction avec mise en cache MySQL
async function getOrTranslateAsset(resourceId, assetType, originalData, targetLang) {
  if (!targetLang || targetLang === 'fr') {
    return originalData;
  }
  
  try {
    // 1. Chercher dans la table translations
    const cached = await db.findOne('translations', t => 
      t.ressourceId === resourceId && 
      t.lang === targetLang && 
      t.assetType === assetType
    );
    
    if (cached) {
      return JSON.parse(cached.translatedJSON);
    }
    
    // 2. Traduire en utilisant l'IA
    const translated = await translateContent(assetType, originalData, targetLang);
    
    // 3. Enregistrer dans la base de données
    await db.insert('translations', {
      ressourceId: resourceId,
      lang: targetLang,
      assetType: assetType,
      translatedJSON: JSON.stringify(translated)
    });
    
    return translated;
  } catch (error) {
    console.error(`Erreur de cache de traduction pour ${assetType} (${targetLang}):`, error);
    return originalData; // Fallback to original content
  }
}

// Obtenir une ressource par ID
app.get('/api/resources/:id', async (req, res) => {
  try {
    const { lang } = req.query;
    const resource = await db.findOne('ressources', r => r.id === req.params.id);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });
    
    const creator = await db.findOne('utilisateurs', u => u.id === resource.creePar);
    
    let resume = resource.resume;
    if (resume && lang && lang !== 'fr') {
      resume = await getOrTranslateAsset(resource.id, 'summary', resume, lang);
    }
    
    res.json({ 
      ...resource, 
      resume, 
      enseignantNom: creator ? creator.nom : 'Enseignant Inconnu' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Téléverser une ressource et lancer le traitement IA (avec cache)
app.post('/api/resources/upload', upload.single('file'), async (req, res) => {
  try {
    const { titre, creePar, type, videoUrl } = req.body;
    if (!req.file && type !== 'video') {
      return res.status(400).json({ error: "Veuillez joindre un fichier." });
    }
    if (!titre || !creePar || !type) {
      return res.status(400).json({ error: "Champs titre, creePar et type obligatoires." });
    }

    let fileHash = '';
    let filePath = '';
    let fileName = '';

    if (req.file) {
      filePath = req.file.path;
      fileName = req.file.originalname;
      fileHash = await calculateFileHash(filePath);
    } else {
      // Pour une vidéo, on utilise l'URL transmise comme chemin
      filePath = videoUrl || '';
      fileHash = crypto.createHash('md5').update(titre + (videoUrl || '') + Date.now()).digest('hex');
    }

    // 1. VÉRIFICATION DU CACHE
    const cachedResource = await db.findOne('ressources', r => r.hashFichier === fileHash);
    if (cachedResource) {
      console.log(`[CACHE HIT] Copie des données pour le hash: ${fileHash}`);
      
      // On duplique la ressource pour cet enseignant
      const newResource = await db.insert('ressources', {
        titre,
        type,
        hashFichier: fileHash,
        cheminFichier: cachedResource.cheminFichier,
        creePar,
        estValide: false, // L'enseignant doit tout de même la valider
        contenuTexte: cachedResource.contenuTexte,
        resume: cachedResource.resume
      });

      // Dupliquer la carte mentale existante
      const cachedMindMap = await db.findOne('cartes_mentales', m => m.ressourceId === cachedResource.id);
      if (cachedMindMap) {
        await db.insert('cartes_mentales', {
          ressourceId: newResource.id,
          noeudsJSON: cachedMindMap.noeudsJSON,
          liensJSON: cachedMindMap.liensJSON
        });
      }

      // Dupliquer les flashcards
      const cachedFlashcards = await db.find('flashcards', f => f.ressourceId === cachedResource.id);
      for (const fc of cachedFlashcards) {
        await db.insert('flashcards', {
          ressourceId: newResource.id,
          question: fc.question,
          reponse: fc.reponse,
          niveauBloom: fc.niveauBloom
        });
      }

      // Dupliquer le quiz existant
      const cachedQuiz = await db.findOne('quizzes', q => q.ressourceId === cachedResource.id);
      if (cachedQuiz) {
        await db.insert('quizzes', {
          ressourceId: newResource.id,
          questionsJSON: cachedQuiz.questionsJSON
        });
      }

      return res.status(201).json({
        message: "Ressource créée instantanément via le cache de l'IA.",
        resource: newResource,
        cached: true
      });
    }

    // 2. CACHE MISS : Lancement du traitement en arrière-plan
    const newResource = await db.insert('ressources', {
      titre,
      type,
      hashFichier: fileHash,
      cheminFichier: filePath,
      creePar,
      estValide: false
    });

    const job = await db.insert('jobs', {
      ressourceId: newResource.id,
      statut: 'en_cours',
      erreurMessage: null
    });

    // Lancement du traitement asynchrone (Non-blocking)
    processResourceAsync(newResource, job.id);

    res.status(202).json({
      message: "Fichier reçu. Traitement IA en cours.",
      resource: newResource,
      jobId: job.id,
      cached: false
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Traitement de la ressource en tâche de fond
async function processResourceAsync(resource, jobId) {
  try {
    let textContent = "";
    
    if (resource.type === 'pdf' && resource.cheminFichier) {
      // Extraction réelle du texte du PDF
      textContent = await extractTextFromPDF(resource.cheminFichier);
    } else {
      // Simulation pour les vidéos
      textContent = `Transcription simulée de la vidéo éducative disponible sur ${resource.cheminFichier || 'un lien externe'} concernant le sujet : ${resource.titre}. Ce document explique en détail les concepts théoriques, les formules et les méthodes clés applicables pour comprendre le sujet en profondeur.`;
    }

    // Génération IA (Gemini ou simulateur intelligent)
    const result = await generateLearningMaterials(resource.titre, textContent);

    // Insertion des données générées
    await db.insert('cartes_mentales', {
      ressourceId: resource.id,
      noeudsJSON: JSON.stringify(result.mindmap.nodes),
      liensJSON: JSON.stringify(result.mindmap.links)
    });

    for (const card of result.flashcards) {
      await db.insert('flashcards', {
        ressourceId: resource.id,
        question: card.question,
        reponse: card.reponse,
        niveauBloom: card.niveauBloom
      });
    }

    if (result.quiz && result.quiz.length > 0) {
      await db.insert('quizzes', {
        ressourceId: resource.id,
        questionsJSON: JSON.stringify(result.quiz)
      });
    }

    // Mettre à jour la ressource avec le contenu de texte et le résumé
    await db.update('ressources', resource.id, {
      contenuTexte: textContent,
      resume: result.summary || "Aucun résumé disponible."
    });

    // Mettre à jour le statut du Job à 'termine'
    await db.update('jobs', jobId, { statut: 'termine' });
    console.log(`[JOB SUCCESS] Traitement réussi pour la ressource ${resource.id}`);

  } catch (error) {
    console.error(`[JOB ERROR] Échec du traitement de la ressource ${resource.id}:`, error);
    await db.update('jobs', jobId, {
      statut: 'erreur',
      erreurMessage: error.message
    });
  }
}

// Suivre l'avancement d'un Job de traitement
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await db.findOne('jobs', j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: "Job introuvable." });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- OBTENTION DES DONNÉES PÉDAGOGIQUES ---

// Obtenir la carte mentale d'une ressource
app.get('/api/resources/:id/mindmap', async (req, res) => {
  try {
    const { lang } = req.query;
    const mindmap = await db.findOne('cartes_mentales', m => m.ressourceId === req.params.id);
    if (!mindmap) return res.status(404).json({ error: "Carte mentale non disponible ou en cours de génération." });
    
    const originalData = {
      nodes: JSON.parse(mindmap.noeudsJSON),
      links: JSON.parse(mindmap.liensJSON)
    };
    
    const translatedData = await getOrTranslateAsset(req.params.id, 'mindmap', originalData, lang);
    res.json(translatedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les flashcards d'une ressource
app.get('/api/resources/:id/flashcards', async (req, res) => {
  try {
    const { bloom, lang } = req.query;
    let cards = await db.find('flashcards', f => f.ressourceId === req.params.id);
    
    if (lang && lang !== 'fr') {
      cards = await getOrTranslateAsset(req.params.id, 'flashcards', cards, lang);
    }
    
    if (bloom) {
      cards = cards.filter(c => c.niveauBloom.toLowerCase() === bloom.toLowerCase());
    }
    
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir le quiz d'une ressource (généré à la volée si inexistant pour compatibilité)
app.get('/api/resources/:id/quiz', async (req, res) => {
  try {
    const resId = req.params.id;
    const { lang } = req.query;
    const resource = await db.findOne('ressources', r => r.id === resId);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });

    let quiz = await db.findOne('quizzes', q => q.ressourceId === resId);
    if (!quiz) {
      console.log(`[QUIZ] Génération à la volée du quiz pour la ressource ${resId}`);
      const result = await generateLearningMaterials(resource.titre, resource.contenuTexte || resource.titre);
      quiz = await db.insert('quizzes', {
        ressourceId: resId,
        questionsJSON: JSON.stringify(result.quiz)
      });
    }

    const originalData = JSON.parse(quiz.questionsJSON);
    const translatedData = await getOrTranslateAsset(resId, 'quiz', originalData, lang);
    res.json(translatedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir le podcast d'une ressource (généré et mis en cache à la volée pour économiser les tokens d'upload)
app.get('/api/resources/:id/podcast', async (req, res) => {
  try {
    const resId = req.params.id;
    const { lang } = req.query;
    const resource = await db.findOne('ressources', r => r.id === resId);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });

    let podcast = await db.findOne('podcasts', p => p.ressourceId === resId);
    
    // Purge et régénération automatique si le podcast est un ancien exemple statique simulé
    if (podcast && podcast.dialogueJSON.includes("Bonjour et bienvenue dans notre studio d'apprentissage. Aujourd'hui, nous allons nous pencher")) {
      console.log(`[PODCAST] Détection de l'ancien podcast statique pour la ressource ${resId}. Suppression pour régénération...`);
      await db.delete('podcasts', podcast.id);
      
      // Supprimer également les traductions obsolètes de ce podcast
      try {
        const oldTranslations = await db.find('translations', t => t.ressourceId === resId && t.assetType === 'podcast');
        for (const ot of oldTranslations) {
          await db.delete('translations', ot.id);
        }
        console.log(`[PODCAST] Traductions obsolètes purgées pour la ressource ${resId}.`);
      } catch (transErr) {
        console.error("Erreur de suppression des traductions obsolètes :", transErr);
      }
      
      podcast = null;
    }

    if (!podcast) {
      console.log(`[PODCAST] Génération du podcast pour la ressource ${resId}`);
      const dialogue = await generatePodcastScript(resource.titre, resource.contenuTexte || resource.titre);
      podcast = await db.insert('podcasts', {
        ressourceId: resId,
        dialogueJSON: JSON.stringify(dialogue)
      });
    }

    const originalData = JSON.parse(podcast.dialogueJSON);
    const translatedData = await getOrTranslateAsset(resId, 'podcast', originalData, lang);
    res.json(translatedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Générer et télécharger la présentation PowerPoint d'un cours
app.get('/api/resources/:id/powerpoint', async (req, res) => {
  try {
    const resId = req.params.id;
    const { lang } = req.query;
    const resource = await db.findOne('ressources', r => r.id === resId);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });

    console.log(`[POWERPOINT] Structuration des slides de présentation pour ${resId}`);
    const slidesData = await generatePowerPointSlides(resource.titre, resource.contenuTexte || resource.titre);

    // Initialiser PptxGenJS
    let pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';

    // Définition du thème de couleur (Branding EduPath Indigo)
    const primaryColor = "6D28D9"; // Violet / Indigo
    const headerBgColor = "4F46E5"; // Bleu / Indigo
    const textColor = "1F2937";    // Gris foncé

    // Slide 1: Diapositive de Titre
    let slide1 = pptx.addSlide();
    slide1.background = { fill: primaryColor };
    
    // Décoration - un rectangle blanc discret en bas
    slide1.addShape(pptx.shapes.RECTANGLE, {
      x: 0.0,
      y: 5.2,
      w: 10.0,
      h: 0.4,
      fill: { color: "F3F4F6" }
    });

    slide1.addText(resource.titre, {
      x: 0.5,
      y: 1.8,
      w: 9.0,
      h: 2.0,
      fontSize: 32,
      bold: true,
      color: "FFFFFF",
      align: "center",
      fontFace: "Arial"
    });

    slide1.addText("Présentation pédagogique générée automatiquement par EduPath IA", {
      x: 0.5,
      y: 4.2,
      w: 9.0,
      h: 0.6,
      fontSize: 14,
      color: "E0E7FF",
      align: "center",
      fontFace: "Arial",
      italic: true
    });

    // Slides de Contenu
    slidesData.forEach((slideData, idx) => {
      let slide = pptx.addSlide();
      slide.background = { fill: "FFFFFF" };

      // Bandeau d'en-tête indigo
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.0,
        y: 0.0,
        w: 10.0,
        h: 0.8,
        fill: { color: headerBgColor }
      });

      // Titre de la diapositive
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.15,
        w: 9.0,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: "FFFFFF",
        fontFace: "Arial"
      });

      // Pied de page discret
      slide.addText(`EduPath IA • Page ${idx + 2}`, {
        x: 0.5,
        y: 5.35,
        w: 9.0,
        h: 0.25,
        fontSize: 10,
        color: "9CA3AF",
        fontFace: "Arial"
      });

      // Liste à puces de contenu
      const bulletsText = slideData.bulletPoints.map(p => `•  ${p}`).join("\n\n");
      slide.addText(bulletsText, {
        x: 0.8,
        y: 1.3,
        w: 8.4,
        h: 3.8,
        fontSize: 15,
        color: textColor,
        fontFace: "Arial",
        valign: "top"
      });

      // Notes de l'orateur
      if (slideData.speakerNotes) {
        slide.addNotes(slideData.speakerNotes);
      }
    });

    // Générer le PowerPoint sous forme de Buffer binaire
    const buffer = await pptx.write("nodebuffer");

    // Configurer les en-têtes HTTP de réponse pour le téléchargement direct
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="Presentation_${resId}.pptx"`);
    res.send(buffer);

  } catch (error) {
    console.error("[POWERPOINT ERROR] Échec de la génération PowerPoint :", error);
    res.status(500).json({ error: error.message });
  }
});

// Générer et télécharger le livret de révision PDF d'un cours
app.get('/api/resources/:id/pdf', async (req, res) => {
  try {
    const resId = req.params.id;
    const { etudiantId, lang } = req.query;

    const resource = await db.findOne('ressources', r => r.id === resId);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });

    const student = etudiantId ? await db.findOne('utilisateurs', u => u.id === etudiantId) : null;

    // Récupérer les notes, flashcards et quiz
    const notes = etudiantId ? await db.find('notes', n => n.ressourceId === resId && n.etudiantId === etudiantId) : [];
    const flashcards = await db.find('flashcards', f => f.ressourceId === resId);
    const quizRecord = await db.findOne('quizzes', q => q.ressourceId === resId);
    const quizQuestions = quizRecord ? JSON.parse(quizRecord.questionsJSON) : [];

    // Traduction en direct selon la langue demandée
    const rawSummary = resource.resume || resource.contenuTexte || "";
    const summaryText = await getOrTranslateAsset(resId, 'summary', rawSummary, lang);
    const translatedFlashcards = await getOrTranslateAsset(resId, 'flashcards', flashcards, lang);
    const translatedQuizQuestions = await getOrTranslateAsset(resId, 'quiz', quizQuestions, lang);

    // Dictionnaire de traductions pour la mise en page
    const translations = {
      fr: {
        booklet: "LIVRET DE RÉVISION",
        summary: "Résumé du Cours",
        notes: "Notes de Révision Personnelles",
        flashcards: "Flashcards d'Étude",
        quiz: "Quiz d'Évaluation",
        generatedOn: "Généré le",
        student: "Étudiant",
        level: "Niveau d'études",
        bloomLevel: "Niveau de Bloom",
        noNotes: "Aucune note personnelle rédigée pour ce cours.",
        noFlashcards: "Aucune flashcard disponible pour ce cours.",
        noQuiz: "Aucun quiz disponible pour ce cours.",
        correctAnswer: "Réponse correcte",
        explanation: "Explication",
        question: "Question",
        answer: "Réponse"
      },
      en: {
        booklet: "REVISION BOOKLET",
        summary: "Course Summary",
        notes: "Personal Study Notes",
        flashcards: "Study Flashcards",
        quiz: "Practice Quiz",
        generatedOn: "Generated on",
        student: "Student",
        level: "Study Level",
        bloomLevel: "Bloom Level",
        noNotes: "No personal study notes written for this course.",
        noFlashcards: "No flashcards available for this course.",
        noQuiz: "No quiz available for this course.",
        correctAnswer: "Correct answer",
        explanation: "Explanation",
        question: "Question",
        answer: "Answer"
      },
      ar: {
        booklet: "كتيب المراجعة",
        summary: "ملخص الدرس",
        notes: "ملاحظات المراجعة الشخصية",
        flashcards: "بطاقات الاستذكار",
        quiz: "اختبار تقييمي",
        generatedOn: "تم الإنشاء في",
        student: "الطالب",
        level: "مستوى الدراسة",
        bloomLevel: "مستوى بلوم",
        noNotes: "لا توجد ملاحظات شخصية مكتوبة لهذا الدرس.",
        noFlashcards: "لا توجد بطاقات استذكار متاحة لهذا الدرس.",
        noQuiz: "لا يوجد اختبار متاح لهذا الدرس.",
        correctAnswer: "الإجابة الصحيحة",
        explanation: "الشرح",
        question: "سؤال",
        answer: "إجابة"
      }
    };

    const langKey = translations[lang] ? lang : 'fr';
    const t = translations[langKey];

    // Helper pour nettoyer le Markdown rudimentaire
    function stripMarkdown(text) {
      if (!text) return "";
      return text
        .replace(/#{1,6}\s+(.*)/g, '$1') // en-têtes
        .replace(/\*\*(.*?)\*\*/g, '$1') // gras
        .replace(/\*(.*?)\*/g, '$1') // italique
        .replace(/_(.*?)_/g, '$1') // italique _
        .replace(/`{1,3}(.*?)`{1,3}/gs, '$1') // blocs code
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // liens
        .replace(/^\s*[\-\*+]\s+/gm, '') // listes puces
        .replace(/^\s*\d+\.\s+/gm, ''); // listes numérotées
    }

    // Configurer le document PDF
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    // Encodage Unicode robuste : Charger Arial si disponible
    let fontPath = 'Helvetica';
    let fontBoldPath = 'Helvetica-Bold';
    if (fs.existsSync('C:\\Windows\\Fonts\\arial.ttf')) {
      doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
      fontPath = 'Arial';
    }
    if (fs.existsSync('C:\\Windows\\Fonts\\arialbd.ttf')) {
      doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');
      fontBoldPath = 'Arial-Bold';
    }

    // Configurer les headers HTTP de réponse pour le téléchargement direct
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Livret_${resource.titre.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);

    // Rediriger le flux PDF vers la réponse Express
    doc.pipe(res);

    // --- COUVERTURE ---
    doc.rect(0, 0, 612, 180).fill('#4F46E5');

    doc.fillColor('#FFFFFF')
       .font(fontBoldPath)
       .fontSize(22)
       .text(resource.titre.toUpperCase(), 50, 60, { width: 512, align: 'center' });

    doc.fillColor('#E0E7FF')
       .font(fontPath)
       .fontSize(14)
       .text(t.booklet, 50, 115, { width: 512, align: 'center' });

    doc.fillColor('#1F2937')
       .font(fontBoldPath)
       .fontSize(13)
       .text(`${t.student} :`, 70, 240);

    doc.font(fontPath)
       .fontSize(11)
       .text(student ? student.nom : 'Lucas Bernard', 70, 260)
       .text(student ? student.email : 'lucas.bernard@etu.edupath.fr', 70, 280);

    if (student && student.niveauEtude) {
      doc.font(fontBoldPath)
         .fontSize(13)
         .text(`${t.level} :`, 70, 315);
      doc.font(fontPath)
         .fontSize(11)
         .text(student.niveauEtude, 70, 335);
    }

    doc.font(fontBoldPath)
       .fontSize(13)
       .text(`${t.generatedOn} :`, 70, 375);

    const currentDate = new Date().toLocaleDateString(langKey === 'fr' ? 'fr-FR' : langKey === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.font(fontPath)
       .fontSize(11)
       .text(currentDate, 70, 395);

    doc.strokeColor('#E5E7EB')
       .lineWidth(1)
       .moveTo(70, 440)
       .lineTo(542, 440)
       .stroke();

    doc.fillColor('#9CA3AF')
       .font(fontPath)
       .fontSize(9)
       .text("EDUPATH • Plateforme d'Apprentissage Augmentée par l'IA", 50, 700, { align: 'center', width: 512 });

    // --- SECTION 1 : RÉSUMÉ ---
    doc.addPage();
    doc.fillColor('#4F46E5')
       .font(fontBoldPath)
       .fontSize(16)
       .text(t.summary, 50, 60);

    doc.strokeColor('#4F46E5')
       .lineWidth(2)
       .moveTo(50, 80)
       .lineTo(150, 80)
       .stroke();

    const cleanSummary = stripMarkdown(summaryText);
    doc.fillColor('#374151')
       .font(fontPath)
       .fontSize(10)
       .text(cleanSummary, 50, 100, {
          width: 512,
          align: 'justify',
          lineGap: 4
       });

    // --- SECTION 2 : NOTES ---
    doc.addPage();
    doc.fillColor('#4F46E5')
       .font(fontBoldPath)
       .fontSize(16)
       .text(t.notes, 50, 60);

    doc.strokeColor('#4F46E5')
       .lineWidth(2)
       .moveTo(50, 80)
       .lineTo(150, 80)
       .stroke();

    let noteY = 100;
    if (notes.length === 0) {
      doc.fillColor('#9CA3AF')
         .font(fontPath)
         .fontSize(10)
         .text(t.noNotes, 50, noteY, { italic: true });
    } else {
      notes.forEach((note, index) => {
        if (noteY > 650) {
          doc.addPage();
          noteY = 60;
        }

        doc.fillColor('#111827')
           .font(fontBoldPath)
           .fontSize(12)
           .text(`${index + 1}. ${note.titre}`, 50, noteY);
        
        doc.fillColor('#9CA3AF')
           .font(fontPath)
           .fontSize(8)
           .text(new Date(note.dateCreation).toLocaleDateString(langKey === 'fr' ? 'fr-FR' : 'en-US'), 50, noteY + 14);

        const cleanNoteCont = stripMarkdown(note.contenu);
        doc.fillColor('#374151')
           .font(fontPath)
           .fontSize(9.5)
           .text(cleanNoteCont, 50, noteY + 26, {
              width: 512,
              align: 'left',
              lineGap: 3
           });

        const noteHeight = doc.heightOfString(cleanNoteCont, { width: 512 }) + 40;
        noteY += noteHeight + 15;
      });
    }

    // --- SECTION 3 : FLASHCARDS ---
    doc.addPage();
    doc.fillColor('#4F46E5')
       .font(fontBoldPath)
       .fontSize(16)
       .text(t.flashcards, 50, 60);

    doc.strokeColor('#4F46E5')
       .lineWidth(2)
       .moveTo(50, 80)
       .lineTo(150, 80)
       .stroke();

    let fcY = 100;
    if (translatedFlashcards.length === 0) {
      doc.fillColor('#9CA3AF')
         .font(fontPath)
         .fontSize(10)
         .text(t.noFlashcards, 50, fcY, { italic: true });
    } else {
      const bloomGroups = {};
      translatedFlashcards.forEach(fc => {
        const lvl = fc.niveauBloom || 'Study';
        if (!bloomGroups[lvl]) bloomGroups[lvl] = [];
        bloomGroups[lvl].push(fc);
      });

      Object.keys(bloomGroups).forEach(lvl => {
        if (fcY > 650) {
          doc.addPage();
          fcY = 60;
        }

        doc.fillColor('#10B981')
           .font(fontBoldPath)
           .fontSize(12)
           .text(`${t.bloomLevel} : ${lvl}`, 50, fcY);

        doc.strokeColor('#E5E7EB')
           .lineWidth(1)
           .moveTo(50, fcY + 16)
           .lineTo(562, fcY + 16)
           .stroke();

        fcY += 26;

        bloomGroups[lvl].forEach(fc => {
          const cleanQ = stripMarkdown(fc.question);
          const cleanR = stripMarkdown(fc.reponse);
          const cardHeight = Math.max(
            doc.heightOfString(`${t.question}: ${cleanQ}`, { width: 235 }),
            doc.heightOfString(`${t.answer}: ${cleanR}`, { width: 235 })
          ) + 20;

          if (fcY + cardHeight > 700) {
            doc.addPage();
            fcY = 60;
          }

          // Question container
          doc.rect(50, fcY, 246, cardHeight).fill('#F9FAFB');
          doc.rect(50, fcY, 246, cardHeight).strokeColor('#E5E7EB').stroke();
          
          doc.fillColor('#1F2937')
             .font(fontBoldPath)
             .fontSize(8.5)
             .text(`${t.question} :`, 60, fcY + 6)
             .font(fontPath)
             .fontSize(8.5)
             .text(cleanQ, 60, fcY + 18, { width: 226 });

          // Response container
          doc.rect(306, fcY, 256, cardHeight).fill('#EEF2FF');
          doc.rect(306, fcY, 256, cardHeight).strokeColor('#C7D2FE').stroke();

          doc.fillColor('#4F46E5')
             .font(fontBoldPath)
             .fontSize(8.5)
             .text(`${t.answer} :`, 316, fcY + 6)
             .fillColor('#374151')
             .font(fontPath)
             .fontSize(8.5)
             .text(cleanR, 316, fcY + 18, { width: 236 });

          fcY += cardHeight + 12;
        });

        fcY += 10;
      });
    }

    // --- SECTION 4 : QUIZ ---
    doc.addPage();
    doc.fillColor('#4F46E5')
       .font(fontBoldPath)
       .fontSize(16)
       .text(t.quiz, 50, 60);

    doc.strokeColor('#4F46E5')
       .lineWidth(2)
       .moveTo(50, 80)
       .lineTo(150, 80)
       .stroke();

    let quizY = 100;
    if (translatedQuizQuestions.length === 0) {
      doc.fillColor('#9CA3AF')
         .font(fontPath)
         .fontSize(10)
         .text(t.noQuiz, 50, quizY, { italic: true });
    } else {
      translatedQuizQuestions.forEach((q, qIdx) => {
        const cleanQuestion = stripMarkdown(q.questionText || q.question || "");
        const explanation = stripMarkdown(q.explanation || "");
        const options = q.options || [];
        
        let optHeight = 0;
        options.forEach(opt => {
          optHeight += doc.heightOfString(`• ${opt}`, { width: 492 }) + 4;
        });

        const qHeight = doc.heightOfString(`${qIdx + 1}. ${cleanQuestion}`, { width: 512 }) + 
                        optHeight + 
                        doc.heightOfString(`${t.correctAnswer}: ${q.correctAnswer}`, { width: 512 }) + 
                        (explanation ? doc.heightOfString(`${t.explanation}: ${explanation}`, { width: 512 }) : 0) + 40;

        if (quizY + qHeight > 700) {
          doc.addPage();
          quizY = 60;
        }

        doc.fillColor('#111827')
           .font(fontBoldPath)
           .fontSize(10.5)
           .text(`${qIdx + 1}. ${cleanQuestion}`, 50, quizY, { width: 512 });

        quizY += doc.heightOfString(`${qIdx + 1}. ${cleanQuestion}`, { width: 512 }) + 6;

        options.forEach(opt => {
          doc.fillColor('#374151')
             .font(fontPath)
             .fontSize(9.5)
             .text(`  •  ${opt}`, 60, quizY, { width: 492 });
          quizY += doc.heightOfString(`  •  ${opt}`, { width: 492 }) + 4;
        });

        doc.fillColor('#059669')
           .font(fontBoldPath)
           .fontSize(9)
           .text(`  ${t.correctAnswer} : ${q.correctAnswer || q.reponseCorrecte || ''}`, 50, quizY + 4);
        quizY += 16;

        if (explanation) {
          doc.fillColor('#6B7280')
             .font(fontPath)
             .fontSize(8.5)
             .text(`  ${t.explanation} : ${explanation}`, 50, quizY, { width: 512, align: 'justify' });
          quizY += doc.heightOfString(`  ${t.explanation} : ${explanation}`, { width: 512 }) + 8;
        }

        doc.strokeColor('#F3F4F6')
           .lineWidth(1)
           .moveTo(50, quizY)
           .lineTo(562, quizY)
           .stroke();

        quizY += 12;
      });
    }

    // --- AJOUT EN-TÊTES ET PIEDS DE PAGE DYNAMIQUES ---
    const finalRange = doc.bufferedPageRange();
    for (let i = 0; i < finalRange.count; i++) {
      doc.switchToPage(i);
      if (i === 0) continue; // Ignorer la couverture

      // En-tête
      doc.strokeColor('#E5E7EB')
         .lineWidth(0.5)
         .moveTo(50, 40)
         .lineTo(562, 40)
         .stroke();

      doc.fillColor('#9CA3AF')
         .font(fontPath)
         .fontSize(8)
         .text("EduPath | " + resource.titre, 50, 28, { align: 'left' });

      // Pied de page
      doc.strokeColor('#E5E7EB')
         .lineWidth(0.5)
         .moveTo(50, 735)
         .lineTo(562, 735)
         .stroke();

      doc.fillColor('#9CA3AF')
         .font(fontPath)
         .fontSize(8)
         .text(t.generatedOn + " : " + currentDate, 50, 742, { align: 'left' });

      doc.text(`${i + 1} / ${finalRange.count}`, 50, 742, { align: 'right', width: 512 });
    }

    // Finaliser le document
    doc.end();

  } catch (error) {
    console.error("[PDF GENERATION ERROR] Échec de la génération du livret PDF :", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Valider une ressource (Publier officiellement aux étudiants)
app.post('/api/resources/:id/validate', async (req, res) => {
  try {
    const resource = await db.update('ressources', req.params.id, { estValide: true });
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });
    res.json({ message: "Ressource validée et publiée avec succès.", resource });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une ressource
app.delete('/api/resources/:id', async (req, res) => {
  try {
    const resId = req.params.id;
    const resource = await db.findOne('ressources', r => r.id === resId);
    if (!resource) return res.status(404).json({ error: "Ressource introuvable." });

    // Supprimer le fichier si existant
    if (resource.cheminFichier && fs.existsSync(resource.cheminFichier)) {
      try {
        fs.unlinkSync(resource.cheminFichier);
      } catch (err) {
        console.error("Impossible de supprimer le fichier physique:", err);
      }
    }

    // Supprimer les données reliées
    await db.delete('ressources', resId);
    
    const mindmap = await db.findOne('cartes_mentales', m => m.ressourceId === resId);
    if (mindmap) await db.delete('cartes_mentales', mindmap.id);

    const cards = await db.find('flashcards', f => f.ressourceId === resId);
    for (const c of cards) {
      await db.delete('flashcards', c.id);
    }

    // Nettoyer les commentaires associés
    const comments = await db.find('commentaires', c => c.ressourceId === resId);
    for (const c of comments) {
      await db.delete('commentaires', c.id);
    }

    res.json({ message: "Ressource et données associées supprimées." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- ASSISTANT DE CHAT NOTEBOOKLM (CONTEXTE COURS) ---

app.post('/api/resources/:id/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const { lang } = req.query;
    const resourceId = req.params.id;

    if (!message) {
      return res.status(400).json({ error: "Veuillez saisir une question." });
    }

    const resource = await db.findOne('ressources', r => r.id === resourceId);
    if (!resource) {
      return res.status(404).json({ error: "Cours introuvable." });
    }

    const responseText = await answerQuestionAboutDocument(
      resource.titre,
      resource.contenuTexte,
      message,
      history || [],
      lang || 'fr'
    );

    res.json({ response: responseText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


// --- ESPACE DE DISCUSSIONS & COMMENTAIRES ---

// Récupérer les commentaires d'une leçon
app.get('/api/resources/:id/comments', async (req, res) => {
  try {
    const comments = await db.find('commentaires', c => c.ressourceId === req.params.id);
    // Tri chronologique
    comments.sort((a, b) => new Date(a.dateCreation) - new Date(b.dateCreation));
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter un commentaire sous une leçon
app.post('/api/resources/:id/comments', async (req, res) => {
  try {
    const { auteurId, auteurNom, auteurRole, contenu } = req.body;
    const ressourceId = req.params.id;

    if (!auteurId || !auteurNom || !auteurRole || !contenu) {
      return res.status(400).json({ error: "Nom, contenu et rôles requis." });
    }

    const newComment = await db.insert('commentaires', {
      ressourceId,
      auteurId,
      auteurNom,
      auteurRole,
      contenu
    });

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- CAHIER DE NOTES PERSONNEL (NOTEBOOKLM NOTEPAD FEATURE) ---

// Récupérer les notes de l'étudiant pour une leçon
app.get('/api/resources/:id/notes', async (req, res) => {
  try {
    const { etudiantId } = req.query;
    if (!etudiantId) {
      return res.status(400).json({ error: "etudiantId requis." });
    }
    const notes = await db.find('notes', n => n.ressourceId === req.params.id && n.etudiantId === etudiantId);
    // Trier les notes par date de création décroissante
    notes.sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une note personnelle
app.post('/api/resources/:id/notes', async (req, res) => {
  try {
    const { etudiantId, titre, contenu } = req.body;
    const ressourceId = req.params.id;

    if (!etudiantId || !titre || !contenu) {
      return res.status(400).json({ error: "etudiantId, titre et contenu requis." });
    }

    const newNote = await db.insert('notes', {
      ressourceId,
      etudiantId,
      titre,
      contenu
    });

    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modifier une note existante
app.put('/api/notes/:id', async (req, res) => {
  try {
    const { titre, contenu } = req.body;
    if (!titre || !contenu) {
      return res.status(400).json({ error: "Titre et contenu requis." });
    }

    const updatedNote = await db.update('notes', req.params.id, {
      titre,
      contenu
    });

    res.json(updatedNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une note personnelle
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const result = await db.delete('notes', req.params.id);
    if (!result) return res.status(404).json({ error: "Note introuvable." });
    res.json({ message: "Note personnelle supprimée avec succès." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- SYSTÈME DE RÉPÉTITION ESPACÉE (SUPERMEMO SM-2 SIMPLIFIÉ) ---

// Enregistrer la révision d'une flashcard par un étudiant
app.post('/api/flashcards/:id/review', async (req, res) => {
  try {
    const { studentId, rating } = req.body; // rating: 'sais' (Je sais) ou 'revoir' (À revoir)
    const cardId = req.params.id;

    if (!studentId || !rating) {
      return res.status(400).json({ error: "Champs studentId et rating requis." });
    }

    // Retrouver la carte pour s'assurer qu'elle existe
    const card = await db.findOne('flashcards', f => f.id === cardId);
    if (!card) return res.status(404).json({ error: "Flashcard introuvable." });

    // Trouver ou créer la statistique de révision
    let stat = await db.findOne('statistiques_apprentissage', s => s.etudiantId === studentId && s.flashcardId === cardId);
    
    let repetitions = stat ? stat.repetitions : 0;
    let intervalle = stat ? stat.intervalle : 0; // en jours
    let scoreFacilite = stat ? stat.scoreFacilite : 2.5; // Ease factor initial

    if (rating === 'revoir') {
      // Échec : Réinitialiser la répétition et l'intervalle à 1 jour, réduire légèrement la facilité
      repetitions = 0;
      intervalle = 1;
      scoreFacilite = Math.max(1.3, scoreFacilite - 0.2);
    } else if (rating === 'sais') {
      // Succès
      if (repetitions === 0) {
        intervalle = 1; // 1 jour
      } else if (repetitions === 1) {
        intervalle = 4; // 4 jours
      } else {
        intervalle = Math.round(intervalle * scoreFacilite);
      }
      repetitions += 1;
      scoreFacilite = Math.min(3.0, scoreFacilite + 0.1);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalle);

    const updateData = {
      etudiantId: studentId,
      flashcardId: cardId,
      repetitions,
      intervalle,
      scoreFacilite,
      dateProchaineRevision: nextReview.toISOString()
    };

    if (stat) {
      stat = await db.update('statistiques_apprentissage', stat.id, updateData);
    } else {
      stat = await db.insert('statistiques_apprentissage', updateData);
    }

    res.json({ message: "Statistique enregistrée.", stat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer le résumé des statistiques de l'étudiant
app.get('/api/students/:studentId/stats', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const { lang } = req.query;
    const stats = await db.find('statistiques_apprentissage', s => s.etudiantId === studentId);
    
    const totalReviews = stats.length;
    const learnedCards = stats.filter(s => s.repetitions > 1).length;
    const reviewDueCount = stats.filter(s => new Date(s.dateProchaineRevision) <= new Date()).length;

    // Répartition Bloom des cartes étudiées de manière performante
    const bloomCounts = {};
    const flashcards = await db.find('flashcards');
    stats.forEach(s => {
      const card = flashcards.find(f => f.id === s.flashcardId);
      if (card) {
        bloomCounts[card.niveauBloom] = (bloomCounts[card.niveauBloom] || 0) + 1;
      }
    });

    // Statistiques complémentaires pour la gamification
    const notesCount = (await db.find('notes', n => n.etudiantId === studentId)).length;
    const commentsCount = (await db.find('commentaires', c => c.auteurId === studentId)).length;

    // Calcul des badges dynamique
    const badges = [
      {
        id: "badge_novice",
        label: lang => lang === 'fr' ? "Novice de l'Étude 🎓" : lang === 'ar' ? "مبتدئ الدراسة 🎓" : "Study Novice 🎓",
        description: lang => lang === 'fr' ? "Avoir révisé au moins 1 flashcard." : lang === 'ar' ? "راجع بطاقة تعليمية واحدة على الأقل." : "Have reviewed at least 1 flashcard.",
        unlocked: totalReviews >= 1,
        progress: Math.min(100, Math.round((totalReviews / 1) * 100))
      },
      {
        id: "badge_writer",
        label: lang => lang === 'fr' ? "Plume Rigoureuse ✍️" : lang === 'ar' ? "قلم دقيق ✍️" : "Rigorous Writer ✍️",
        description: lang => lang === 'fr' ? "Avoir rédigé au moins 2 notes de révision." : lang === 'ar' ? "كتب ملاحظتين للمراجعة على الأقل." : "Have written at least 2 study notes.",
        unlocked: notesCount >= 2,
        progress: Math.min(100, Math.round((notesCount / 2) * 100))
      },
      {
        id: "badge_collaborator",
        label: lang => lang === 'fr' ? "Esprit d'Équipe 💬" : lang === 'ar' ? "روح الفريق 💬" : "Team Spirit 💬",
        description: lang => lang === 'fr' ? "Avoir publié au moins 1 commentaire." : lang === 'ar' ? "نشر تعليقًا واحدًا على الأقل في المناقشات." : "Have posted at least 1 comment in discussions.",
        unlocked: commentsCount >= 1,
        progress: Math.min(100, Math.round((commentsCount / 1) * 100))
      },
      {
        id: "badge_master",
        label: lang => lang === 'fr' ? "Maître de Bloom 🏆" : lang === 'ar' ? "بطل بلوم 🏆" : "Bloom Master 🏆",
        description: lang => lang === 'fr' ? "Avoir maîtrisé (2+ répétitions) au moins 5 flashcards." : lang === 'ar' ? "أتقن 5 بطاقات تعليمية على الأقل." : "Have mastered at least 5 flashcards.",
        unlocked: learnedCards >= 5,
        progress: Math.min(100, Math.round((learnedCards / 5) * 100))
      },
      {
        id: "badge_perfect",
        label: lang => lang === 'fr' ? "Savoir Universel 🎯" : lang === 'ar' ? "المعرفة الشاملة 🎯" : "Universal Knowledge 🎯",
        description: lang => lang === 'fr' ? "Avoir étudié au moins une carte dans les 6 niveaux Bloom." : lang === 'ar' ? "درس بطاقة واحدة على الأقل في مستويات بلوم الستة." : "Have studied at least one card in all 6 Bloom levels.",
        unlocked: false,
        progress: 0
      }
    ];

    // Perfect badge logic
    const bloomLevelsStudied = new Set();
    stats.forEach(s => {
      const card = flashcards.find(f => f.id === s.flashcardId);
      if (card) {
        bloomLevelsStudied.add(card.niveauBloom.toLowerCase());
      }
    });
    
    let totalBloomLevelsCount = 6;
    let studiedCount = 0;
    
    const frenchLevels = ["mémorisation", "compréhension", "application", "analyse", "évaluation", "création"];
    const englishLevels = ["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"];
    const arabicLevels = ["التذكر", "الفهم", "التطبيق", "التحليل", "التقييم", "الابتكار"];
    
    const studiedSet = new Set();
    bloomLevelsStudied.forEach(lvl => {
      for (let i = 0; i < 6; i++) {
        if (lvl.includes(frenchLevels[i]) || lvl.includes(englishLevels[i]) || lvl.includes(arabicLevels[i])) {
          studiedSet.add(i);
        }
      }
    });

    studiedCount = studiedSet.size;
    badges[4].progress = Math.min(100, Math.round((studiedCount / totalBloomLevelsCount) * 100));
    badges[4].unlocked = studiedCount === totalBloomLevelsCount;

    const reqLang = lang || 'fr';
    const mappedBadges = badges.map(b => ({
      id: b.id,
      label: typeof b.label === 'function' ? b.label(reqLang) : b.label,
      description: typeof b.description === 'function' ? b.description(reqLang) : b.description,
      unlocked: b.unlocked,
      progress: b.progress
    }));

    res.json({
      totalReviews,
      learnedCards,
      reviewDueCount,
      bloomCounts,
      badges: mappedBadges,
      notesCount,
      commentsCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ROUTES D'ADMINISTRATION (PANEL ADMIN) ---

// 1. Statistiques globales de la plateforme
app.get('/api/admin/stats', async (req, res) => {
  try {
    const users = await db.find('utilisateurs');
    const resources = await db.find('ressources');
    const flashcards = await db.find('flashcards');
    const statsReviews = await db.find('statistiques_apprentissage');

    const totalUsers = users.length;
    const teachersCount = users.filter(u => u.role === 'enseignant').length;
    const studentsCount = users.filter(u => u.role === 'etudiant').length;
    const adminsCount = users.filter(u => u.role === 'admin').length;

    const totalResources = resources.length;
    const pdfCount = resources.filter(r => r.type === 'pdf').length;
    const videoCount = resources.filter(r => r.type === 'video').length;

    const totalFlashcards = flashcards.length;
    const totalReviews = statsReviews.length;

    res.json({
      users: { total: totalUsers, teachers: teachersCount, students: studentsCount, admins: adminsCount },
      resources: { total: totalResources, pdf: pdfCount, video: videoCount },
      flashcards: { total: totalFlashcards },
      reviews: { total: totalReviews }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Liste de tous les utilisateurs
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.find('utilisateurs');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Modifier le rôle d'un utilisateur
app.put('/api/admin/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'enseignant', 'etudiant'].includes(role)) {
      return res.status(400).json({ error: "Rôle invalide ou manquant." });
    }
    if (req.params.id === 'u3') {
      return res.status(403).json({ error: "Impossible de modifier le rôle de l'administrateur principal." });
    }
    if (role === 'admin') {
      return res.status(403).json({ error: "Il ne peut y avoir qu'un seul compte administrateur unique dans le système." });
    }
    const user = await db.update('utilisateurs', req.params.id, { role });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.json({ message: "Rôle de l'utilisateur mis à jour.", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Supprimer un utilisateur
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === 'u3') {
      return res.status(403).json({ error: "Impossible de supprimer l'administrateur principal." });
    }
    const user = await db.findOne('utilisateurs', u => u.id === userId);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

    // Supprimer l'utilisateur
    await db.delete('utilisateurs', userId);

    // Si c'est un enseignant, supprimer ses ressources associées
    if (user.role === 'enseignant') {
      const teacherResources = await db.find('ressources', r => r.creePar === userId);
      for (const resObj of teacherResources) {
        // Supprimer fichiers physiques
        if (resObj.cheminFichier && fs.existsSync(resObj.cheminFichier)) {
          try { fs.unlinkSync(resObj.cheminFichier); } catch (e) {}
        }
        await db.delete('ressources', resObj.id);
        
        // Supprimer cartes mentales associées
        const mm = await db.findOne('cartes_mentales', m => m.ressourceId === resObj.id);
        if (mm) await db.delete('cartes_mentales', mm.id);

        // Supprimer flashcards associées
        const fc = await db.find('flashcards', f => f.ressourceId === resObj.id);
        for (const f of fc) {
          await db.delete('flashcards', f.id);
        }
      }
    }

    // Supprimer les statistiques d'apprentissage de l'étudiant
    if (user.role === 'etudiant') {
      const studentStats = await db.find('statistiques_apprentissage', s => s.etudiantId === userId);
      for (const s of studentStats) {
        await db.delete('statistiques_apprentissage', s.id);
      }
    }

    res.json({ message: "Utilisateur et ses données nettoyées avec succès." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Démarrer le serveur backend avec gestion d'erreur EADDRINUSE
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Serveur EduPath en ligne sur http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} occupé. Tentative sur le port ${port + 1}...`);
      // Essayer le port suivant
      setTimeout(() => startServer(port + 1), 200);
    } else {
      console.error('Erreur du serveur :', err);
      process.exit(1);
    }
  });
}

startServer(Number(PORT) || 5000);
