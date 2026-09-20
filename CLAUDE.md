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

## Stack

- Monorepo Turborepo (npm workspaces, `apps/*`) — `backend` (AdonisJS `--kit=api`),
  `frontend`, et `back-office` ajouté plus tard (Phase 5).
- **PostgreSQL** (seul moteur supporté — la connexion `pg` est la seule configurée),
  JSONB pour toute structure variable par univers/scénario.
- **Clés primaires : `uuid`**, générées côté base (`gen_random_uuid()`). Ne pas revenir à
  des entiers auto-incrémentés.
- BullMQ (Redis) pour l'exécution du pipeline en tâche de fond et les jobs différés.
- AdonisJS Transmit (SSE) pour le retour progressif au front pendant un tour.
- Docker en local pour PostgreSQL + Redis (`docker compose up -d` à la racine).
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

**Prochaine étape : Phase 1** — boucle de jeu minimale. Rappel des simplifications
volontaires de cette phase : **un seul appel LLM fusionné A+B+C+D**, univers et règles en
dur dans le system prompt, un seul type de jet, aucun modificateur, pas d'étape E séparée.
Ne pas implémenter le pipeline complet ici : c'est la Phase 3.

Décision non tranchée, sans urgence : hébergement léger pour la phase de test (Vercel,
Supabase, Railway…).

---

## Conventions d'implémentation établies

- **`database/schema.ts` est auto-généré** par `node ace migration:run` (schema generation
  Lucid) — ne jamais l'éditer à la main, ni le reformater : il est réécrit à chaque
  migration. Il est exclu de Prettier via `apps/backend/.prettierignore`. Les modèles de
  `app/models/` étendent les classes qu'il expose et y ajoutent la logique métier.
- **Une nouvelle table** = une migration avec `table.uuid('id').notNullable().primary()
  .defaultTo(this.raw('gen_random_uuid()'))` et des timestamps `{ useTz: true }`.
- **Enums natifs PostgreSQL** pour les valeurs fermées. `migration:fresh` ne supprimant pas
  les types, les créer via un bloc `DO $$ … EXCEPTION WHEN duplicate_object` puis
  `existingType: true`, et les dropper dans `down()`. Voir la migration `users`.
- **Typer les colonnes générées dans `database/schema_rules.ts`**, pas dans les modèles :
  le générateur mappe les enums natifs et le `jsonb` sur `any`, et un override écrit dans
  un modèle serait perdu à la régénération suivante.
- **Tout appel LLM passe par `import llm from '#services/llm'`** — jamais un provider ni un
  SDK directement. `generateJson()` pour les étapes structurées (A+B+C, E),
  `generateText()` / `streamText()` pour la narration (D).
- **Changer de provider** = écrire un adaptateur dans `app/services/llm/providers/` et
  changer la ligne de `config/llm.ts`. Rien d'autre.
- Le gateway **garantit un JSON parsable, pas un JSON valide** : la validation métier du
  payload reste à la charge de l'appelant, avant toute écriture dans le state.
- Le raisonnement provider (`thinking`) est **désactivé par défaut** — facturé et inutile
  aux étapes déterministes. L'activer au cas par cas via `reasoning: true`.

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
```
