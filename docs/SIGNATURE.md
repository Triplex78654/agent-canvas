# Signer Agent Canvas (faire disparaître l'avertissement Windows)

Sans signature, Windows SmartScreen affiche « Windows a protégé votre ordinateur / Éditeur inconnu ».
L'app fonctionne quand même (clic sur « Informations complémentaires » → « Exécuter quand même »),
mais ça fait peur aux nouveaux utilisateurs.

## Les options pour un particulier en France (vérifié en octobre 2026)

| Option | Prix | Possible pour toi ? | Remarques |
|---|---|---|---|
| **SignPath Foundation** | Gratuit | Oui, sur dossier | Pour les projets 100 % open source (Agent Canvas est sous MIT). L'installateur doit être fabriqué automatiquement par GitHub Actions, pas sur ton PC. Chaque version est validée à la main par toi. Le certificat est au nom de « SignPath Foundation ». Acceptation à leur discrétion : un projet très récent peut devoir attendre d'avoir quelques utilisateurs. |
| **Azure Artifact Signing** (Microsoft) | ~10 $/mois | Non (pas encore) | Ouvert aux particuliers seulement aux États-Unis et au Canada ; en Europe, seulement aux organisations (entreprise, association…). |
| **Certificat OV classique** (Certum, Sectigo…) | ~100 à 400 €/an | Oui | Clé sur une clé USB sécurisée ou dans le cloud. N'enlève pas l'avertissement tout de suite : SmartScreen construit une « réputation » au fil des téléchargements. |

**Recommandation : SignPath Foundation** (gratuit, adapté à un projet open source perso).

## Ce qui est déjà prêt dans le dépôt

- `docs/signature/windows-build.yml` : le build GitHub Actions qui teste, fabrique l'installateur et l'envoie à SignPath.
  Il n'est **pas encore actif** (il est rangé dans `docs/`) pour ne rien casser tant que SignPath n'a pas accepté le projet.

## Les étapes (c'est toi qui dois les faire : elles demandent ton compte)

1. Active la **double authentification (2FA)** sur ton compte GitHub (obligatoire chez SignPath).
2. Fais la demande sur https://signpath.org/apply (projet : https://github.com/Triplex78654/agent-canvas).
3. Une fois accepté, SignPath te donne un *organization id*, un *project slug* et un *token*.
   Ajoute-les dans GitHub → ton dépôt → Settings → Secrets and variables → Actions :
   `SIGNPATH_API_TOKEN` et `SIGNPATH_ORGANIZATION_ID`.
4. Demande-moi d'activer le build : je déplace `windows-build.yml` dans `.github/workflows/`,
   j'ajuste les noms donnés par SignPath et j'adapte `publier.bat` pour publier l'installateur signé.
5. Ajoute la politique de signature demandée par SignPath dans le README (texte fourni par SignPath).
