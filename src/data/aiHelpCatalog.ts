import { AgentCommandType } from '../types';

export interface AiCommandHelpItem {
  command: string;
  description: string;
  mode?: 'all' | 'web' | 'desktop';
   canRunDirectly?: boolean;
}

export interface AiPromptExample {
  title: string;
  prompt: string;
}

export interface AiGuideEntry {
  id: AgentCommandType;
  name: string;
  tagline: string;
  beginnerSummary: string;
  bestFor: string[];
  difficulty: 'Très Facile' | 'Facile' | 'Intermédiaire';
  costSummary: string;
  webSetupSteps: string[];
  desktopSetupSteps: string[];
  freeKeyUrl?: string;
  freeKeyLabel?: string;
  commands: AiCommandHelpItem[];
  starterPrompts: AiPromptExample[];
  troubleshooting: string[];
}

export const COMMON_WEB_COMMANDS: AiCommandHelpItem[] = [
  {
    command: '/help',
    description: 'Affiche la liste des commandes rapides disponibles dans ce terminal.',
    mode: 'web',
    canRunDirectly: true,
  },
  {
    command: '/keys',
    description: 'Ouvre la fenêtre pour coller ou modifier tes clés API en toute sécurité.',
    mode: 'web',
    canRunDirectly: true,
  },
  {
    command: '/key VOTRE_CLE_API',
    description: 'Enregistre directement une clé API depuis le terminal (ex: /key AIzaSy...).',
    mode: 'web',
    canRunDirectly: false,
  },
  {
    command: '/clear',
    description: 'Efface tout le texte de la console pour repartir sur un écran propre.',
    mode: 'all',
    canRunDirectly: true,
  },
];

export const AI_HELP_CATALOG: Record<AgentCommandType, AiGuideEntry> = {
  agy: {
    id: 'agy',
    name: 'Antigravity (Argon 4)',
    tagline: 'L’agent de code ultra-puissant de Google DeepMind',
    beginnerSummary:
      'Antigravity est un assistant IA conçu pour coder, réfléchir en profondeur et résoudre des problèmes complexes. Tu peux même choisir sa puissance (Argon 4 Low, Medium, High ou Claude Sonnet/Opus).',
    bestFor: [
      'Créer des projets complets de A à Z',
      'Résoudre des bugs difficiles',
      'Comparer plusieurs niveaux de raisonnement',
    ],
    difficulty: 'Facile',
    costSummary: 'Inclus dans l’abonnement Antigravity (PC) ou utilisable gratuitement sur le Web avec une clé Google Gemini / OpenRouter.',
    freeKeyUrl: 'https://aistudio.google.com/app/apikey',
    freeKeyLabel: 'Obtenir une clé Google AI Studio gratuite',
    webSetupSteps: [
      'Sur la version Web (Cloudflare), clique sur "🔑 Clés API" en haut à droite.',
      'Colle une clé gratuite Google Gemini (AIzaSy...) ou une clé OpenRouter (sk-or-...).',
      'Clique sur "Start agy" dans la console et écris ta question en français !',
    ],
    desktopSetupSteps: [
      'Sur l’application PC (Electron), assure-toi que la commande `agy` est installée.',
      'Choisis le sous-modèle (Argon 4 Medium est recommandé) puis clique sur "Start agy".',
    ],
    commands: [
      {
        command: '/help',
        description: 'Voir toutes les commandes disponibles dans Antigravity.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/plan',
        description: 'Demande à l’IA de préparer un plan étape par étape avant de coder.',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/compact',
        description: 'Résume la conversation pour libérer de la mémoire (économise les tokens).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Nettoie l’écran du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '🎯 Expliquer simplement',
        prompt: 'Explique-moi comment fonctionne une API web comme si j’avais 12 ans, avec un exemple concret.',
      },
      {
        title: '🎮 Créer un mini-jeu',
        prompt: 'Crée le code complet d’un jeu Pong en un seul fichier HTML/JS moderne que je peux ouvrir dans mon navigateur.',
      },
      {
        title: '🚀 Plan d’application',
        prompt: 'Propose-moi une architecture simple et gratuite pour créer un site web avec mes potes.',
      },
    ],
    troubleshooting: [
      'Si tu vois "Clé API requise" sur le site Web : clique sur "🔑 Clés API" en haut et mets une clé Google Gemini (gratuite sur Google AI Studio).',
      'Si la réponse est longue : tu peux appuyer sur Ctrl + C dans le terminal pour l’arrêter à tout moment.',
    ],
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini CLI (Google)',
    tagline: 'L’IA de Google avec un gros quota gratuit chaque jour',
    beginnerSummary:
      'C’est le meilleur choix pour débuter gratuitement sur le Web ! Google offre une clé API gratuite (via Google AI Studio) et jusqu’à 1 000 requêtes gratuites par jour avec Gemini CLI.',
    bestFor: [
      'Débuter sans rien payer (0 €)',
      'Poser des questions longues (grande mémoire)',
      'Analyser du texte, du code ou des idées',
    ],
    difficulty: 'Très Facile',
    costSummary: '100 % Gratuit avec un simple compte Google (Google AI Studio ou connexion Google).',
    freeKeyUrl: 'https://aistudio.google.com/app/apikey',
    freeKeyLabel: 'Créer ma clé Gemini Gratuite (30 sec)',
    webSetupSteps: [
      'Va sur aistudio.google.com/app/apikey avec ton compte Google.',
      'Clique sur "Create API Key" et copie la clé qui commence par `AIza...`.',
      'Dans Agent Canvas, clique sur "🔑 Clés API" en haut, colle-la dans "Google Gemini" et clique sur Enregistrer !',
    ],
    desktopSetupSteps: [
      'Installe Gemini CLI sur ton PC avec : `npm install -g @google/gemini-cli`',
      'Lance la console et choisis "Login with Google" pour profiter des 1 000 requêtes/jour gratuites.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche l’aide et les raccourcis de Gemini.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/keys',
        description: 'Ouvre la fenêtre pour coller ta clé Google Gemini gratuite.',
        mode: 'web',
        canRunDirectly: true,
      },
      {
        command: '/stats',
        description: 'Affiche ta consommation de tokens sur la session (Mode PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface la conversation affichée à l’écran.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '💡 Trouver des idées',
        prompt: 'Donne-moi 5 idées de projets faciles et stylés à faire ce week-end, même si je débute.',
      },
      {
        title: '📝 Corriger un texte / mail',
        prompt: 'Aide-moi à rédiger un message clair et pro pour présenter mon projet.',
      },
      {
        title: '💻 Apprendre à coder',
        prompt: 'Montre-moi les bases du HTML, CSS et JavaScript en 5 minutes avec des exemples.',
      },
    ],
    troubleshooting: [
      'Ta clé commence bien par "AIza" ? Colle-la dans la case "Google Gemini" de la fenêtre Clés API.',
    ],
  },

  claude: {
    id: 'claude',
    name: 'Claude Code (Anthropic)',
    tagline: 'La référence mondiale pour écrire du code propre et sans bug',
    beginnerSummary:
      'Claude est adoré par les développeurs car il explique très bien ce qu’il fait et produit un code super soigné. Nécessite soit une clé Anthropic/OpenRouter (sur le Web), soit un abonnement Claude Pro (sur PC).',
    bestFor: [
      'Coder des interfaces modernes et propres',
      'Débugger un programme qui plante',
      'Rédiger des explications très naturelles',
    ],
    difficulty: 'Facile',
    costSummary: 'Payant (Abonnement Claude Pro/Max sur PC, ou clé API Anthropic / OpenRouter sur le Web).',
    freeKeyUrl: 'https://openrouter.ai/keys',
    freeKeyLabel: 'Obtenir une clé OpenRouter',
    webSetupSteps: [
      'Clique sur "🔑 Clés API" en haut à droite.',
      'Colle soit une clé Anthropic (`sk-ant-...`), soit une clé universelle OpenRouter (`sk-or-...`).',
      'Clique sur "Start claude" pour démarrer la console.',
    ],
    desktopSetupSteps: [
      'Installe Claude Code sur ton PC : `npm install -g @anthropic-ai/claude-code`',
      'Lance la console et connecte ton compte Claude Pro/Max avec `/login`.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Liste toutes les commandes de Claude Code.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/compact',
        description: 'Compresse l’historique pour économiser ton quota de 5 heures (PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/cost',
        description: 'Affiche le coût ou les tokens utilisés pendant la session (PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/init',
        description: 'Analyse ton dossier de projet et crée un fichier guide CLAUDE.md (PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Remet la conversation à zéro.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '🎨 Créer un site moderne',
        prompt: 'Crée une belle page d’accueil moderne en HTML + Tailwind CSS avec un thème sombre.',
      },
      {
        title: '🔍 Vérifier mon code',
        prompt: 'Quelles sont les erreurs les plus fréquentes quand on débute en JavaScript et comment les éviter ?',
      },
    ],
    troubleshooting: [
      'Pas d’abonnement Claude ? Utilise plutôt Gemini CLI (gratuit avec compte Google) ou Ollama (gratuit sur PC) !',
    ],
  },

  codex: {
    id: 'codex',
    name: 'Codex CLI (OpenAI / ChatGPT)',
    tagline: 'L’agent officiel d’OpenAI (les créateurs de ChatGPT)',
    beginnerSummary:
      'C’est la version terminal de ChatGPT spécialisée pour l’informatique et la programmation. Très rapide et polyvalent.',
    bestFor: [
      'Générer des scripts rapides',
      'Poser toutes les questions que tu poserais à ChatGPT',
      'Travailler en binôme avec Claude ou Gemini dans une Équipe',
    ],
    difficulty: 'Facile',
    costSummary: 'Payant (Abonnement ChatGPT Plus/Pro sur PC, ou clé API OpenAI / OpenRouter sur le Web).',
    freeKeyUrl: 'https://platform.openai.com/api-keys',
    freeKeyLabel: 'Gérer mes clés OpenAI',
    webSetupSteps: [
      'Clique sur "🔑 Clés API" en haut à droite.',
      'Colle ta clé OpenAI (`sk-proj-...`) ou une clé universelle OpenRouter (`sk-or-...`).',
      'Lance la console avec le bouton "Start codex".',
    ],
    desktopSetupSteps: [
      'Installe Codex CLI : `npm install -g @openai/codex`',
      'Connecte ton compte ChatGPT Plus ou ta clé OpenAI au premier lancement.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche les commandes disponibles dans Codex.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/model',
        description: 'Permet de changer le modèle OpenAI utilisé (Mode PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface l’écran du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '⚡ Script d’automatisation',
        prompt: 'Écris un petit script Python simple qui trie automatiquement les fichiers de mon dossier Téléchargements.',
      },
      {
        title: '🧠 Résumé express',
        prompt: 'Explique-moi la différence entre le Frontend et le Backend dans un site web avec une analogie de restaurant.',
      },
    ],
    troubleshooting: [
      'Attention : un abonnement ChatGPT Plus sur chatgpt.com ne donne pas toujours de crédits API web automatiques. Si tu n’as pas de clé API OpenAI, utilise une clé Google Gemini gratuite ou OpenRouter !',
    ],
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (Qwen2.5 Local)',
    tagline: '100 % Gratuit · Tourne sur ton propre PC (ou via OpenRouter)',
    beginnerSummary:
      'Ollama fait tourner une vraie IA directement sur ton ordinateur, sans rien envoyer sur Internet, sans abonnement et sans limite ! Et si tu n’as pas installé Ollama sur ton PC, tu peux aussi l’utiliser sur le Web avec une clé OpenRouter gratuite.',
    bestFor: [
      'Utiliser une IA 100 % gratuite et illimitée',
      'Coder ou discuter en privé sur son PC',
      'Apprendre sans jamais payer un centime',
    ],
    difficulty: 'Très Facile',
    costSummary: '100 % GRATUIT (0 €) — Aucun abonnement ni carte bancaire.',
    freeKeyUrl: 'https://ollama.com/download',
    freeKeyLabel: 'Télécharger Ollama gratuitement pour Windows/Mac',
    webSetupSteps: [
      'Option A (Sans rien installer sur ton PC) : Clique sur "🔑 Clés API" et mets une clé OpenRouter (`sk-or-...`) — Agent Canvas utilisera le modèle Qwen2.5 gratuitement dans le cloud !',
      'Option B (Avec Ollama installé sur ton PC) : Lance Ollama sur ton PC, ou utilise l’application Agent Canvas sur PC.',
    ],
    desktopSetupSteps: [
      '1. Télécharge et installe Ollama sur ollama.com (ou tape `winget install Ollama.Ollama` dans System Shell).',
      '2. Clique sur "Start ollama" : il téléchargera et lancera automatiquement le modèle `qwen2.5-coder` !',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche l’aide du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/bye',
        description: 'Quitte la session Ollama proprement (Mode PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface l’écran du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '👋 Test rapide',
        prompt: 'Salut ! Présente-toi en 3 lignes et dis-moi ce que tu sais faire.',
      },
      {
        title: '💻 Générer une page HTML',
        prompt: 'Crée une calculatrice moderne et stylée en HTML/CSS/JS dans un seul bloc de code.',
      },
    ],
    troubleshooting: [
      'Si tu vois "Impossible de joindre Ollama" sur le site Web : c’est normal si Ollama n’est pas installé sur ton PC ! Soit installe Ollama sur ton PC, soit colle une clé gratuite dans "🔑 Clés API".',
    ],
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek R1 (Raisonnement)',
    tagline: 'Le champion gratuit des maths, de la logique et du raisonnement',
    beginnerSummary:
      'DeepSeek R1 est une IA spécialisée dans la réflexion étape par étape : avant de répondre, elle "réfléchit" pour éviter les pièges. 100 % gratuit en local via Ollama ou accessible sur le Web via OpenRouter.',
    bestFor: [
      'Résoudre des problèmes de logique, maths ou algorithmes',
      'Trouver pourquoi un code compliqué ne marche pas',
      'Avoir une IA gratuite ultra-intelligente',
    ],
    difficulty: 'Très Facile',
    costSummary: '100 % GRATUIT (0 €) via Ollama sur PC ou via OpenRouter Free sur le Web.',
    freeKeyUrl: 'https://openrouter.ai/keys',
    freeKeyLabel: 'Créer une clé OpenRouter gratuite',
    webSetupSteps: [
      'Clique sur "🔑 Clés API" en haut et colle une clé OpenRouter (`sk-or-...`), ou lance Ollama sur ton PC.',
      'Clique sur "Start deepseek" et pose-lui une énigme ou un problème technique !',
    ],
    desktopSetupSteps: [
      'Assure-toi d’avoir installé Ollama (`ollama.com`).',
      'Clique sur "Start deepseek" : cela exécute `ollama run deepseek-r1` directement sur ton PC.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche les commandes disponibles.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface le terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '🧩 Défi logique',
        prompt: 'Résous cette énigme étape par étape : J’ai 2 sabliers, un de 4 minutes et un de 7 minutes. Comment mesurer exactement 9 minutes ?',
      },
      {
        title: '🛠️ Optimisation',
        prompt: 'Explique-moi comment fonctionne un algorithme de recherche rapide avec un exemple très simple.',
      },
    ],
    troubleshooting: [
      'Sur un PC portable sans grosse carte graphique, DeepSeek R1 local peut mettre quelques secondes à démarrer : c’est tout à fait normal !',
    ],
  },

  qwen: {
    id: 'qwen',
    name: 'Qwen3 Coder CLI',
    tagline: 'L’IA d’Alibaba ultra-forte en programmation',
    beginnerSummary:
      'Qwen Coder est l’un des meilleurs modèles open-source au monde pour le code. Il fonctionne sur le Web avec une clé OpenRouter ou DashScope, et sur PC avec Qwen CLI.',
    bestFor: [
      'Écrire du code React, Python, HTML, C++',
      'Travailler en équipe avec Claude ou DeepSeek',
    ],
    difficulty: 'Facile',
    costSummary: 'Gratuit via OpenRouter (modèles free) ou clé API DashScope.',
    freeKeyUrl: 'https://openrouter.ai/keys',
    freeKeyLabel: 'Obtenir une clé OpenRouter',
    webSetupSteps: [
      'Clique sur "🔑 Clés API" en haut à droite.',
      'Colle une clé OpenRouter (`sk-or-...`) ou une clé Qwen DashScope.',
      'Clique sur "Start qwen" !',
    ],
    desktopSetupSteps: [
      'Installe Qwen Code CLI : `npm install -g @qwen-code/qwen-code`',
      'Configure ta clé API ou branche-le sur ton Ollama local.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche l’aide de Qwen Code.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Nettoie la console.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '⚡ Créer un composant web',
        prompt: 'Crée une carte de profil animée en HTML et CSS moderne.',
      },
    ],
    troubleshooting: [
      'Le plus simple pour utiliser Qwen sur le Web est de mettre une clé OpenRouter dans "🔑 Clés API".',
    ],
  },

  kimi: {
    id: 'kimi',
    name: 'Kimi K2 CLI (Moonshot)',
    tagline: 'L’IA spécialisée dans les très longs documents et le code',
    beginnerSummary:
      'Kimi K2 est célèbre pour sa capacité à retenir d’énormes quantités d’informations d’un seul coup sans perdre le fil.',
    bestFor: [
      'Résumer de très longs textes ou fichiers',
      'Avoir un 3e avis indépendant dans une équipe d’IA',
    ],
    difficulty: 'Facile',
    costSummary: 'Clé API Moonshot AI ou clé universelle OpenRouter.',
    freeKeyUrl: 'https://openrouter.ai/keys',
    freeKeyLabel: 'Utiliser via OpenRouter',
    webSetupSteps: [
      'Clique sur "🔑 Clés API" et colle une clé OpenRouter (`sk-or-...`) ou Moonshot (`sk-...`).',
      'Clique sur "Start kimi".',
    ],
    desktopSetupSteps: [
      'Configure Kimi CLI ou utilise la version Web avec OpenRouter.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche l’aide du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface l’écran.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '📚 Synthèse claire',
        prompt: 'Fais-moi une fiche de révision ultra-claire en 5 points sur le fonctionnement d’Internet.',
      },
    ],
    troubleshooting: [
      'Astuce : une seule clé OpenRouter débloque Kimi K2, Qwen, DeepSeek, Claude et Gemini d’un coup !',
    ],
  },

  aider: {
    id: 'aider',
    name: 'Aider Pair AI',
    tagline: 'Le compagnon de programmation en binôme dans le terminal',
    beginnerSummary:
      'Aider est un outil open-source qui modifie directement tes fichiers de code et crée des sauvegardes Git automatiques.',
    bestFor: [
      'Modifier plusieurs fichiers d’un projet existant (Mode PC)',
      'Générer du code structuré',
    ],
    difficulty: 'Intermédiaire',
    costSummary: 'Outil 100 % gratuit (coût 0 € avec Ollama ou Gemini gratuit).',
    freeKeyUrl: 'https://aider.chat',
    freeKeyLabel: 'Site officiel Aider',
    webSetupSteps: [
      'En mode Web, fonctionne avec ta clé OpenRouter, Gemini, Anthropic ou OpenAI configurée dans "🔑 Clés API".',
    ],
    desktopSetupSteps: [
      'Installe Aider sur ton PC : `pip install aider-chat`',
      'Pour l’utiliser gratuitement avec Ollama : `aider --model ollama/qwen2.5-coder`',
    ],
    commands: [
      {
        command: '/help',
        description: 'Liste les commandes d’Aider.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/add',
        description: 'Ajoute un fichier au contexte d’Aider (Mode PC : /add fichier.js).',
        mode: 'desktop',
        canRunDirectly: false,
      },
      {
        command: '/undo',
        description: 'Annule la dernière modification faite par Aider (Mode PC).',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Vide l’historique de chat.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '🔧 Refactoriser du code',
        prompt: 'Montre-moi comment structurer proprement un projet web débutant (dossiers et fichiers).',
      },
    ],
    troubleshooting: [
      'Si tu débutes complètement, commence plutôt par Gemini CLI, Ollama ou Antigravity qui sont plus simples !',
    ],
  },

  opencode: {
    id: 'opencode',
    name: 'OpenCode CLI',
    tagline: 'L’agent de terminal open-source multi-modèles',
    beginnerSummary:
      'OpenCode est une interface de terminal moderne et open-source qui permet de brancher n’importe quel modèle IA (gratuit ou payant).',
    bestFor: [
      'Tester différents fournisseurs d’IA',
      'Avoir un agent léger et rapide',
    ],
    difficulty: 'Facile',
    costSummary: 'Gratuit avec une clé Gemini/OpenRouter gratuite ou Ollama.',
    freeKeyUrl: 'https://aistudio.google.com/app/apikey',
    freeKeyLabel: 'Clé Gemini Gratuite',
    webSetupSteps: [
      'Configure une clé dans "🔑 Clés API" (Gemini ou OpenRouter) puis clique sur "Start opencode".',
    ],
    desktopSetupSteps: [
      'Installe OpenCode sur PC : `npm i -g opencode-ai`',
    ],
    commands: [
      {
        command: '/help',
        description: 'Affiche l’aide.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface le terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '⚡ Question rapide',
        prompt: 'Donne-moi les 10 raccourcis clavier Windows les plus utiles à connaître absolument.',
      },
    ],
    troubleshooting: [
      'Configure simplement une clé Google Gemini ou OpenRouter dans "🔑 Clés API" pour l’utiliser sur le Web.',
    ],
  },

  shell: {
    id: 'shell',
    name: 'System Shell (PowerShell)',
    tagline: 'Le vrai terminal Windows de ton PC (ou assistant commandes sur le Web)',
    beginnerSummary:
      'En mode PC (Electron), cela ouvre un vrai terminal PowerShell pour lancer ton serveur, installer des outils ou utiliser Git. En mode Web, il t’aide à trouver les bonnes commandes Windows/Linux/Git.',
    bestFor: [
      'Lancer `npm run dev` ou `git status` (Mode PC)',
      'Installer Ollama ou Node.js sur son PC',
      'Apprendre les commandes du terminal sans risque',
    ],
    difficulty: 'Facile',
    costSummary: '100 % Gratuit (Système).',
    webSetupSteps: [
      'Sur le Web (Cloudflare), pour des raisons de sécurité, un site internet n’a pas le droit de contrôler le disque dur de ton PC.',
      'En mode Web, cette console agit donc comme un expert qui te donne la commande exacte à copier-coller !',
    ],
    desktopSetupSteps: [
      'Sur l’application PC, clique sur "Start shell" pour ouvrir PowerShell directement dans ton dossier.',
    ],
    commands: [
      {
        command: '/help',
        description: 'Voir l’aide du terminal.',
        mode: 'all',
        canRunDirectly: true,
      },
      {
        command: 'winget install Ollama.Ollama',
        description: 'Installe Ollama gratuitement sur Windows (Mode PC).',
        mode: 'desktop',
        canRunDirectly: false,
      },
      {
        command: 'ollama list',
        description: 'Affiche les modèles IA gratuits déjà téléchargés sur ton PC.',
        mode: 'desktop',
        canRunDirectly: true,
      },
      {
        command: '/clear',
        description: 'Efface l’écran.',
        mode: 'all',
        canRunDirectly: true,
      },
    ],
    starterPrompts: [
      {
        title: '💻 Commandes de base',
        prompt: 'Quelles sont les 5 commandes de terminal les plus utiles sur Windows PowerShell pour un débutant ?',
      },
    ],
    troubleshooting: [
      'Sur le site Web Cloudflare, utilise cette console pour demander "Quelle commande taper pour faire X ?".',
    ],
  },
};
