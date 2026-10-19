# Agent Canvas

Un canvas infini pour piloter **plusieurs IA en ligne de commande en même temps** (Claude Code, Codex, Gemini CLI, Antigravity, Ollama, Qwen, Aider, OpenCode…), les regrouper en équipes et les faire travailler ensemble grâce à un orchestrateur.

- **Consoles** : chaque carte est un vrai terminal où tourne une IA (ou un simple PowerShell).
- **Équipes + orchestrateur** : envoie une mission à une équipe et choisis comment elle travaille :
  - **Répartir** : un chef de projet découpe la mission, chaque IA fait sa partie, puis tout est assemblé ;
  - **Relais** : l'IA 1 commence, sa réponse est transmise automatiquement à l'IA 2, etc. ;
  - **Débat**, **Parallèle**, **Gate & audit de sécurité**.
- **Workspace** : choisis le dossier de ton projet ; les consoles s'y lancent et le panneau affiche le vrai statut git.
- **Barre de commande** : tape `@` pour envoyer un prompt à une IA, une équipe ou tout le monde.
- Tout est sauvegardé automatiquement ; au redémarrage, aucune IA ne se relance toute seule.

> Agent Canvas ne contient **aucune IA** et ne donne aucun accès gratuit : il pilote les outils déjà installés sur ton PC, avec **tes** comptes et **tes** quotas.

## Installation (Windows)

1. Télécharge `Agent-Canvas-Setup-x.y.z.exe` dans les [Releases](https://github.com/Triplex78654/agent-canvas/releases/latest).
2. Lance-le. L'app n'étant pas signée, Windows peut afficher « Windows a protégé votre ordinateur » : clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. Au premier lancement, l'écran **« Mes IA »** te dit quelles IA sont déjà installées et comment installer les autres.

Les mises à jour sont automatiques : une nouvelle version se télécharge en arrière-plan, puis un bouton **« Mise à jour prête · Redémarrer »** apparaît en haut à droite.

### Installer au moins une IA

| IA | Installation | Compte nécessaire |
|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | Abonnement Claude Pro/Max ou clé API |
| Gemini CLI | `npm install -g @google/gemini-cli` | Compte Google (quota gratuit) |
| Codex | `npm install -g @openai/codex` | Abonnement ChatGPT ou clé API |
| Ollama (100 % local) | `winget install Ollama.Ollama` | Aucun (tourne sur ton PC) |

Les commandes `npm` demandent [Node.js](https://nodejs.org) (version LTS). Après l'installation, ouvre une console dans Agent Canvas, lance l'IA une première fois et connecte-toi.

## Bien démarrer

1. Clique sur **Workspace** et choisis le dossier de ton projet.
2. Crée 2 consoles (**New console**), choisis une IA pour chacune, puis sélectionne-les et clique sur **Group**.
3. Dans l'orchestrateur, choisis un mode (par exemple **Relais IA**), écris ta mission et lance-la.
4. La première fois dans un nouveau dossier, certaines IA demandent « Do you trust this folder? » : réponds dans la console, la mission part ensuite toute seule (badge **Action requise**).

## Sécurité : à lire

- Les IA peuvent **lire, modifier et supprimer des fichiers** et lancer des commandes dans le dossier où elles tournent. Certaines (mode « auto ») le font sans demander.
- Mets ton projet sous **git** pour pouvoir annuler ce qu'une IA a cassé, et ne lance jamais d'IA dans un dossier contenant des mots de passe ou des clés.
- En équipe, une IA transmet sa réponse à la suivante : une erreur peut se propager. Relis avant de valider.
- Les jauges de tokens sont une **estimation**, pas ta consommation réelle.

## Signaler un problème

Bouton **Support** dans l'app : il ouvre un [ticket GitHub](https://github.com/Triplex78654/agent-canvas/issues) pré-rempli avec un diagnostic (sans aucune clé ni donnée personnelle).

## Développement

```bash
npm install
npm run dev          # Vite + Electron en mode développement
npm run build        # vérification TypeScript + build de l'interface
npm run dist:win     # crée l'installateur dans release/
```

### Publier une nouvelle version

1. Augmente `version` dans `package.json` (ex. `1.4.0` → `1.4.1`) et commit.
2. Lance `npm run dist:win`.
3. Sur GitHub, crée une **Release** avec le tag `v1.4.1` et joins-y les fichiers de `release/` :
   `Agent-Canvas-Setup-1.4.1.exe`, `Agent-Canvas-Setup-1.4.1.exe.blockmap` et **`latest.yml`** (indispensable pour les mises à jour automatiques).

Stack : Electron, React, TypeScript, Vite, Tailwind, React Flow (`@xyflow/react`), xterm.js, node-pty.

## Licence

[MIT](LICENSE)
