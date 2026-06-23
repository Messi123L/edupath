# 🎓 EduPath - Plateforme d'Apprentissage Augmentée par l'IA

EduPath est une plateforme EdTech moderne et intelligente conçue pour optimiser et personnaliser l'apprentissage des étudiants grâce à l'intelligence artificielle (Google Gemini). Inspirée de NotebookLM, elle offre un espace de travail complet en écran partagé (split-screen) combinant des documents de cours avec des outils d'études avancés générés à la volée.

---

## 🚀 Fonctionnalités Clés

### 1. 🧠 Workspace Style NotebookLM
* **Écran partagé** : Liseuse interactive de cours (PDF ou Vidéo YouTube/MP4) dans la colonne de gauche et suite d'outils IA à droite.
* **Plein écran** : Mode d'agrandissement d'un simple clic pour focaliser sur la carte mentale ou la liseuse.

### 2. 🤖 Assistant IA & Tuteur Interactif
* **Chat contextuel** : Chatbot intelligent répondant aux questions de l'étudiant en se basant *uniquement* sur le texte extrait du cours.
* **Suggestions de questions (Chips)** : Suggestions de prompts adaptées pour débuter la discussion.
* **Support multilingue** : Traduction à la volée de toutes les réponses et saisies dans la langue de l'utilisateur (Français, Anglais, Arabe).

### 3. 🗺️ Carte Mentale Collaborative (MindMap)
* **Visualisation interactive** : Rendu dynamique SVG (D3.js) représentant l'organisation logique du cours.
* **Design Professionnel** : Arrière-plan style tableau blanc (CAD dot-grid), coins arrondis, transitions lisses et emojis distinctifs par type de nœud (Root 🎯, Chapitres 📖, Concepts 💡).
* **Détails au clic** : Sélection d'un concept pour afficher sa définition détaillée dans un volet latéral.

### 4. 🃏 Flashcards & Répétition Espacée
* **Taxonomie de Bloom** : Flashcards réparties par niveaux cognitifs (Mémorisation, Compréhension, Application, Analyse, Évaluation, Création).
* **Algorithme SM-2 (SuperMemo)** : Moteur de répétition espacée intégré calculant la prochaine date de révision selon le niveau de maîtrise renseigné par l'étudiant.

### 5. 📝 Quiz Interactif
* **Génération IA** : 5 questions à choix multiples (QCM) produites automatiquement d'après le cours.
* **Retour immédiat** : Réponses validées en vert (correct) ou rouge (incorrect) avec explications pédagogiques détaillées.

### 6. 🎙️ Studio Podcast IA
* **Script de débat** : Dialogue vivant et interactif généré à partir du cours entre deux présentateurs fictifs : **Sophie** (experte posée) et **Marc** (étudiant curieux).
* **Synthèse Vocale Native** : Lecture audio avec voix alternées utilisant le moteur native `SpeechSynthesis` du navigateur (sans latence ni frais réseau).
* **Waveform animée** : Courbe audio réactive en temps réel.

### 7. 📓 Cahier de Notes Personnel (Notepad)
* **Prise de notes** : Éditeur de notes personnelles pour l'étudiant associé à chaque cours (CRUD complet).

---

## 🛠️ Stack Technique

* **Frontend** : React.js (Vite), D3.js (visualisation SVG), Vanilla CSS (design minimaliste, thèmes Sombre/Clair contrastés, variables CSS réactives).
* **Backend** : Node.js, Express, Multer (gestion des fichiers), PDF-Parse (extraction de texte).
* **Base de données** : MySQL (schéma relationnel complet, gestion du cache IA).
* **Intelligence Artificielle** : API Google Gemini (`gemini-2.5-flash`).

---

## 📂 Structure du Schéma MySQL

La base de données MySQL `edupath` s'articule autour des tables suivantes :
- `utilisateurs` : Stockage des étudiants, enseignants et administrateurs.
- `ressources` : Références des cours (fichiers PDF et vidéos) et extraits textuels.
- `cartes_mentales` : Structures de nœuds et liens de mindmaps au format JSON.
- `flashcards` : Questions/réponses associées aux cours par niveau Bloom.
- `quizzes` : Séries de QCM avec leurs options et explications en JSON.
- `podcasts` : Scripts conversationnels Sophie/Marc générés à la volée.
- `translations` : Table de mise en cache pour stocker les traductions multilingues des assets (évite de ré-interroger Gemini inutilement).
- `notes` : Cahier de notes individuel pour les étudiants.
- `statistiques_apprentissage` : Historique des révisions de flashcards (Répétitions, Intervalle, Facteur d'aisance).
- `jobs` : Suivi d'avancement asynchrone des analyses de documents.

---

## ⚙️ Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) (v16+)
- [MySQL Server](https://www.mysql.com/) en local (sans mot de passe par défaut sur `root`, ou à configurer dans `.env`).

### Étape 1 : Configuration du Backend
1. Naviguez dans le dossier `backend` :
   ```bash
   cd backend
   ```
2. Créez un fichier `.env` sur le modèle suivant :
   ```env
   PORT=5000
   GEMINI_API_KEY=VOTRE_CLE_API_GEMINI
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=edupath
   ```
3. Installez les dépendances et démarrez le serveur :
   ```bash
   npm install
   npm run dev
   ```

### Étape 2 : Configuration du Frontend
1. Naviguez dans le dossier `frontend` :
   ```bash
   cd ../frontend
   ```
2. Installez les dépendances et démarrez l'application :
   ```bash
   npm install
   npm run dev
   ```
3. Ouvrez votre navigateur sur : [http://localhost:5174/](http://localhost:5174/)

---

## 👥 Comptes de Test

| Rôle | Adresse Email | Mot de passe |
|---|---|---|
| **Administrateur** | `admin@edupath.fr` | `admin123` |
| **Enseignant** | `user@gmail.com` | `jean123` |
| **Étudiant** | `lucas.bernard@etu.edupath.fr` | `lucas123` |
