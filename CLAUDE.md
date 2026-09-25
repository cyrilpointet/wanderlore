# Wanderlore

Jeu de rôle textuel solo, en chat : le joueur incarne son personnage, l'application
tient le rôle de maître du jeu (MJ) virtuel, piloté par un LLM externe.

Ce fichier porte les règles à respecter dans **toute** session. Le détail de conception
vit dans `doc/` — voir le skill `wanderlore-design` pour savoir quel document consulter.

---

## Convention de langue (non négociable)

- **Échanges et documentation** : français.
- **Tout le reste : anglais.** Noms de tables, colonnes, enums, clés JSON, variables,
  routes, noms de fichiers, messages de commit, system prompts LLM, et la langue par
  défaut de l'application (interface + narration).
- Le support multi-langue joueur vient *par-dessus* cette base anglaise, via un paramètre
  `language` explicite dans le contexte transmis au LLM — jamais supposé fixe.
- Dans une sortie LLM structurée : le texte narratif suit `language`, mais **toutes les
  clés et valeurs d'enum restent en anglais** (c'est cette sortie qui alimente la base).
- **« Tout en anglais en interne, traduction au dernier moment. »** Lore, scénario, state,
  system prompts et résumé narratif restent en anglais et ne sont **jamais dupliqués par
  langue**. Seule l'étape de narration (D) produit du texte dans la langue du joueur.
  Motivation : le contexte réinjecté à chaque tour est le poste de coût dominant, et la
  tokenisation de l'anglais est la plus dense.
- **Jamais de second appel de traduction** — la narration est demandée directement dans la
  langue cible. Traduire après coup coûterait le double pour une qualité moindre.
- Si le joueur écrit dans une autre langue que celle de la partie : **ni détection, ni
  traduction**. L'entrée passe telle quelle à l'arbitrage, qui sort du JSON anglais.

## Invariants d'architecture (non négociables)

1. **Le LLM propose, le backend décide.** Aucun calcul ni aucune écriture d'état durable
   n'est délégué au modèle : dés, seuils, formules, application du delta de state sont
   déterministes côté backend.
2. **Aucune confiance dans une sortie LLM.** Toute sortie structurée destinée à modifier
   l'état est validée côté backend (schéma, bornes, existence des identifiants) avant
   application. Ce qui est hors périmètre est rejeté, pas appliqué.
3. **Pipeline à responsabilité unique par étape**, jamais un appel LLM global unique.
4. **Modificateurs contextuels ≠ modificateurs d'objets.** Le LLM ne propose que des
   modificateurs situationnels (plafonnés à 2-3 par jet). Les bonus/malus d'objets sont
   lus dans l'inventaire et calculés par le backend — le LLM ne les chiffre jamais.
5. **Le narrateur ne reçoit jamais de données mécaniques brutes** (dés, seuils, valeurs de
   compétence) — uniquement `result` + `margin` qualitative.
6. **Séparation system prompt / user message.** Le system prompt est statique par étape
   (rôle, contraintes, schéma de sortie). Les données du tour passent en message
   utilisateur, toujours introduites explicitement comme données de jeu et non comme
   instructions (défense anti prompt-injection).
7. **Le front ne calcule rien.** Il affiche ce que le backend lui transmet.
8. **Multi-joueur : hors scope.** Ne pas introduire de concurrence d'accès au state.
9. **Identifiant stable ≠ nom affiché.** Objets, PNJ, lieux et flags sont désignés par une
   référence anglaise invariable, jamais par un nom d'affichage. Le LLM ne manipule que des
   références, choisies dans une **liste fermée** transmise dans le contexte — il ne peut
   pas inventer une entité ayant des conséquences mécaniques.

## Stack

- Monorepo Turborepo (npm workspaces, `apps/*`) — `backend` (AdonisJS `--kit=api`),
  `frontend`, et `back-office` ajouté plus tard (Phase 5).
- Front joueur (`apps/frontend`, Phase 2) : **Vite + React + TypeScript, Tailwind CSS 4,
  TanStack Router (routes par fichiers), TanStack Query, Vitest**. **i18n dès la Phase 2 avec react-i18next** —
  anglais seul au départ, mais aucun texte d'interface en dur : tout passe par une clé de
  traduction, et les erreurs s'affichent d'après leur `code`. Authentification par **cookie
  de session** (guard `web`) — `EventSource` ne peut pas porter d'en-tête `Authorization`.
- **PostgreSQL** (seul moteur supporté — la connexion `pg` est la seule configurée),
  JSONB pour toute structure variable par univers/scénario.
- **Clés primaires : `uuid`**, générées côté base (`gen_random_uuid()`). Ne pas revenir à
  des entiers auto-incrémentés.
- File de jobs derrière un port pour le pipeline en tâche de fond et les
  jobs différés : **pg-boss** (PostgreSQL) en instance unique, **BullMQ** (Redis) au passage
  à plusieurs instances.
- AdonisJS Transmit (SSE) pour le retour progressif au front pendant un tour.
- Docker en local pour PostgreSQL + Redis (`docker compose up -d` à la racine) — Redis n'est
  requis qu'une fois la file basculée sur BullMQ.
- LLM : **Google Gemini** (`gemini-2.5-flash`, SDK `@google/genai`), encapsulé derrière le
  **LLM Gateway**. Aucun autre fichier de l'app n'importe un SDK de provider.

## Règles de travail

- **Construction par phases** (roadmap `doc/roadmap-mj-virtuel-llm.md`). Chaque phase reste
  jouable de bout en bout. Ne pas anticiper une phase ultérieure sans raison explicite.
- **Réutiliser le scaffolding AdonisJS** (register/login déjà en place) plutôt que de
  reconstruire. Seul le champ `role` est une extension propre au projet.
- **Pas de retry automatique LLM** pour l'instant. Chaque erreur remonte au front avec un
  message différencié selon sa catégorie (timeout, sortie hors schéma, erreur HTTP, échec
  de validation backend).
- **`turn_log` est écrit à chaque tour** dès la première implémentation, même minimale.
- **Tracking des tokens consommés par tour** dès la Phase 1 — il conditionne toute
  réflexion future sur le coût réel et la monétisation.
- Avant de rouvrir une question de conception, **vérifier qu'elle n'est pas déjà tranchée**
  dans `doc/synthese-passation-mj-virtuel-llm.md` (sections 7 et 8).

## État d'avancement

**Phase 0 (socle technique) terminée.** Les deux critères de sortie sont remplis :
l'application démarre et se connecte à PostgreSQL comme au LLM externe, et un utilisateur
de test existe en base avec un rôle.

Acquis :
- Monorepo Turborepo, starter AdonisJS avec auth par access tokens.
- **PostgreSQL** : connexion `pg` par défaut, SQLite retiré. Clés primaires en `uuid`
  (`gen_random_uuid()`), timestamps en `timestamptz`.
- **`docker-compose.yml`** : PostgreSQL 17 + Redis 8, volumes nommés, healthchecks, et
  création de la base `wanderlore_test` utilisée par `.env.test`.
- **Tables** : `users` (avec `role`), `auth_access_tokens`, `sessions`, `characters`,
  `world_states`, `turn_log`. Pas encore de `worlds`, `scenarios`, `resolution_rules`,
  `inventory_items`, `lore_fragments`, `narrative_summaries` — voir roadmap.
- **LLM Gateway** (`app/services/llm/`) : port neutre + adaptateur Gemini, timeout,
  catégories d'erreur, parsing JSON, comptage des tokens, streaming pour la narration.
- Seeder `test_user`, restreint aux environnements locaux :
  `player@wanderlore.test` / `password`, rôle `player`.
- **Harnais de test** : suites `unit` (sans base, ~70 ms) et `functional` (PostgreSQL),
  faux provider LLM réutilisable, helpers de base. 45 tests couvrent les catégories
  d'erreur du gateway, les cascades, les contraintes, la réversibilité des migrations et
  la non-exposition du rôle.

**Phase 1 (boucle de jeu minimale) terminée** — epic Jira `KAN-4`. Un tour complet se joue
par requête HTTP directe dans l'univers **Les Trois Mousquetaires** (connu du LLM, domaine
public). Ses simplifications volontaires restent en vigueur jusqu'à la Phase 3 : univers et
règles en dur dans le system prompt, un seul type de jet, aucun modificateur, pas d'étape E
séparée.

**Phase actuelle : Phase 2 (front minimal)**, en préparation. Décisions de cadrage actées
(détail : roadmap Phase 2, architecture §8bis) :
- file **pg-boss** derrière un port, BullMQ à la bascule multi-instance ; idempotence,
  sérialisation des tours et événements SSE ne dépendent **jamais** de la file (le job ne
  porte que l'identifiant du tour) ;
- worker **dans le process HTTP**, `concurrency: 1`, sans retry ; Transmit en
  mémoire, sans transport Redis — ne tient pas à plusieurs instances, à reprendre avant la
  beta ;
- **clé d'idempotence** fournie par le client, une par soumission, enregistrée avant la mise
  en file ; un retry après `turn_failed` est une nouvelle soumission ;
- SSE : un canal par partie, abonné avant la soumission ; jalons seulement (`step_started`,
  `roll_resolved`, `turn_completed`, `turn_failed`), **pas de streaming de la narration**
  avant la Phase 3 ; rattrapage par lecture du tour.

**Découpage des appels LLM, en deux branches** (amende le « appel unique fusionné A+B+C+D »
d'origine, qui faisait narrer l'issue du jet avant que le backend ne la calcule) :

- **aucun jet requis** → un seul appel fusionné A+B+C+D, retournant narration + effets ;
- **jet requis** → arbitrage (A+B+C, sans narration), puis calcul du jet côté backend, puis
  second appel de narration.

Les effets viennent **toujours** de l'appel de narration : ils dépendent de l'issue du jet.

Décision non tranchée, sans urgence : hébergement léger pour la phase de test (Vercel,
Supabase, Railway…).

---

## Conventions d'implémentation établies

- **`database/schema.ts` est auto-généré** par `node ace migration:run` (schema generation
  Lucid) — ne jamais l'éditer à la main, ni le reformater : il est réécrit à chaque
  migration. Il est exclu de Prettier via `apps/backend/.prettierignore`. Les modèles de
  `app/models/` étendent les classes qu'il expose et y ajoutent la logique métier.
- **`apps/backend/.adonisjs/` est généré mais versionné** (hook `init` d'`adonisrc.ts`) :
  `start/routes.ts` importe `#generated/controllers`, et `tsc` ne le régénère pas. Après
  tout changement de route ou de contrôleur, lancer `node ace codegen` et commiter les
  fichiers régénérés **dans le même commit**. Ne jamais les éditer à la main.
- **Les classes de `database/schema.ts` ne sont pas des modèles** : elles n'ont pas de
  `static table`. Chaque modèle de `app/models/` le déclare donc explicitement — et c'est
  indispensable sur `TurnLog`, la table `turn_log` étant au singulier. Tant qu'une table
  n'a pas son modèle, y accéder par le query builder (`db.table('...')`).
- **Les relations s'écrivent à la main dans les modèles** : le générateur ne produit que
  des `@column`, et `schema_rules.ts` n'a pas de clé `relations`. Le cycle d'imports entre
  modèles est sans danger tant que le modèle importé n'est lu que dans le thunk
  `() => Model` — jamais au top level ni dans un initialiseur statique.
- **Une nouvelle table** = une migration avec `table.uuid('id').notNullable().primary()
  .defaultTo(this.raw('gen_random_uuid()'))` et des timestamps `{ useTz: true }`. Une
  colonne ajoutée à une table existante = une migration `alterTable` à part, jamais une
  retouche de la migration de création (une base déjà migrée ne la rejouerait pas).
- **Enums natifs PostgreSQL** pour les valeurs fermées. `migration:fresh` ne supprimant pas
  les types, les créer via un bloc `DO $$ … EXCEPTION WHEN duplicate_object` puis
  `existingType: true`, et les dropper dans `down()`. Voir la migration `users`. Pour un
  ensemble **ouvert** (`turn_log.language`), un `varchar` — pas d'enum.
- **Typer les colonnes générées dans `database/schema_rules.ts`**, pas dans les modèles :
  le générateur mappe les enums natifs et le `jsonb` sur `any`, et un override écrit dans
  un modèle serait perdu à la régénération suivante. Tant que le schéma d'un payload n'est
  pas tranché, un type structurel (`Record<string, unknown>`) plutôt qu'un type nommé.
- **Un `jsonb` à valeur de tableau exige un `prepare`** qui le sérialise en JSON : `pg`
  transformerait sinon le tableau JS en littéral de tableau PostgreSQL, rejeté par la
  colonne (`22P02`). Le `prepare` doit laisser passer `null` intact, sinon un NULL SQL
  devient un `null` JSON. Il se déclare dans `schema_rules.ts` (clé `args`), comme le
  typage.
- **Un service substituable** = un port (interface), une implémentation réelle reçue **par
  le constructeur**, et un singleton de module exporté par défaut — le cache de modules ESM
  suffit. **Jamais le conteneur IoC** : le projet n'en utilise aucun pour ses services, et
  un `container.swap()` ferait de la substitution un état global à restaurer après chaque
  test. Un test construit sa propre instance avec un double. Voir `app/services/llm.ts` et
  `app/services/dice.ts`.
- **Tout tirage aléatoire passe par `import dice from '#services/dice'`** — jamais
  `Math.random()` dans le code métier, sinon le moteur de règles n'est plus testable.
- **Tout appel LLM passe par `import llm from '#services/llm'`** — jamais un provider ni un
  SDK directement. `generateJson()` pour les étapes structurées (A+B+C, E),
  `generateText()` / `streamText()` pour la narration (D).
- **Toute mise en file passe par `import queue from '#services/queue'`** — jamais pg-boss ni
  BullMQ directement. Un job ne transporte que des identifiants ; rien de ce qui garantit
  l'intégrité d'un tour (idempotence, sérialisation, événements SSE) ne repose sur la file.
  Le pilote se choisit dans `config/queue.ts` (`QUEUE_DRIVER`), la suite de tests tourne sur
  le pilote mémoire, et le worker (`start/worker.ts`) ne démarre qu'avec le serveur web.
- **Tout événement de tour passe par le port `TurnEvents`** (`#services/turn_events` en
  application, `RecordingTurnEvents` en test), émis par le code du tour — jamais dérivé de la
  file. Un envoi raté ne fait jamais échouer un tour : le front rattrape en relisant le tour.
- **Toute référence de contenu envoyée au front passe par `ContentLabels`**
  (`#services/game/content_labels`) et sort en `{ reference, label }`. Jusqu'à la Phase 5,
  les libellés vivent dans `app/services/game/world.ts`. Une référence sans libellé lève
  `MissingLabelError` : jamais de référence brute ni « embellie » en repli.
- **Changer de provider** = écrire un adaptateur dans `app/services/llm/providers/` et
  changer la ligne de `config/llm.ts`. Rien d'autre.
- Le gateway **garantit un JSON parsable, pas un JSON valide** : la validation métier du
  payload reste à la charge de l'appelant, avant toute écriture dans le state.
- Le raisonnement provider (`thinking`) est **désactivé par défaut** — facturé et inutile
  aux étapes déterministes. L'activer au cas par cas via `reasoning: true`.

### Front (`apps/frontend`)

- **Tout appel d'API passe par `api()`** (`src/api/client.ts`) — jamais `fetch` directement.
  Il porte l'en-tête CSRF et renvoie vers `/login?redirect=…` sur un `401`. Le client
  Transmit réutilise `csrfHeaders()` dans son `beforeSubscribe`. Un `403 invalid_csrf_token`
  est renvoyé **une seule fois** : shield pose un cookie neuf avant de refuser, et rien n'a
  été traité (première visite, session expirée).
- **Toute page protégée vit sous `src/routes/_authenticated/`** : la garde s'appuie sur
  `currentUserQuery` (`src/auth/session.ts`), qui n'est modifiée que par la connexion, la
  déconnexion et un `401`. Une cible `?redirect=` n'est suivie que si c'est un chemin de l'app.
- **Aucun texte d'interface en dur**, attributs d'accessibilité compris : le lint le refuse
  (`i18next/no-literal-string`). Clés typées depuis les fichiers anglais.
- **Une erreur s'affiche via `errorMessage()`** (`src/i18n/errors.ts`) : traduction du `code`,
  repli sur le `message` de l'API. Un code nouveau côté backend = une entrée dans
  `locales/en/errors.json`.
- **Un enum fermé du système** se déclare dans `src/api/enums.ts` et se libelle dans
  `locales/en/enums.json` ; un test vérifie que chaque valeur a son libellé.
- **Un tour côté front passe par la machine `turnReducer`** (`src/games/turn_machine.ts`),
  pure et testée : elle ne génère aucune clé et ne lit aucune horloge, c'est `useTurn` qui
  les lui fournit. Le flux SSE passe par `transmit()` (`src/api/transmit.ts`), fermé à la
  déconnexion et sur un `401`.
- **Couleurs par jetons sémantiques uniquement** (`src/styles.css`) — jamais une valeur brute.
- En développement, Vite proxifie `/api` et `/__transmit` vers le backend (même origine).

### Tests

- **Deux suites** : `unit` ne touche pas la base et doit rester sous la seconde ;
  `functional` boote l'app et PostgreSQL. Le cycle de vie de la base est câblé dans
  `tests/bootstrap.ts`, pour la seule suite fonctionnelle.
- **Isolation opt-in par groupe** : `useTransaction(group)` (`#tests/helpers/database`).
  Un groupe qui fait du DDL s'en passe volontairement.
- **Une violation de contrainte attendue passe par `expectDbError()`** : en PostgreSQL elle
  avorterait sinon la transaction du test. Asserter sur le SQLSTATE, pas sur le message.
- **Les migrations lancées depuis un test passent toujours par `testUtils.db()`**, jamais
  par `node ace migration:run` ni `migration:fresh` (qui réécrivent `database/schema.ts` —
  `fresh` n'accepte même pas `--no-schema-generate`).
- **Les tests importent `#services/llm/gateway`**, jamais `#services/llm`, qui construirait
  un vrai client Gemini. `FakeLlmProvider` (`#tests/helpers/fake_llm_provider`) sert de
  double : il **doit** honorer `AbortSignal`, sinon les tests de timeout pendent.
- **Aucun appel à l'API LLM réelle dans la suite.** `node ace llm:ping` couvre ça à la
  demande.
- On ne teste pas le framework (routes AdonisJS, génération d'uuid, middleware d'auth).

## Commandes

```bash
docker compose up -d              # PostgreSQL + Redis (à la racine)
npm run dev                       # tous les workspaces via Turborepo
npm run test / lint / typecheck   # idem

cd apps/backend
node ace migration:run            # migre et régénère database/schema.ts
node ace migration:rollback
node ace migration:fresh          # repart d'une base vide
node ace db:seed                  # crée l'utilisateur de test
node ace llm:ping                 # vérifie que le provider LLM répond

node ace test                     # suite complète
node ace test unit                # suite unitaire seule (suite en positionnel)
node ace test functional
```
