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
| `planned_npcs` | jsonb | PNJ types définis pour ce scénario (références, pas instances jouées) |
| `branch_points` | jsonb | points de bascule / choix narratifs possibles |
| `created_at` / `updated_at` | timestamp | — |

### `resolution_rules`

Barèmes de jeu paramétrables, table clé pour l'étape de résolution du pipeline LLM.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds | univers parent |
| `scenario_id` | FK → scenarios, nullable | scénario parent si la règle surcharge celle de l'univers |
| `action_type` | text | catégorie d'action (ex: `social_persuasion`, `melee_combat`, `offensive_spell`) |
| `associated_skill` | text | compétence utilisée pour cette catégorie |
| `difficulty_thresholds` | jsonb | seuils numériques par niveau qualitatif (`easy`/`medium`/`hard`/`very_hard`) |
| `possible_modifiers` | jsonb | liste de sources de bonus/malus avec valeur et description |
| `specific_conditions` | jsonb | règles particulières : prérequis stricts, conséquences d'échec/réussite critique, mécaniques propres au type d'action |
| `created_at` / `updated_at` | timestamp | — |

**Exemple de contenu `difficulty_thresholds`** :
```json
{ "easy": 7, "medium": 9, "hard": 11, "very_hard": 13 }
```

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

Index recommandé : `(world_id, action_type)` pour la résolution déterministe rapide côté backend.

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

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `character_id` | FK → characters | personnage parent |
| `item_name` | text | nom de l'objet |
| `description` | text | description |
| `mechanical_effects` | jsonb | bonus/malus liés à l'objet, appliqués à des compétences précises |
| `quantity` | int | quantité |
| `state` | text | `equipped` / `carried` / `other` |

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
- Ces valeurs sont **exclusivement calculées par le backend** au moment du jet (jointure entre la compétence utilisée et les objets du personnage qui la ciblent) — elles ne transitent jamais par un appel LLM et ne sont jamais proposées ou réinterprétées par le modèle.

### `world_states`

État évolutif du monde pour une partie donnée — table la plus critique, consultée à chaque tour du pipeline.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions (unique) | partie parente — relation 1:1 |
| `active_quests` | jsonb | liste des quêtes avec statut et étape courante |
| `narrative_flags` | jsonb | événements/booléens déclenchés (ex: `"noble_zone_access_granted": true`) |
| `visited_locations` | jsonb | historique et lieu courant |
| `world_objects` | jsonb | objets visibles dans le monde mais non ramassés (distincts de l'inventaire) |
| `updated_at` | timestamp | — |

### `npc_instances`

État des PNJ tels qu'ils existent dans une partie précise, distinct de leur définition générique dans `scenarios.planned_npcs`.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `npc_reference` | text | référence au PNJ type défini dans le scénario |
| `disposition` | jsonb | disposition envers le joueur (qualitative + valeur numérique) |
| `status` | text | `alive` / `dead` / `absent` / `present_in_scene` |
| `revealed_information` | jsonb | ce que ce PNJ a révélé au joueur au fil de la partie |

---

## 4. Domaine "Historique et mémoire"

### `turn_log`

Log complet de chaque tour, table à plus forte volumétrie du système. Indispensable pour audit, debug, et reprise de partie.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `turn_number` | int | numéro séquentiel du tour |
| `player_input` | text | texte brut soumis par le joueur |
| `arbitration_output` | jsonb | sortie complète de l'étape A+B+C (intent, validity, resolution, alerts) |
| `roll_result` | jsonb | détail du jet le cas échéant (compétence, dé, seuil, résultat, modificateurs appliqués avec leur origine) |
| `narrated_text` | text | sortie de l'étape D |
| `applied_effects` | jsonb | delta réellement appliqué au state après validation (étape E) |
| `alerts` | jsonb | prompt injection suspectée, hors cadre, etc. |
| `created_at` | timestamp | — |

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

Index recommandé : `(session_id, turn_number)` pour la récupération rapide du buffer récent.

### `narrative_summaries`

Résumés hiérarchiques générés par le job asynchrone.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `level` | text | `scene` / `chapter` / `global` |
| `content` | text | résumé condensé |
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
- Mécanisme de réconciliation entre `action_type` proposé librement par le LLM et les valeurs exactes existantes dans `resolution_rules` (validation stricte, fuzzy matching, ou liste fermée imposée au LLM).
- Stratégie de migration de schéma pour les colonnes jsonb (versionnement de structure interne si le format évolue avec de nouveaux univers).
