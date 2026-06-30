import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  try {
    // Initialisation de Google Gemini
    ai = new GoogleGenerativeAI(apiKey);
    console.log("IA : Google Gemini API configurée avec succès.");
  } catch (err) {
    console.error("Erreur d'initialisation de Google Gemini :", err.message);
  }
} else {
  console.log("IA : Clé GEMINI_API_KEY non fournie. Utilisation du simulateur d'IA local.");
}

/**
 * Génère la carte mentale et les flashcards d'une ressource.
 * @param {string} titre Titre du cours / de la ressource
 * @param {string} texte Texte extrait du cours
 * @returns {Promise<{mindmap: {nodes: Array, links: Array}, flashcards: Array}>}
 */
export async function generateLearningMaterials(titre, texte) {
  if (ai) {
    try {
      return await generateWithGemini(titre, texte);
    } catch (error) {
      console.error("Échec de la génération avec Gemini. Passage au simulateur local...", error);
      return generateSimulatedMaterials(titre, texte);
    }
  } else {
    // Simulation avec un délai réaliste de 3 secondes pour imiter le réseau/traitement
    await new Promise(resolve => setTimeout(resolve, 3000));
    return generateSimulatedMaterials(titre, texte);
  }
}

/**
 * Appel réel de l'API Google Gemini 1.5 Pro
 */
async function generateWithGemini(titre, texte) {
  const modelName = 'gemini-2.5-flash';
  const prompt = `
Tu es un expert en technologies éducatives (EdTech) et en pédagogie cognitive.
Analyse le texte du cours ci-dessous intitulé "${titre}".
Génère un résumé détaillé du cours, une carte mentale (MindMap), un paquet de flashcards structurés selon la taxonomie de Bloom, et un quiz interactif de 5 questions QCM.

Si le texte du cours ci-dessous est court (moins de 200 mots) ou s'il s'agit d'une transcription simulée d'une vidéo pédagogique, vous devez d'abord imaginer et rédiger mentalement une leçon de cours complète et détaillée d'au moins 1000 mots basée sur le titre "${titre}". Ensuite, générez le résumé ("summary"), la carte mentale ("mindmap"), les flashcards et le quiz à partir de cette leçon détaillée développée.

Le format de sortie DOIT être un JSON valide unique respectant scrupuleusement la structure suivante :
{
  "summary": "Résumé structuré et détaillé du cours, avec chapitres et concepts principaux sous forme de synthèse textuelle au format Markdown. Ce résumé doit être pédagogique, instructif et faire au moins 4 paragraphes. À la toute fin de ce résumé (après les paragraphes), vous DEVEZ obligatoirement ajouter un schéma conceptuel dessiné avec la syntaxe de code Mermaid.js (délimité par un bloc de code comme \`\`\`mermaid \\n graph TD \\n ... \\n \`\`\`) pour illustrer visuellement la structure logique ou le flux des concepts clés du cours.",
  "mindmap": {
    "nodes": [
      { "id": "identifiant_unique_court", "label": "Titre du concept", "type": "root|main|sub|concept", "description": "Explication succinte ou définition" }
    ],
    "links": [
      { "source": "id_source", "target": "id_destination" }
    ]
  },
  "flashcards": [
    {
      "question": "Question claire posée à l'étudiant",
      "reponse": "Réponse concise et explicative",
      "niveauBloom": "Mémorisation|Compréhension|Application|Analyse|Évaluation|Création"
    }
  ],
  "quiz": [
    {
      "question": "Question claire à choix multiple (QCM) sur le cours",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
      "correctOptionIndex": 0,
      "explanation": "Explication pédagogique de la bonne réponse"
    }
  ]
}

Règles de génération :
1. Crée un résumé instructif (champ "summary") reprenant les grandes lignes.
2. Crée un nœud racine ("root") pour le sujet principal.
3. Crée 3 à 5 nœuds principaux ("main") correspondant aux grands chapitres ou idées du texte.
4. Attache des sous-nœuds ("sub") ou concepts ("concept") à ces nœuds principaux avec des descriptions instructives.
5. Génère entre 8 et 15 flashcards de haute qualité, équitablement réparties sur les niveaux de la taxonomie de Bloom.
6. Génère exactement 5 questions de quiz (champ "quiz") de type QCM avec 4 options chacun, un index correct valide (0 à 3) et une explication claire.
7. Reste strictement en langue française.

Texte du cours :
${texte.substring(0, 30000)} // Limite de sécurité pour le contexte
`;

  const model = ai.getGenerativeModel({ model: modelName });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const responseText = result.response.text();
  try {
    return JSON.parse(responseText);
  } catch (e) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("La réponse de l'IA n'est pas un JSON valide : " + responseText);
  }
}

/**
 * Simulateur d'IA intelligent local de secours
 */
function generateSimulatedMaterials(titre, texte) {
  console.log(`Simulation de génération d'apprentissage pour : ${titre}`);
  
  // Analyse basique du texte pour en faire des concepts
  const words = texte.split(/\s+/).filter(w => w.length > 5);
  const uniqueWords = [...new Set(words)].slice(0, 10).map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""));
  
  const rootId = "root";
  const nodes = [
    {
      id: rootId,
      label: titre,
      type: "root",
      description: `Sujet principal de l'apprentissage basé sur le document : ${titre}.`
    }
  ];
  
  const links = [];

  // Chapitres simulés basés sur des termes courants ou par défaut
  const chapitres = [
    { label: "Principes Fondamentaux", desc: "Introduction aux bases et définitions essentielles du cours." },
    { label: "Méthodologie & Processus", desc: "Étapes pratiques, règles de fonctionnement et mise en œuvre." },
    { label: "Analyse Clinique & Critique", desc: "Évaluation des limites, comparaison et étude détaillée." }
  ];

  chapitres.forEach((chap, idx) => {
    const chapId = `main_${idx + 1}`;
    nodes.push({
      id: chapId,
      label: chap.label,
      type: "main",
      description: chap.desc
    });
    links.push({ source: rootId, target: chapId });

    // Ajouter des sous-concepts
    for (let c = 1; c <= 2; c++) {
      const subId = `${chapId}_sub_${c}`;
      const keyword = uniqueWords[(idx * 2 + c) % uniqueWords.length] || "Concept";
      const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      nodes.push({
        id: subId,
        label: `${capitalizedKeyword} clé`,
        type: "sub",
        description: `Étude approfondie de l'élément '${keyword}' dans le cadre de : ${chap.label}.`
      });
      links.push({ source: chapId, target: subId });
    }
  });

  // Flashcards basées sur la taxonomie de Bloom
  const flashcards = [
    {
      question: `Quelle est la définition principale ou le but de : ${titre} ?`,
      reponse: `Il s'agit d'étudier les notions clés et les structures associées décrites dans le document, notamment les concepts fondamentaux de ${uniqueWords[0] || 'ce domaine'}.`,
      niveauBloom: "Mémorisation"
    },
    {
      question: `Expliquez le concept de '${uniqueWords[1] || 'Fonctionnement'}' avec vos propres mots.`,
      reponse: `Ce concept désigne l'intégration des éléments théoriques à la pratique pour permettre de structurer les connaissances efficacement.`,
      niveauBloom: "Compréhension"
    },
    {
      question: `Comment utiliseriez-vous la notion de '${uniqueWords[2] || 'Méthodologie'}' pour résoudre un problème concret ?`,
      reponse: `En suivant les étapes clés établies dans la section Méthodologie, on peut séduir le problème en sous-tâches gérables et appliquer les protocoles un à un.`,
      niveauBloom: "Application"
    },
    {
      question: `Quels sont les facteurs limitants ou les contraintes de '${uniqueWords[3] || 'Analyse'}' ?`,
      reponse: `Les contraintes résident principalement dans la précision des données initiales, le temps de traitement et les conditions d'application des formules ou théories.`,
      niveauBloom: "Analyse"
    },
    {
      question: `Évaluez l'efficacité globale de l'approche décrite dans '${titre}'. Quels en sont les points forts et les faiblesses ?`,
      reponse: `Le point fort est la rigueur académique et la clarté. La faiblesse majeure reste le manque d'adaptation aux cas particuliers complexes nécessitant une expertise métier.`,
      niveauBloom: "Évaluation"
    },
    {
      question: `Proposez un nouveau modèle théorique ou une extension qui intégrerait '${uniqueWords[4] || 'Innovation'}' à ce cours.`,
      reponse: `Un modèle hybride combinant la théorie classique du cours avec des algorithmes d'optimisation modernes pour automatiser la prise de décision.`,
      niveauBloom: "Création"
    }
  ];

  // Extraction d'un résumé dynamique à partir du texte si disponible
  let summaryText = `### 📄 Synthèse du cours "${titre}"\n\n`;
  if (texte && texte.trim().length > 100) {
    const paragraphs = texte.split(/\n+/).map(p => p.trim()).filter(p => p.length > 40);
    if (paragraphs.length >= 2) {
      summaryText += `**Aperçu Général :**\n${paragraphs.slice(0, 2).join('\n\n')}\n\n`;
      summaryText += `**Concepts Clés Abordés :**\n`;
      const keywordsList = uniqueWords.slice(0, 5).map(w => `* **${w.charAt(0).toUpperCase() + w.slice(1)}** : Notion clé identifiée dans le contenu du cours.`);
      summaryText += keywordsList.join('\n') + `\n\n`;
      summaryText += `**Développement & Analyse :**\n${paragraphs.slice(2, Math.min(6, paragraphs.length)).join('\n\n')}`;
    } else {
      summaryText += `${texte.substring(0, 1000)}...\n\n*(Synthèse extraite du document source)*`;
    }
  } else {
    summaryText += `Ce cours introduit les concepts clés associés à **${titre}**.\n\n#### Chapitre 1 : Principes Fondamentaux\nNous explorons les bases et définitions théoriques majeures de *${uniqueWords[0] || 'ce domaine'}*. L'objectif est de s'approprier le vocabulaire et les notions de départ.\n\n#### Chapitre 2 : Méthodologie & Processus\nCe chapitre détaille les étapes pratiques pour appliquer les théories étudiées. Nous passons en revue les protocoles et étapes logiques nécessaires à la mise en œuvre.\n\n#### Chapitre 3 : Analyse Critique & Évaluation\nNous portons un regard critique sur l'ensemble de la matière, en discutant les cas limites et l'efficacité des solutions apportées.`;
  }

  const quiz = [
    {
      question: `Quel est l'objectif principal du cours sur "${titre}" ?`,
      options: [
        `Comprendre les bases et concepts majeurs associés à ${uniqueWords[0] || 'ce sujet'}`,
        "Mémoriser par cœur l'ensemble du dictionnaire technique",
        "Passer un examen blanc sans étudier",
        "Ignorer les aspects méthodologiques et pratiques"
      ],
      correctOptionIndex: 0,
      explanation: `L'objectif central de cette leçon est d'acquérir une compréhension solide de la thématique "${titre}" et d'assimiler ses concepts fondamentaux.`
    },
    {
      question: `Quel concept clé est abordé sous le terme '${uniqueWords[1] || 'Fonctionnement'}' ?`,
      options: [
        "Un aspect secondaire négligeable",
        "Une méthodologie obsolète à éviter",
        `Un pilier théorique et pratique de l'apprentissage de ${titre}`,
        "Une simple définition sans valeur pratique"
      ],
      correctOptionIndex: 2,
      explanation: `Le terme '${uniqueWords[1] || 'Fonctionnement'}' fait référence à un pilier majeur décrit pour structurer les connaissances.`
    },
    {
      question: "La taxonomie de Bloom aide les étudiants à :",
      options: [
        "Prendre des notes plus rapidement",
        "Travailler à des niveaux cognitifs de complexité croissante",
        "Regarder des vidéos éducatives sans réfléchir",
        "Traduire automatiquement les cours en plusieurs langues"
      ],
      correctOptionIndex: 1,
      explanation: "La taxonomie de Bloom classe les objectifs d'apprentissage en niveaux de complexité croissante, de la mémorisation à la création."
    },
    {
      question: `Quelle limite est couramment soulevée à propos de la notion de '${uniqueWords[2] || 'Méthodologie'}' ?`,
      options: [
        "Elle ne demande aucun effort d'apprentissage",
        "Elle élimine toute contrainte technique",
        "Sa mise en œuvre peut dépendre fortement de la précision des données initiales",
        "Elle est strictement réservée aux enseignants"
      ],
      correctOptionIndex: 2,
      explanation: "L'application pratique dépend toujours de conditions limites et de données de départ précises pour être efficace."
    },
    {
      question: "Comment l'assistant NotebookLM d'EduPath vous guide-t-il ?",
      options: [
        "En écrivant les devoirs à votre place",
        "En répondant aux questions en se basant sur le document de cours fourni",
        "En vous bloquant l'accès au cours si vous échouez au quiz",
        "En créant des profils d'utilisateurs aléatoires"
      ],
      correctOptionIndex: 1,
      explanation: "L'assistant NotebookLM agit comme un tuteur intelligent centré sur le document de cours pour guider vos révisions."
    }
  ];

  return {
    summary: summaryText,
    mindmap: { nodes, links },
    flashcards,
    quiz
  };
}

/**
 * Moteur de recherche et QA par phrases en mode local
 */
function answerQuestionSimulated(titre, docText, question, lang = 'fr') {
  if (!docText || docText.trim().length === 0) {
    if (lang === 'en') {
      return `I don't have extracted text content for the course "${titre}" to analyze. Can you add some content to this course?`;
    } else if (lang === 'ar') {
      return `ليس لدي محتوى نصي مستخرج للمقرر "${titre}" لتحليله. هل يمكنك إضافة بعض المحتوى؟`;
    } else {
      return `Je n'ai pas de contenu textuel extrait pour le cours "${titre}" à analyser. Pouvez-vous y ajouter du cours ?`;
    }
  }

  const stopWords = new Set([
    'est', 'que', 'une', 'des', 'les', 'aux', 'pour', 'dans', 'avec', 
    'mais', 'par', 'sur', 'tout', 'tous', 'sont', 'cette', 'cet', 'ces',
    'dans', 'elle', 'elles', 'nous', 'vous', 'leur', 'leurs',
    'pour', 'avec', 'sans', 'sous', 'vers', 'chez', 'dans',
    'comme', 'alors', 'donc', 'mais', 'ainsi',
    'pourquoi', 'comment', 'quel', 'quels', 'quelle', 'quelles', 'qu', 'ce'
  ]);
  const qClean = question.toLowerCase().replace(/[?,!.;:()]/g, '');
  const keywords = qClean.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));

  if (keywords.length === 0) {
    if (lang === 'en') {
      return `[Local AI Assistant - Course "${titre}"]\n\nI'm here to answer questions about the course "${titre}". How can I help you?`;
    } else if (lang === 'ar') {
      return `[مساعد الذكاء الاصطناعي المحلي - مقرر "${titre}"]\n\nأنا هنا للإجابة على أسئلتك حول مقرر "${titre}". كيف يمكنني مساعدتك؟`;
    } else {
      return `[Assistant IA Local - Cours "${titre}"]\n\nJe suis là pour répondre à vos questions sur le cours "${titre}". Comment puis-je vous aider ?`;
    }
  }

  const rawSentences = docText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 15);

  const scored = rawSentences.map(s => {
    let score = 0;
    const sLower = s.toLowerCase();
    keywords.forEach(word => {
      if (sLower.includes(word)) {
        score += 1;
        if (new RegExp(`\\b${word}\\b`).test(sLower)) {
          score += 1.5;
        }
      }
    });
    return { sentence: s, score };
  });

  const matches = scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    const responseSentences = matches.slice(0, 3).map(item => item.sentence);
    if (lang === 'en') {
      return `[Local AI Assistant - Course "${titre}"]\n\nHere is the key information extracted from the course for your question:\n\n` + 
             responseSentences.map(s => `• ${s}.`).join('\n\n') + 
             `\n\n*(These details are extracted directly from the original course content)*`;
    } else if (lang === 'ar') {
      return `[مساعد الذكاء الاصطناعي المحلي - مقرر "${titre}"]\n\nإليك المعلومات الأساسية المستخرجة من المقرر لسؤالك:\n\n` + 
             responseSentences.map(s => `• ${s}.`).join('\n\n') + 
             `\n\n*(تم استخراج هذه التفاصيل مباشرة من محتوى المقرر الأصلي)*`;
    } else {
      return `[Assistant IA Local - Cours "${titre}"]\n\nVoici les informations clés extraites du cours pour votre question :\n\n` + 
             responseSentences.map(s => `• ${s}.`).join('\n\n') + 
             `\n\n*(Ces précisions sont extraites directement du cours d'origine)*`;
    }
  }

  if (lang === 'en') {
    return `[Local AI Assistant - Course "${titre}"]\n\nI couldn't find an exact sentence matching your question in the document.\n\nHowever, the lesson deals with "${titre}" and addresses various fundamental concepts. Feel free to rephrase your question.`;
  } else if (lang === 'ar') {
    return `[مساعد الذكاء الاصطناعي المحلي - مقرر "${titre}"]\n\nلم أتمكن من العثور على جملة مطابقة تماماً لسؤالك في المستند.\n\nومع ذلك، يتناول الدرس "${titre}" ويتطرق إلى مفاهيم أساسية مختلفة. لا تتردد في إعادة صياغة سؤالك بكلمات أخرى.`;
  } else {
    return `[Assistant IA Local - Cours "${titre}"]\n\nJe n'ai pas trouvé de phrase exacte concernant votre question dans le document.\n\nToutefois, la leçon traite de "${titre}" et aborde différents concepts fondamentaux. N'hésitez pas à reformuler votre question avec d'autres mots.`;
  }
}

/**
 * NotebookLM-style interactive chatbot context responder
 */
export async function answerQuestionAboutDocument(titre, docText, question, history = [], lang = 'fr') {
  if (ai) {
    try {
      const langName = lang === 'en' ? 'English' : lang === 'ar' ? 'Arabic' : 'French';
      
      const systemInstruction = `
Tu es un assistant IA pédagogique de type NotebookLM intégré à la plateforme EduPath.
Tu dois répondre aux questions de l'étudiant à partir du contenu du cours ci-dessous intitulé "${titre}".
Sois précis, constructif, pédagogique et sers-toi uniquement des faits mentionnés dans le document.
Si la réponse ne figure pas dans le document, utilise tes connaissances pour y répondre en précisant poliment que cette information n'est pas directement dans le texte du cours.
Reste toujours poli et réponds obligatoirement en langue ${langName}.

Contenu du cours :
${docText || 'Aucun texte extrait disponible.'}
      `;

      const model = ai.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction
      });

      // Build chat contents format for Gemini API
      const contents = [];
      
      // Map user history into Gemini roles
      history.forEach(msg => {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });

      // Add the new question
      contents.push({
        role: 'user',
        parts: [{ text: question }]
      });

      const result = await model.generateContent({
        contents
      });

      return result.response.text();
    } catch (error) {
      console.error("Erreur de chat avec Gemini. Utilisation du fallback simulé :", error);
      return answerQuestionSimulated(titre, docText, question, lang);
    }
  } else {
    // Smart simulator response
    return answerQuestionSimulated(titre, docText, question, lang);
  }
}

/**
 * Génère le script d'un podcast éducatif avec deux hôtes : Sophie et Marc.
 * @param {string} titre Titre du cours
 * @param {string} texte Contenu textuel
 * @returns {Promise<Array<{speaker: string, text: string}>>}
 */
export async function generatePodcastScript(titre, texte) {
  if (ai) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `
Tu es un concepteur de podcasts éducatifs. Génère un script de discussion passionnant, vivant et interactif entre deux hôtes, **Sophie** (experte et pédagogue, ton posé et bienveillant) et **Marc** (étudiant curieux, ton dynamique et enthousiaste), au sujet du cours intitulé "${titre}".

Ils doivent résumer et débattre des points clés du cours ci-dessous de manière simple, claire et vivante. Ils doivent utiliser des analogies, poser des questions et donner l'impression de faire une émission audio de type "NotebookLM Audio Overview". Le dialogue doit faire entre 10 et 15 répliques au total.
Reste strictement en langue française.

Le format de sortie DOIT être un JSON valide contenant uniquement un tableau d'objets structurés de la façon suivante :
[
  { "speaker": "Sophie", "text": "Bienvenue dans ce podcast ! Aujourd'hui nous allons explorer..." },
  { "speaker": "Marc", "text": "Salut Sophie ! Je suis super content de parler de ce sujet..." }
]

Texte du cours :
${texte.substring(0, 20000)}
`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });
      const responseText = result.response.text();
      try {
        return JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Format JSON invalide : " + responseText);
      }
    } catch (error) {
      console.error("Erreur de génération du podcast par Gemini, fallback simulé :", error);
      return generateSimulatedPodcast(titre, texte);
    }
  } else {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return generateSimulatedPodcast(titre, texte);
  }
}

function generateSimulatedPodcast(titre, texte) {
  // Extract clean sentences from the text
  let sentences = [];
  if (texte && texte.trim().length > 10) {
    sentences = texte
      .split(/[.!?\n]+/)
      .map(s => s.trim().replace(/\s+/g, ' '))
      .filter(s => s.length > 25 && s.length < 180 && !s.includes('Transcription simulée'));
  }

  // Fallbacks if no sentences extracted
  if (sentences.length === 0) {
    sentences = [
      `Le sujet principal concerne ${titre}, ce qui représente une compétence essentielle à acquérir.`,
      `Il est important de comprendre la théorie et de la mettre en œuvre activement.`,
      `Le cours aborde les notions de base et les architectures fondamentales du sujet.`,
      `Nous devons passer d'une simple compréhension théorique à une application pratique concrète.`,
      `L'évaluation des acquis et les tests réguliers permettent de consolider ces connaissances.`
    ];
  }

  // Get distinct sentences to avoid duplication
  const uniqueSentences = [...new Set(sentences)].slice(0, 6);
  
  // Make sure we have enough sentences
  while (uniqueSentences.length < 6) {
    uniqueSentences.push(`Nous étudions en profondeur le concept de ${titre}.`);
  }

  return [
    { 
      speaker: "Sophie", 
      text: `Bonjour et bienvenue dans notre studio d'apprentissage ! Aujourd'hui, nous explorons ensemble le cours intitulé "${titre}". C'est un sujet vraiment captivant, Marc.` 
    },
    { 
      speaker: "Marc", 
      text: `Salut Sophie, bonjour à tous ! Oui, j'ai commencé à le lire et c'est passionnant. J'ai noté que : ${uniqueSentences[0]}` 
    },
    { 
      speaker: "Sophie", 
      text: `Tout à fait Marc ! Et ce qui est intéressant, c'est que le cours précise aussi : ${uniqueSentences[1]} Cela montre bien la profondeur du sujet.` 
    },
    { 
      speaker: "Marc", 
      text: `Ah je vois ! C'est logique. Et concernant le point où il est écrit que ${uniqueSentences[2]}, qu'en penses-tu ?` 
    },
    { 
      speaker: "Sophie", 
      text: `C'est une excellente question. En fait, cela est directement lié au fait que : ${uniqueSentences[3]} C'est la base de toute la méthodologie présentée ici.` 
    },
    { 
      speaker: "Marc", 
      text: `D'accord, je comprends mieux l'articulation. Le cours insiste également sur un autre point clé : ${uniqueSentences[4]}` 
    },
    { 
      speaker: "Sophie", 
      text: `Exactement. Et pour aller plus loin, garde en tête que : ${uniqueSentences[5]} C'est l'essence même de l'apprentissage sur EduPath.` 
    },
    { 
      speaker: "Marc", 
      text: `Génial ! Merci Sophie pour ces éclaircissements super utiles. J'espère que ça aidera tout le monde pour les révisions.` 
    },
    { 
      speaker: "Sophie", 
      text: `Avec plaisir Marc ! Bonnes révisions à tous et à bientôt dans le studio !` 
    }
  ];
}

/**
 * Traduit le contenu d'un type d'asset (summary, mindmap, flashcards, quiz, podcast) dans la langue cible
 */
export async function translateContent(assetType, data, targetLang) {
  if (!data) return data;
  if (targetLang === 'fr') return data; // Déjà en français

  const langName = targetLang === 'en' ? 'English' : targetLang === 'ar' ? 'Arabic' : 'French';
  
  if (ai) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      let prompt = '';
      let isJson = true;

      if (assetType === 'summary') {
        isJson = false;
        prompt = `Translate the following educational summary markdown content into ${langName}. 
Preserve all markdown formatting, headers (like #, ##, ###), bullet points, and bold tags. 
Translate all French text to ${langName} accurately.
Return ONLY the translated markdown text. Do not add any conversational text or wrapper blocks.

Content:
${data}`;
      } else if (assetType === 'mindmap') {
        prompt = `You are a professional EdTech translation tool. Translate the fields 'label' and 'description' of each node in the following JSON mindmap nodes array into ${langName}. Keep 'id' and 'type' unchanged. Return a valid JSON array matching the exact structure. Do not add any conversational text.

Input JSON:
${JSON.stringify(data)}`;
      } else if (assetType === 'flashcards') {
        prompt = `You are a professional translation tool. Translate the fields 'question', 'reponse', and 'niveauBloom' (translate levels like Mémorisation to Remembering/التذكر, Compréhension to Understanding/الفهم, Application to Applying/التطبيق, Analyse to Analyzing/التحليل, Évaluation to Evaluating/التقييم, Création to Creating/الابتكار) of each flashcard in the following JSON array into ${langName}. Return a valid JSON array matching the exact structure.

Input JSON:
${JSON.stringify(data)}`;
      } else if (assetType === 'quiz') {
        prompt = `You are a professional translation tool. Translate the fields 'question', 'options' (the array of multiple choice options), and 'explanation' of each question in the following quiz JSON array into ${langName}. Keep 'correctOptionIndex' exactly the same. Return a valid JSON array matching the exact structure.

Input JSON:
${JSON.stringify(data)}`;
      } else if (assetType === 'podcast') {
        prompt = `You are a professional translation tool. Translate the 'text' field of each dialogue turn in the following podcast JSON script array into ${langName}. Keep 'speaker' unchanged. Return a valid JSON array matching the exact structure.

Input JSON:
${JSON.stringify(data)}`;
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: isJson ? { responseMimeType: 'application/json' } : undefined
      });

      const responseText = result.response.text();
      if (!isJson) {
        return responseText.trim();
      } else {
        try {
          return JSON.parse(responseText);
        } catch (parseError) {
          const jsonMatch = responseText.match(/(\[|\{)[\s\S]*(\]|\})/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          throw parseError;
        }
      }
    } catch (err) {
      console.error(`[TRANSLATE ERROR] Échec de la traduction IA de ${assetType} vers ${targetLang}:`, err);
      return getSimulatedTranslation(assetType, data, targetLang);
    }
  } else {
    return getSimulatedTranslation(assetType, data, targetLang);
  }
}

function getSimulatedTranslation(assetType, data, targetLang) {
  console.log(`[SIMULATED TRANSLATION] Traduction simulée de ${assetType} vers ${targetLang}`);
  const prefix = targetLang === 'en' ? '[EN] ' : '[AR] ';
  
  if (assetType === 'summary') {
    return `${prefix}Translated Summary:\n\n${data.replace(/###/g, '### ' + prefix).replace(/##/g, '## ' + prefix)}`;
  } else if (assetType === 'mindmap') {
    return {
      nodes: data.nodes ? data.nodes.map(n => ({ ...n, label: prefix + n.label, description: prefix + n.description })) : [],
      links: data.links || []
    };
  } else if (assetType === 'flashcards') {
    return data.map(f => ({ ...f, question: prefix + f.question, reponse: prefix + f.reponse, niveauBloom: prefix + f.niveauBloom }));
  } else if (assetType === 'quiz') {
    return data.map(q => ({ ...q, question: prefix + q.question, options: q.options.map(o => prefix + o), explanation: prefix + q.explanation }));
  } else if (assetType === 'podcast') {
    return data.map(p => ({ ...p, text: prefix + p.text }));
  }
  return data;
}

/**
 * Génère la structure de présentation PowerPoint (titres, puces, notes orateur) à partir du cours.
 * @param {string} titre Titre du cours
 * @param {string} texte Contenu du cours
 * @returns {Promise<Array<{title: string, bulletPoints: string[], speakerNotes: string}>>}
 */
export async function generatePowerPointSlides(titre, texte) {
  if (ai) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `
Tu es un concepteur pédagogique de présentations PowerPoint.
Analyse le texte du cours ci-dessous intitulé "${titre}".
Génère une structure de présentation claire et structurée de 5 à 7 diapositives (slides) pour enseigner ce cours.

Chaque diapositive doit comporter :
- Un titre court (champ "title")
- 3 à 5 puces explicatives courtes et précises résumant un aspect du cours (champ "bulletPoints", un tableau de chaînes de caractères)
- Optionnellement, une note de l'orateur expliquant la diapositive en détail (champ "speakerNotes")

Le format de sortie DOIT être un JSON valide contenant uniquement un tableau d'objets structurés de la façon suivante :
[
  {
    "title": "Introduction à...",
    "bulletPoints": [
      "Concept A : définition courte.",
      "Concept B : enjeu principal.",
      "Règle de base."
    ],
    "speakerNotes": "Bonjour à tous, aujourd'hui nous allons aborder..."
  }
]

Reste strictement en langue française (ou dans la langue principale du cours si spécifié).

Texte du cours :
${texte.substring(0, 20000)}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = result.response.text();
      try {
        return JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Format JSON de présentation invalide : " + responseText);
      }
    } catch (error) {
      console.error("Erreur lors de la génération IA de la présentation, passage au simulateur...", error);
      return generateSimulatedPowerPoint(titre, texte);
    }
  } else {
    return generateSimulatedPowerPoint(titre, texte);
  }
}

export function generateSimulatedPowerPoint(titre, texte) {
  let sentences = [];
  if (texte && texte.trim().length > 10) {
    sentences = texte
      .split(/[.!?\n]+/)
      .map(s => s.trim().replace(/\s+/g, ' '))
      .filter(s => s.length > 25 && s.length < 180 && !s.includes('Transcription simulée'));
  }

  // Fallbacks if no sentences extracted
  if (sentences.length === 0) {
    sentences = [
      `Le sujet principal concerne ${titre}, ce qui représente une compétence essentielle à acquérir.`,
      `Il est important de comprendre la théorie et de la mettre en œuvre activement.`,
      `Le cours aborde les notions de base et les architectures fondamentales du sujet.`,
      `Nous devons passer d'une simple compréhension théorique à une application pratique concrète.`,
      `L'évaluation des acquis et les tests réguliers permettent de consolider ces connaissances.`
    ];
  }

  const uniqueSentences = [...new Set(sentences)].slice(0, 8);
  while (uniqueSentences.length < 6) {
    uniqueSentences.push(`Nous étudions en profondeur le concept de ${titre}.`);
  }

  return [
    {
      title: `Introduction à ${titre}`,
      bulletPoints: [
        `Vue d'ensemble de la thématique.`,
        uniqueSentences[0],
        `Importance de ce domaine dans le développement professionnel.`
      ],
      speakerNotes: `Bienvenue à cette présentation de cours sur ${titre}. Nous allons voir ensemble les fondamentaux et comment les appliquer.`
    },
    {
      title: "Principes Théoriques Fondamentaux",
      bulletPoints: [
        uniqueSentences[1],
        uniqueSentences[2] || "Concepts de base à maîtriser.",
        `Règles de fonctionnement essentielles.`
      ],
      speakerNotes: `Cette diapositive aborde les concepts théoriques clés évoqués dans le document de cours. Il est essentiel de bien les comprendre avant de passer à la pratique.`
    },
    {
      title: "Méthodologie & Processus",
      bulletPoints: [
        uniqueSentences[3] || "Étapes de mise en oeuvre.",
        uniqueSentences[4] || "Protocoles à respecter.",
        `Analyse des facteurs de réussite.`
      ],
      speakerNotes: `Nous passons ici à la partie méthodologique. Les processus décrits dans le cours permettent de structurer le travail pas à pas.`
    },
    {
      title: "Applications Pratiques & Exemples",
      bulletPoints: [
        uniqueSentences[5] || "Cas d'usage concret.",
        `Erreurs courantes à éviter lors de la mise en œuvre.`,
        `Meilleures pratiques recommandées par les experts.`
      ],
      speakerNotes: `Cette partie s'intéresse à l'application active des théories étudiées dans des scénarios ou projets réels.`
    },
    {
      title: "Conclusion & Synthèse",
      bulletPoints: [
        `Résumé des points essentiels à retenir.`,
        `Prochaines étapes d'approfondissement du sujet.`,
        `Méthodes d'évaluation pour valider ses connaissances.`
      ],
      speakerNotes: `Pour conclure, rappelez-vous que la maîtrise de ce sujet demande de la pratique régulière. Je vous encourage à faire le quiz et à réviser avec les flashcards.`
    }
  ];
}

