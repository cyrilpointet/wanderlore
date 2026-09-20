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
- LLM : API externe, encapsulée derrière un service **LLM Gateway** indépendant du provider.

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

Phase 0 (socle technique) **en cours**.

Fait :
- Monorepo Turborepo, starter AdonisJS avec auth par access tokens (signup / login /
  logout / profile).
- **PostgreSQL** : connexion `pg` par défaut, SQLite retiré. Variables `PG_*` validées
  dans `apps/backend/start/env.ts`.
- **Clés primaires en `uuid`** sur `users` et `auth_access_tokens`, défaut base
  `gen_random_uuid()`, timestamps en `timestamptz`.
- **`docker-compose.yml`** à la racine : PostgreSQL 17 + Redis 8, volumes nommés et
  healthchecks. Un script d'init crée la base `wanderlore_test` utilisée par `.env.test`.

Restant pour clore la Phase 0 :
- Champ `users.role` (enum `player` / `game_master` / `superadmin`).
- Tables `sessions`, `characters`, `world_states`, `turn_log` en version minimale.
- LLM Gateway simple, un seul provider.
- Utilisateur de test en base.

Point encore ouvert : choix du provider LLM.

---

## Conventions d'implémentation établies

- **`database/schema.ts` est auto-généré** par `node ace migration:run` (schema generation
  Lucid) — ne jamais l'éditer à la main, ni le reformater : il est réécrit à chaque
  migration. Il est exclu de Prettier via `apps/backend/.prettierignore`. Les modèles de
  `app/models/` étendent les classes qu'il expose et y ajoutent la logique métier.
- **Une nouvelle table** = une migration avec `table.uuid('id').notNullable().primary()
  .defaultTo(this.raw('gen_random_uuid()'))` et des timestamps `{ useTz: true }`.
- Le type TypeScript d'une colonne `jsonb` est généré en `any` : typer explicitement dans
  le modèle ou via `database/schema_rules.ts` dès que la structure est stabilisée.

## Commandes

```bash
docker compose up -d              # PostgreSQL + Redis (à la racine)
npm run dev                       # tous les workspaces via Turborepo
npm run test / lint / typecheck   # idem

cd apps/backend
node ace migration:run            # migre et régénère database/schema.ts
node ace migration:rollback
```
