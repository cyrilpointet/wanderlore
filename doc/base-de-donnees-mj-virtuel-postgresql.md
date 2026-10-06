# Base de données — Logiciel de jeu de rôle piloté par LLM

## Document de référence technique — PostgreSQL

**Stack cible** : PostgreSQL, avec usage de colonnes JSONB pour les structures variables
**Complément** : recherche de lore par RAG (embeddings + vector store), hors du périmètre relationnel strict décrit ici pour la partie contenu narratif

> **⚠️ Convention de nommage** : conformément à la convention actée pour le projet, **tout le nommage technique est en anglais** — noms de tables, colonnes, valeurs d'enum, et clés à l'intérieur des structures JSONB. Le texte explicatif de ce document reste en français, mais chaque identifiant technique (table, colonne, clé JSON) est donné directement en anglais, sans traduction à faire a posteriori.

---

## 1. Principes de modélisation

- **Séparer structure fixe et contenu variable.** Les identifiants, clés étrangères et champs systématiquement présents restent en colonnes typées classiques. Les structures qui varient fortement d'un univers ou d'une action à l'autre (barèmes, modificateurs, conditions spécifiques) vont en `jsonb`.
- **Séparer contenu statique (réutilisable) et état dynamique (propre à une partie).** Un univers, un scénario, un lore fragment ou une règle de résolution existent indépendamment de toute partie jouée. Le state d'une partie, l'inventaire d'un personnage, le journal des tours n'existent qu'en lien avec une partie précise.
- **Les données mécaniques exactes ne passent jamais par une recherche sémantique.** Barèmes de difficulté, formules, seuils sont récupérés par requête SQL déterministe (`WHERE world_id = ? AND action_type = ?`), jamais par similarité — contrairement au lore narratif qui, lui, relève du RAG.
- **Le LLM ne manipule jamais de valeurs numériques de règles.** Il propose des labels (`action_type`, `difficulty: "medium"`), le backend résout ces labels en valeurs réelles via les tables de règles.

---

## 2. Domaine "Contenu de jeu" (statique, réutilisable entre parties)

### `worlds`

Bible de contexte, indépendante de toute partie jouée.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `name` | text | nom de l'univers |
| `description` | text | description générale |
| `narrative_tone` | text | registre, ambiance (ex: "médiéval-fantastique, politique, tension sociale") |
| `general_rules` | jsonb | contraintes globales : niveau de magie, technologie, contraintes physiques, liste des attributs/compétences |
| `content_boundaries` | jsonb | tabous, éléments interdits à générer |
| `created_at` / `updated_at` | timestamp | — |

**Exemple de contenu `general_rules`** :
```json
{
  "attributes": ["Physical", "Mental", "Social"],
  "skills": [
    { "name": "persuasion", "attribute": "Social" },
    { "name": "melee_combat", "attribute": "Physical" },
    { "name": "stealth", "attribute": "Physical" },
    { "name": "magic", "attribute": "Mental" }
  ]
}
```

### `lore_fragments`

Unités atomiques de connaissance sur un univers. Sert de source pour l'indexation RAG (embeddings générés à partir du `content`), tout en restant en base relationnelle comme source de vérité éditable.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds | univers parent |
| `content` | text | texte du fragment |
| `fragment_type` | text | `mechanical_rule` / `ambiance_description` / `historical_fact` / `faction_description` |
| `tags` | text[] ou jsonb | tags pour filtrage complémentaire au RAG (thème, lieu, catégorie) |
| `sensitivity` | text | `public` / `arbitration_only` (info que le joueur ne doit pas connaître à l'avance) |
| `embedding_id` | text/uuid | référence vers le vector store si l'indexation est gérée en externe |
| `created_at` / `updated_at` | timestamp | — |

> Note d'architecture : si le vector store choisi (ex: pgvector) est intégré directement à PostgreSQL, une colonne `embedding vector(n)` peut être ajoutée directement sur cette table plutôt que de référencer un store externe.

### `scenarios`

Trame narrative type, rattachée à un univers.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds | univers parent |
| `title` | text | titre du scénario |
| `synopsis` | text | résumé général |
| `chapter_structure` | jsonb | liste ordonnée de chapitres/beats, objectifs, conditions de progression |
| ~~`planned_npcs`~~ | — | remplacé par la table `npc_definitions` (Phase 5), qui porte aussi les PNJ de l'univers — voir architecture, section 6ter |
| `item_catalog` | jsonb | **catalogue fermé** des objets acquérables : référence stable, effets mécaniques, noms d'affichage par langue — *forme à revoir en Phase 4 : définitions à deux niveaux (univers et scénario), comme les PNJ* |
| `glossary` | jsonb | noms propres (lieux, PNJ, factions) et leurs traductions par langue |
| `branch_points` | jsonb | points de bascule / choix narratifs possibles |

**`item_catalog`** est la source de vérité des objets que l'étape d'extraction peut accorder.
Le LLM ne peut pas créer d'entrée d'inventaire : un objet inventé n'aurait ni effets
mécaniques, ni référence stable, ni traduction. Le narrateur reste libre de décrire ce qu'il
veut — il ne peut simplement pas faire apparaître quelque chose de mécaniquement actif.

**`glossary`** fige la traduction des noms propres, pour éviter qu'un même lieu soit nommé
différemment d'un tour à l'autre. Il est injecté à la seule étape de narration, limité aux
entités présentes dans la scène — quelques dizaines de jetons, contre des milliers si l'on
dupliquait tout le lore par langue.
| `created_at` / `updated_at` | timestamp | — |

### `resolution_rules`

Barèmes de jeu paramétrables, table clé pour l'étape de résolution du pipeline LLM. Elle
rattache chaque catégorie d'action (`action_type`) à la compétence qui la résout : le LLM
d'arbitrage choisit la catégorie dans une liste fermée, le backend en déduit la compétence.

**Schéma de la Phase 3** (tranché avant la phase) — volontairement réduit à ce qu'un tour
lit réellement :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_reference` | varchar | référence de l'univers (`three_musketeers`) ; devient `world_id` (FK → `worlds`) en Phase 5 |
| `action_type` | varchar | catégorie d'action, référence anglaise stable (ex : `melee_combat`, `social_persuasion`) |
| `description` | text | une phrase anglaise sur ce que couvre la catégorie, transmise à l'arbitrage |
| `associated_skill` | varchar | référence d'une compétence de l'univers |
| `created_at` / `updated_at` | timestamptz | — |

Contrainte d'unicité sur `(world_reference, action_type)`, qui sert aussi d'index à la
résolution. `action_type` est un `varchar`, pas un enum : la liste est propre à chaque
univers, donc ouverte.

- **Pas de clé étrangère vers les compétences** : jusqu'à la Phase 5, elles vivent dans la
  définition d'univers en dur. Un test vérifie que chaque `associated_skill` y existe.
- **Pas de seuils par ligne** : l'échelle de difficulté est fixe dans le code. Un barème
  alternatif, s'il est un jour autorisé, se réglera par univers, sur `worlds`.
- **Remplissage par un seeder de contenu idempotent**, exécuté dans tous les environnements :
  les lignes sont écrites dans le code, à côté de la définition d'univers, et insérées ou
  mises à jour par `(world_reference, action_type)`. Modifier le contenu revient à modifier ce
  fichier, jusqu'à ce que le back-office de la Phase 5 prenne le relais.

**Colonnes prévues plus tard**, ajoutées chacune par un `alterTable` quand un tour les lira :

| Colonne | Type | Contenu | Phase |
|---|---|---|---|
| `scenario_id` | FK → scenarios, nullable | scénario parent si la règle surcharge celle de l'univers | 5 |
| `possible_modifiers` | jsonb | sources de bonus/malus contextuels possibles | 4 au plus tôt |
| `specific_conditions` | jsonb | prérequis stricts, conséquences d'échec/réussite critique, mécaniques propres au type d'action | à la première règle qui en a besoin |

**Exemple de contenu `possible_modifiers`** :
```json
[
  { "source": "legitimacy_item", "value": 2, "description": "Présentation d'un document ou sceau officiel crédible" },
  { "source": "favorable_reputation", "value": 3, "description": "Le PNJ a déjà une opinion positive du joueur" }
]
```

**Exemple de contenu `specific_conditions`** (cas d'un prérequis strict) :
```json
{
  "strict_prerequisite": "non_zero_magic_skill",
  "consequence_if_prerequisite_missing": "narrative_automatic_failure",
  "skill_rarity": "moins de 1% de la population"
}
```

---

## 3. Domaine "Partie en cours" (une instance jouée)

### `sessions`

Une partie jouée par un joueur donné.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `user_id` | FK → users | joueur propriétaire |
| `scenario_id` | FK → scenarios | scénario parent |
| `world_id` | FK → worlds | univers parent (dénormalisé pour accès direct sans jointure supplémentaire) |
| `status` | text | `in_progress` / `completed` / `paused` |
| `current_chapter` | text/uuid | référence au chapitre courant dans `chapter_structure` |
| `created_at` / `last_activity_at` | timestamp | — |

### `characters`

Le personnage joué dans une partie donnée.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `attributes` | jsonb | statistiques de base (force, dextérité, etc.) |
| `skills` | jsonb | compétences avec valeurs numériques |
| `hit_points` | int | PV courants |
| `hit_points_max` | int | PV maximum |
| `resources` | jsonb | autres ressources courantes (mana, endurance, etc.) |
| `progression` | jsonb | niveau, expérience si applicable |
| `created_at` / `updated_at` | timestamp | — |

**Exemple de contenu `attributes`** : `{ "Physical": 3, "Mental": 2, "Social": 4 }`
**Exemple de contenu `skills`** : `{ "persuasion": 3, "melee_combat": 1, "stealth": 2 }`

### `inventory_items`

Objets possédés par le personnage.

> **Schéma à revoir à l'ouverture de la Phase 4.** Le principe est tranché (architecture,
> section 6bis) : une ligne d'inventaire est une **instance** qui pointe vers une définition
> d'objet (univers ou scénario, `unique` ou `archetype`) et ne porte que l'état propre à
> l'instance — quantité, `equipped` / `carried`, descripteur, plus tard durabilité et
> charges. Les colonnes `display_names`, `descriptions` et `mechanical_effects` ci-dessous
> passeront donc sur la définition. Le tableau reste en l'état jusqu'à ce que le schéma soit
> tranché.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant technique de la ligne |
| `character_id` | FK → characters | personnage parent |
| `item_reference` | text | **référence stable en anglais** (ex. `recommendation_letter`) — c'est elle que manipulent le code et le LLM |
| `display_names` | jsonb | noms d'affichage par langue, vus par le joueur et employés par le narrateur |
| `descriptions` | jsonb | descriptions par langue |
| `mechanical_effects` | jsonb | bonus/malus liés à l'objet, appliqués à des compétences précises |
| `quantity` | int | quantité |
| `state` | text | `equipped` / `carried` / `other` |

**Pourquoi séparer `item_reference` et `display_names`** : sans référence stable, rien
n'empêche le LLM de désigner le même objet par « the letter », puis « recommendation letter »,
puis — en partie non anglophone — par son nom traduit. La référence est l'identité de l'objet
pour le code ; les noms d'affichage sont ce que voit l'humain. Voir le document d'architecture,
section 6bis.

**Exemple de contenu `display_names`** :
```json
{ "en": "Recommendation letter", "fr": "Lettre de recommandation" }
```

À l'étape de narration, **seule la langue de la partie est injectée**, jamais la table
complète : le coût en jetons reste identique que le produit supporte deux langues ou dix.

**Structure de `mechanical_effects`** : liste de modificateurs fixes, chacun ciblant une compétence, avec une condition d'activation.

```json
{
  "modifiers": [
    { "target_skill": "persuasion", "value": 2, "condition": "owned", "description": "Sceau officiel reconnu" },
    { "target_skill": "melee_combat", "value": 1, "condition": "equipped", "description": "Lame bien équilibrée" },
    { "target_skill": "stealth", "value": -2, "condition": "equipped", "description": "Armure lourde, bruyante" }
  ]
}
```

- `condition: "owned"` — le bonus s'applique dès que l'objet est en inventaire, sans besoin d'être activement porté (ex: un document, une lettre).
- `condition: "equipped"` — le bonus ne s'applique que si `state = "equipped"` pour cette ligne d'inventaire (ex: une arme, une armure).
- Le champ `description` **interne à un modificateur reste en anglais** et n'est jamais traduit : il sert l'audit et le debug (« pourquoi ce bonus s'applique-t-il ? »). Le texte destiné au joueur est celui de `descriptions`, sur l'objet lui-même. Sans cette distinction, on finit par traduire des données de debug.
- Ces valeurs sont **exclusivement calculées par le backend** au moment du jet (jointure entre la compétence utilisée et les objets du personnage qui la ciblent) — elles ne transitent jamais par un appel LLM et ne sont jamais proposées ou réinterprétées par le modèle.

### `world_states`

État évolutif du monde pour une partie donnée — table la plus critique, consultée à chaque tour du pipeline.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions (unique) | partie parente — relation 1:1 |
| `active_quests` | jsonb | liste des quêtes avec statut et étape courante |
| `narrative_flags` | jsonb | événements/booléens déclenchés (ex: `"noble_zone_access_granted": true`) |
| ~~`visited_locations`~~ | — | **remplacé en Phase 3** par `current_location_id` et la table `location_instances`, qui forme la liste des lieux visités |
| `current_location_id` | FK → location_instances | lieu courant de la partie (Phase 3) |
| `world_objects` | jsonb | objets visibles dans le monde mais non ramassés (distincts de l'inventaire) |
| `updated_at` | timestamp | — |

### `location_instances`

Lieux tels qu'ils existent dans une partie : lieux uniques visités et lieux d'archétype
improvisés, sous une même forme. Définitions en dur dans la définition d'univers en Phase 3,
en base en Phase 5 (`location_definitions`, même forme que `npc_definitions`, plus le parent).
Voir architecture, section 6quater.

**Schéma de la Phase 3** (tranché avant la phase) :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `handle` | varchar | identifiant stable dans la partie : la référence pour un lieu unique (`paris`), référence + numéro pour un archétype (`tavern_2`) |
| `definition_reference` | varchar | référence de la définition instanciée |
| `parent_reference` | varchar, nullable | lieu unique englobant ; null pour une instance de lieu unique, dont le parent est porté par la définition |
| `name` | varchar, nullable | nom propre d'un lieu improvisé (« Orléans ») |
| `descriptor` | text, nullable | description courte en anglais, réservée au narrateur |
| `created_at` / `updated_at` | timestamptz | `created_at` vaut date de première visite |

- Contrainte d'unicité sur `(session_id, handle)` ; le numéro d'un archétype est attribué par
  le backend.
- Un lieu unique n'a qu'une instance par partie, créée à sa première visite.
- Le passage de `visited_locations` à `current_location_id` se fait par une migration
  `alterTable` qui reprend les lieux déjà visités des parties existantes.

### `npc_definitions` (Phase 5)

Catalogue fermé des PNJ, qui remplace la liste en dur de la Phase 3. Forme prévue :
`world_id`, `scenario_id` (nullable — une définition de scénario de même référence surcharge
celle de l'univers), `reference`, `kind` (`unique` / `archetype`), `generic` (archétype
générique servant aux PNJ improvisés), `description`, `default_disposition`, puis le profil
de combat (Phase 4, d'abord en dur). Unicité sur `(world_id, scenario_id, reference)`. Voir
architecture, section 6ter.

### `npc_instances`

État des PNJ tels qu'ils existent dans une partie précise, distinct de leur définition
(catalogue fermé : en dur dans la définition d'univers en Phase 3, table `npc_definitions` en
Phase 5). PNJ uniques, archétypes et PNJ improvisés y ont tous la même forme : un improvisé
est une instance d'archétype générique. Voir architecture, section 6ter.

**Schéma de la Phase 3** (tranché avant la phase) :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `handle` | varchar | identifiant stable dans la partie, seul moyen pour le LLM de désigner l'instance : la référence pour un unique (`treville`), référence + numéro pour un archétype (`cardinal_guard_2`) |
| `definition_reference` | varchar | référence de la définition instanciée |
| `name` | varchar, nullable | nom propre appris en cours de partie (« Jacques ») |
| `descriptor` | text, nullable | description courte en anglais, pour distinguer deux instances d'un même archétype |
| `disposition` | enum `npc_disposition` | `hostile` / `unfriendly` / `neutral` / `friendly` / `allied` — label qualitatif seul |
| `status` | enum `npc_status` | `present` / `absent` / `dead` |
| `created_at` / `updated_at` | timestamptz | — |

- Contrainte d'unicité sur `(session_id, handle)` ; le numéro d'un archétype est attribué par
  le backend, jamais par le LLM.
- Un unique n'a qu'une instance par partie : une réapparition la repasse `present`.
- Les instances ne sont jamais supprimées : un PNJ qui quitte la scène passe `absent`.
- La disposition initiale vient de la définition. L'extraction propose une disposition
  absolue, jamais un delta chiffré.

**Colonnes prévues plus tard** : points de vie de l'instance (Phase 4, avec les profils de
combat sur les définitions) ; `revealed_information` (jsonb, ce que ce PNJ a révélé au
joueur), quand un tour le lira ; `last_location`, si la mémoire long terme (Phase 7) rappelle
les PNJ connus d'un lieu.

---

## 4. Domaine "Historique et mémoire"

### `turn_log`

Log complet de chaque tour, table à plus forte volumétrie du système. Indispensable pour audit, debug, et reprise de partie.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `turn_number` | int, nullable | numéro séquentiel dans l'histoire, attribué quand le tour aboutit — `NULL` pour un tour `pending` ou `failed` |
| `idempotency_key` | uuid | clé fournie par le client à la soumission, unique par partie |
| `player_input` | text | texte brut soumis par le joueur |
| `arbitration_output` | jsonb | sortie complète de l'étape A+B+C (intent, validity, resolution, alerts) |
| `roll_result` | jsonb | détail du jet le cas échéant (compétence, dé, seuil, résultat, modificateurs appliqués avec leur origine) |
| `narrated_text` | text | sortie de l'étape D |
| `extraction_output` | jsonb, nullable | sortie validée de l'étape E, telle que proposée — avant application |
| `applied_effects` | jsonb | delta réellement appliqué au state après validation (étape E) |
| `rejected_attempts` | jsonb, nullable | sorties structurées refusées par la validation : étape, numéro de tentative, sortie reçue, motifs du rejet — conservées même quand la tentative suivante réussit |
| `status` | enum `turn_status` | `pending` / `completed` / `failed` — seul un tour `completed` fait partie de l'histoire |
| `failure` | jsonb | pour un tour `failed` uniquement : code et message montrés au joueur, étape et règles rejetées pour le diagnostic |
| `alerts` | jsonb | prompt injection suspectée, hors cadre, etc. |
| `llm_usage` | jsonb | jetons consommés par appel du tour (entrée, sortie, raisonnement), tentatives rejetées comprises ; chaque entrée porte son étape (`arbitration`, `narration`, `extraction`) et son numéro de tentative |
| `language` | text | langue de la partie pour ce tour |
| `created_at` | timestamp | — |

**Pourquoi tracer `language` à côté de `llm_usage`** : le coût réel d'un tour varie
sensiblement selon la langue (la tokenisation de l'anglais est plus dense — de l'ordre de 15 à
30 % d'écart pour le français, davantage pour les écritures non latines). Un coût moyen calculé
toutes langues confondues sous-estimerait mécaniquement les parties non anglophones, et
fausserait la réflexion sur le modèle de revenu. Cette colonne est à poser dès la Phase 1,
avec le tracking de consommation.

**Exemple de contenu `roll_result`**, avec traçabilité de l'origine de chaque modificateur :
```json
{
  "skill": "persuasion",
  "skill_value": 3,
  "applied_modifiers": [
    { "source": "contextual", "origin": "favorable_reputation", "value": 3 },
    { "source": "item", "origin": "recommendation_letter", "value": 2 }
  ],
  "total_modifiers": 5,
  "dice_roll": 14,
  "threshold": 12,
  "result": "success"
}
```

**Trace des tentatives rejetées** (tranché en Phase 3) : une colonne dédiée plutôt qu'un
champ dans la sortie de chaque étape. Une sortie refusée est par définition hors schéma et
n'a pas sa place parmi les sorties validées, et le taux de rejet se lit en un seul endroit.
Ses jetons restent dans `llm_usage`, sous le même couple étape / tentative : le coût d'un tour
est la somme de `llm_usage`, sans double comptage.

Index recommandé : `(session_id, turn_number)` pour la récupération rapide du buffer récent.

### `narrative_summaries`

Résumés hiérarchiques générés par le job asynchrone.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `level` | text | `scene` / `chapter` / `global` |
| `content` | text | résumé condensé, **toujours en anglais** quelle que soit la langue de la partie |
| `turn_start` / `turn_end` | int | plage de tours couverte |
| `created_at` | timestamp | — |

---

## 5. Domaine "Utilisateur et accès"

### `users`

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `email` | text | identifiant de connexion |
| `password_hash` | text | authentification |
| `role` | enum | `player` / `game_master` / `superadmin` |
| `preferences` | jsonb | préférences éventuelles (ton préféré, options d'affichage, langue) |
| `created_at` | timestamp | — |

### `usage_quotas` (optionnel, selon modèle économique)

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `user_id` | FK → users | joueur concerné |
| `period` | text/date | période de suivi (mois, jour) |
| `tokens_consumed` | bigint | suivi de consommation LLM |
| `turns_played` | int | suivi du nombre de tours |

---

## 6. Schéma relationnel synthétique

```
worlds ──┬── lore_fragments
         ├── scenarios ──── sessions ──┬── characters ──── inventory_items
         └── resolution_rules          │
               (world ou scenario)     ├── world_states (1:1)
                                        ├── npc_instances
                                        ├── turn_log
                                        └── narrative_summaries

users ──── sessions
users ──── usage_quotas (optionnel)
```

---

## 7. Recommandations PostgreSQL spécifiques

- **JSONB plutôt que JSON** systématiquement : permet l'indexation (GIN) et les requêtes sur clés internes si besoin de filtrer sur un champ précis d'une structure (ex: retrouver toutes les quêtes actives d'un certain type dans `world_states.active_quests`).
- **Index GIN sur les colonnes jsonb** interrogées régulièrement, en particulier `resolution_rules.specific_conditions` si des requêtes filtrent sur des sous-clés, et `world_states.narrative_flags` si le scénario a besoin de vérifier des conditions de progression.
- **Contrainte d'unicité** sur `world_states.session_id` pour garantir la relation 1:1 avec `sessions`.
- **pgvector** comme option native si le RAG est hébergé directement dans PostgreSQL plutôt que dans un vector store externe dédié — évite une dépendance d'infrastructure supplémentaire pour un volume de lore raisonnable, à réévaluer si le corpus devient très volumineux.
- **Partitionnement de `turn_log`** à envisager si le volume de parties/tours devient important (par exemple partition par `session_id` ou par plage temporelle), pour garder les performances de lecture sur les tours récents indépendantes du volume historique total.
- **Séparation lecture chaude / lecture froide** : `world_states`, `characters`, `npc_instances` sont lus à chaque tour (chemin critique) — `turn_log` et `narrative_summaries` sont surtout écrits en continu et lus ponctuellement (debug, reprise, génération de résumé) : ce sont des profils d'accès différents à garder en tête pour le dimensionnement des index.

---

## 8. Points ouverts / prochaines décisions

- Choix définitif du mécanisme RAG : pgvector intégré vs vector store externe (Pinecone, Qdrant, etc.).
- Politique de rétention/archivage de `turn_log` pour les parties terminées anciennes.
- Emplacement définitif du glossaire de noms propres : `scenarios.glossary` comme proposé ici, ou au niveau de `worlds` pour ce qui est commun à tous les scénarios d'un univers.
- Faut-il indexer `inventory_items.item_reference` — dépend du volume d'objets par personnage, probablement inutile avant la Phase 8.
- Stratégie de migration de schéma pour les colonnes jsonb (versionnement de structure interne si le format évolue avec de nouveaux univers).
