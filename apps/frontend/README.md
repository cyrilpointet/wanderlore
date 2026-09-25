# Front joueur

Interface du rôle `player`. Spécification : `doc/cahier-des-charges-front-mj-virtuel.md`.
Maquettes : `design/` (référence visuelle, pas code à reprendre).

**Stack** : Vite + React + TypeScript, Tailwind CSS 4, TanStack Router (routes par fichiers),
TanStack Query, react-i18next, Vitest.

## Commandes

```bash
npm run dev          # depuis la racine : front (Vite, :5173) et backend (:3333) ensemble
npm run lint         # ESLint, dont le garde-fou i18n
npm run typecheck
npm run test         # Vitest, sans navigateur ni backend
npm run build
```

Le serveur Vite proxifie `/api` et `/__transmit` vers le backend (`BACKEND_URL`, par défaut
`http://localhost:3333`) : front et API partagent une origine, condition du cookie de session
et du jeton CSRF.

## Organisation

| Chemin | Rôle |
|---|---|
| `src/routes/` | Une route par fichier ; `src/routeTree.gen.ts` est généré par le plugin du routeur, ne pas l'éditer |
| `src/api/client.ts` | Seul point d'accès à l'API : cookie de session, en-tête CSRF, `401` → `/login?redirect=…` |
| `src/api/enums.ts` | Enums fermés du système (`status`, `step`, `result`, `margin`) |
| `src/auth/` | Utilisateur courant, connexion, déconnexion, cible de redirection |
| `src/games/` | Requêtes et composants des parties |
| `src/format/` | Dérivations purement visuelles (unité d'un temps relatif) ; le texte reste à `Intl` |
| `src/i18n/` | Initialisation, fichiers de traduction par langue et namespace, clés typées |
| `src/theme.ts` | Thème sombre par défaut, choix mémorisé, sinon celui du système |
| `src/styles.css` | Jetons de couleur des deux thèmes, polices, tailles de texte |

## Règles

- **Aucun texte d'interface en dur.** Tout passe par `t()`, y compris `aria-label`, `alt` et
  `placeholder` : `i18next/no-literal-string` le refuse au lint.
- **Clés typées** depuis les fichiers anglais (`src/i18n/i18next.d.ts`) : une clé inconnue
  casse le typecheck.
- **Une erreur s'affiche d'après son `code`** : `errorMessage()` (`src/i18n/errors.ts`), avec
  repli sur le `message` de l'API pour un code encore inconnu.
- **Dates et nombres** via les formateurs d'i18next (`{{value, number}}`,
  `{{value, relativetime}}`…), qui s'appuient sur `Intl` : jamais de formatage à la main.
- **Libellés de contenu** (lieux, compétences…) : fournis par le backend, jamais par l'i18n.
- **Couleurs** : uniquement les jetons sémantiques (`bg-surface-1`, `text-muted`,
  `text-accent`…), jamais une valeur brute — c'est ce qui rend les deux thèmes gratuits.
- **Ajouter une langue** = créer `src/i18n/locales/<lang>/` avec les mêmes namespaces. Elle est
  découpée dans ses propres fichiers et chargée à la demande.
