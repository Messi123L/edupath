import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import db, { hashPassword } from './db.js';
import { extractTextFromPDF } from './pdf-extractor.js';
import { generateLearningMaterials, answerQuestionAboutDocument, generatePodcastScript, translateContent } from './gemini.js';

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

    res.json({
      totalReviews,
      learnedCards,
      reviewDueCount,
      bloomCounts
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
