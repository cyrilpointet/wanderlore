# Wanderlore — aide-mémoire du dev testeur

Toutes les commandes utiles pour lancer, remettre à zéro et mesurer l'application en local,
et les comptes de test. Les commandes `node ace …` se lancent depuis `apps/backend`, les
autres depuis la racine du dépôt sauf mention contraire.

---

## Comptes de test

Créés par `node ace db:seed`, **en local seulement** (environnements `development` et `test`).
Mot de passe commun : `password`.

| Compte | Rôle | Où se connecter | Ce qu'il fait |
|---|---|---|---|
| `player@wanderlore.test` | `player` | front joueur — http://localhost:5173 | joue ; reçoit la partie de démo |
| `gm@wanderlore.test` | `game_master` | back-office — http://localhost:5174 | écrit univers et scénarios ; voit et joue les brouillons dans le front joueur |
| `admin@wanderlore.test` | `superadmin` | back-office — http://localhost:5174 | gère les comptes (liste, création, suspension, réactivation) |

- **Un compte = un rôle** : le `game_master` ne voit pas les comptes, le `superadmin` ne voit
  pas le contenu, et un `player` est refusé par le back-office.
- **Partie de démo** : *Les Trois Mousquetaires*, scénario *A Gascon in Paris*, d'Artagnan à
  Meung-sur-Loire, rattachée à `player@wanderlore.test`. Recréée à chaque `db:seed` et
  `game:reset`.
- **Hors local** (production), aucun de ces comptes n'existe : le premier superadmin se crée
  avec `node ace account:create-superadmin` (voir plus bas), puis les autres comptes depuis
  le back-office.

---

## Démarrer

```bash
docker compose up -d          # PostgreSQL 17 (5433) + Redis 8 (6380), à la racine
npm install                   # une fois, ou après un changement de dépendances
npm run dev                   # backend, front joueur et back-office, via Turborepo
```

| Application | URL | Lancer seule |
|---|---|---|
| Backend (API, SSE) | http://localhost:3333 | `cd apps/backend && npm run dev` |
| Front joueur | http://localhost:5173 | `cd apps/frontend && npm run dev` |
| Back-office | http://localhost:5174 | `cd apps/back-office && npm run dev` |

En local, les deux fronts passent par le proxy Vite (`/api`, et `/__transmit` pour le front
joueur) : tout reste sur une même origine, rien à configurer. Le backend charge le modèle LLM
au démarrage : **le relancer** après un changement de `.env`.

**Après un `git pull`** : `node ace migration:run`, puis `node ace db:seed` si du contenu ou
des comptes de test sont arrivés. Une base pas à jour casse l'app de façon trompeuse — par
exemple, sans la colonne `users.suspended_at`, tous les comptes sont lus comme suspendus. Pour
ajouter un seul seeder sans recréer la partie de démo :
`node ace db:seed --files=database/seeders/04_test_superadmin_seeder.ts`.

**Première installation** : copier `apps/backend/.env.example` en `apps/backend/.env`,
renseigner `GOOGLE_AI_API_KEY`, générer `APP_KEY` avec `node ace generate:key`, puis
migrer et seeder (section suivante).

---

## Base de données

```bash
node ace migration:status         # migrations jouées et en attente
node ace migration:run            # migre, et régénère database/schema.ts
node ace migration:rollback       # annule le dernier lot
node ace migration:fresh          # repart d'une base vide (toutes les tables)
node ace db:seed                  # contenu de jeu, puis comptes et partie de test
```

- **`db:seed` est idempotent** : le contenu de jeu (Trois Mousquetaires) est réécrit d'après
  `database/content/`, les comptes de test remis en l'état, la partie de démo recréée.
- **Une migration qui refuse de passer parce que des parties existent** : vider les parties
  d'abord avec `node ace game:reset --no-seed`, puis migrer et seeder.
- **Ne jamais lancer `migration:reset`** : il réécrit `database/schema.ts` vide, et ace ne
  démarre plus.
- **Régénérer `database/schema.ts` sans toucher à la base de dev** :
  `NODE_ENV=test node ace migration:run` (migre la base de test).

---

## Parties

```bash
node ace game:reset               # supprime parties et turn_log, recrée la partie de démo
node ace game:reset --force       # idem, sans demander confirmation
node ace game:reset --no-seed     # supprime sans recréer (avant une migration qui refuse les parties)
```

Refusé en production. Arrêter le serveur avant, ou au moins ne laisser aucun tour en cours :
un job resté en file chercherait un tour qui n'existe plus. **`game:reset` efface aussi
l'historique de consommation** (`turn_log`).

**Préférences du front joueur** (menu du compte → *Preferences*) : thème, lecture à voix haute,
lancer automatique des dés, animations une à une. Rangées dans le navigateur (clés
`wanderlore.*` du `localStorage`), jamais en base : pour repartir des valeurs par défaut,
vider ces clés dans les outils de développement. La réduction des animations du système
(`prefers-reduced-motion`, émulable dans l'onglet *Rendering* de Chrome) les coupe toutes.

---

## LLM : vérifier et mesurer

```bash
node ace llm:ping                 # le provider répond-il ? (appel réel, JSON puis streaming)
```

Le modèle utilisé est `DEFAULT_AI_MODEL` dans `apps/backend/.env` (`gemini-3.8-flash`).
Pour essayer un autre modèle le temps d'une commande, sans toucher au `.env` :
`DEFAULT_AI_MODEL=<modèle> node ace llm:ping`.

### Consommation de jetons et coût réel

```bash
node ace llm:cost                                                     # jetons seulement
node ace llm:cost --input-per-million=<prix> --output-per-million=<prix>   # avec le coût
node ace llm:cost --model=gemini-3.8-flash --input-per-million=<prix> --output-per-million=<prix>
```

- **Lecture seule**, sur `turn_log` : totaux, moyenne par tour et par partie, détail par
  étape (arbitrage, narration, extraction, avec le taux de sorties rejetées) et par langue.
- **Tours comptés** : tous ceux du journal sauf ceux encore en cours — terminés et échoués,
  les seconds ayant aussi consommé. La ligne `N turn(s) played (… completed, … failed)` les
  donne.
- **Les prix ne sont jamais dans le code** : ils se passent en options, par million de jetons
  (les jetons de raisonnement sont facturés comme la sortie).
- **Plusieurs modèles dans le journal** : la commande le signale (`Several models are
  mixed…`) et le coût affiché est alors faux. Lancer une fois par modèle avec `--model` et ses
  propres prix, puis additionner.
- **Un tour fait trois appels au moins** (arbitrage, narration, extraction), deux pour un
  aparté au MJ, jusqu'à cinq si des sorties structurées sont rejetées puis renvoyées.
- Pour une mesure propre : `node ace game:reset`, puis une série d'une vingtaine de tours au
  moins.

---

## Comptes

```bash
node ace account:create-superadmin    # demande nom, email et mot de passe (masqué, deux fois)
node ace account:create-superadmin --name="Ada Admin" --email=ada@example.com --password=<mot de passe>
```

Crée un superadmin, le premier compris, en local comme en production. Mêmes règles que
l'inscription : email unique, mot de passe de 8 à 32 caractères. Tous les autres comptes —
de n'importe quel rôle — se créent, se suspendent et se réactivent depuis le back-office,
avec un compte superadmin.

---

## Tests et qualité

```bash
npm run test                      # tout : backend, front joueur, back-office
npm run lint
npm run typecheck

cd apps/backend
node ace test                     # suites unit + functional
node ace test unit                # sans base, rapide
node ace test functional          # avec PostgreSQL (base wanderlore_test)
node ace test functional --files=tests/functional/game/turn_service.spec.ts
node ace test functional --tests="refuses a skill the character does not have"

cd apps/frontend                  # ou apps/back-office
npm run test                      # Vitest, sans navigateur
```

- **Échec en cascade connu** : environ un passage complet sur trois, des dizaines de tests
  tombent sur « unable to release database lock ». **Relancer** avant d'enquêter.
- La suite n'appelle jamais l'API LLM réelle : `llm:ping` est là pour ça.
- La base de test (`wanderlore_test`) est vidée à chaque passage : elle ne sert qu'aux tests.

---

## Code généré

```bash
node ace codegen                  # après tout ajout ou changement de route ou de contrôleur
```

Régénère `apps/backend/.adonisjs/`, versionné : commiter les fichiers régénérés dans le même
commit que la route. Le front et le back-office régénèrent eux-mêmes leur arbre de routes
(`src/routeTree.gen.ts`) au `npm run dev` ou au `npm run build`.

---

## Variables d'environnement utiles

| Variable | Où | Rôle |
|---|---|---|
| `GOOGLE_AI_API_KEY` | backend | clé de l'API Gemini |
| `DEFAULT_AI_MODEL` | backend | modèle utilisé pour toutes les étapes |
| `LLM_REQUEST_TIMEOUT_MS` | backend | plafond d'un appel LLM (60 000 par défaut) |
| `QUEUE_DRIVER` | backend | `pgboss` (défaut) ou `memory` |
| `CORS_ORIGINS` | backend, hors local | origines du front et du back-office, séparées par des virgules |
| `COOKIE_DOMAIN` | backend, hors local | domaine parent des cookies de session et CSRF |
| `BACKEND_URL` | front, back-office | cible du proxy Vite (`http://localhost:3333` par défaut) |
| `VITE_PLAYER_URL` | back-office | front joueur ouvert par « Try it in the game » (`http://localhost:5173` par défaut) |
