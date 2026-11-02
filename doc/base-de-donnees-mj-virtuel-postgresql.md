# Base de données — Logiciel de jeu de rôle piloté par LLM

## Document de référence technique — PostgreSQL

**Stack cible** : PostgreSQL, avec usage de colonnes JSONB pour les structures variables
**Complément** : recherche de lore par RAG (embeddings + vector store), hors du périmètre relationnel strict décrit ici pour la partie contenu narratif

> **⚠️ Convention de nommage** : conformément à la convention actée pour le projet, **tout le nommage technique est en anglais** — noms de tables, colonnes, valeurs d'enum, et clés à l'intérieur des structures JSONB. Le texte explicatif de ce document reste en français, mais chaque identifiant technique (table, colonne, clé JSON) est donné directement en anglais, sans traduction à faire a posteriori.

---

## 1. Principes de modélisation

- **Séparer structure fixe et contenu variable.** Les identifiants, clés étrangères et champs systématiquement présents restent en colonnes typées classiques. Les structures qui varient fortement d'un univers ou d'une action à l'autre (barèmes, modificateurs, conditions spécifiques) vont en `jsonb`.
- **Séparer contenu statique (réutilisable) et état dynamique (propre à une partie).** Un univers, un scénario, un lore fragment ou une règle de résolution existent indépendamment de toute partie jouée. Le state d'une partie, l'inventaire d'un personnage, le journal des tours n'existent qu'en lien avec une partie précise.
- **Les données mécaniques exactes ne passent jamais par une recherche sémantique.** Barèmes de difficulté, formules, chances de base sont récupérés par requête SQL déterministe (`WHERE world_id = ? AND action_type = ?`), jamais par similarité — contrairement au lore narratif qui, lui, relève du RAG.
- **Le LLM ne manipule jamais de valeurs numériques de règles.** Il propose des labels (`action_type`, `difficulty: "medium"`), le backend résout ces labels en valeurs réelles via les tables de règles.

---

## 2. Domaine "Contenu de jeu" (statique, réutilisable entre parties)

### `worlds`

Bible de contexte, indépendante de toute partie jouée. **Schéma de la Phase 5** : les listes
sans identité propre (compétences, ressources, règles, ambiance, glossaire) restent
en `jsonb`, lues et écrites avec l'univers ; les catalogues ont leurs tables.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `reference` | varchar, unique | référence anglaise stable (`three_musketeers`), immuable après création |
| `labels` | jsonb | noms d'affichage par langue, `en` obligatoire (`{ "en": "The Three Musketeers", "fr": "…" }`) |
| `narrative_tone` | text | une ligne, transmise à l'arbitrage et à la narration |
| `skills` | jsonb | `[{ reference, labels, category, baseChance }]` : catégorie du BRP (`combat`, `communication`, `manipulation`, `mental`, `perception`, `physical`) et chance de base, fixe (`25`) ou caractéristique × multiplicateur (`{ characteristic: "DEX", multiplier: 2 }`). Plus de colonne `attributes` depuis la Phase 6 : les sept caractéristiques sont celles du système |
| `resources` | jsonb | `[{ reference, labels }]` (ex. `purse`) |
| `glossary` | jsonb | `[{ reference, labels }]` : noms propres qui ne sont pas des entités du jeu (factions, figures hors scène) et leurs traductions |
| `created_by` | FK → users, nullable | auteur ; null pour le contenu que possède le seeder |
| `created_at` / `updated_at` | timestamptz | — |

- `rules` et `ambiance` (listes de phrases anglaises, de la Phase 5 à la Phase 7) deviennent
  en Phase 8 des fragments de lore sans tag, de `kind` `rule` et `ambiance`, de référence
  `rule_01`, `ambiance_01`… dans l'ordre d'écriture : voir `lore_fragments`.
- `general_rules` n'existe pas : il est éclaté en colonnes distinctes. `content_boundaries`
  (tabous) est différé à la modération de la Phase 14.
- **Les catégories d'action** vivent dans `resolution_rules` ; **les PNJ, lieux et objets**
  dans les trois tables de définitions.

### `lore_fragments`

Unités atomiques de connaissance sur un univers, **schéma de la Phase 8** : même forme que
les trois catalogues, au niveau de l'univers ou d'un scénario qui remplace le fragment de
l'univers de même référence. Filtrées par tags tirés de la scène (architecture, section 4).

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds (cascade) | univers |
| `scenario_id` | uuid, nullable | scénario qui surcharge ; clé étrangère composite `(scenario_id, world_id)` → `scenarios(id, world_id)`, comme les catalogues |
| `reference` | varchar | référence anglaise stable, immuable, unique par univers ou par scénario |
| `kind` | enum natif | `rule` (arbitrage seul), `ambiance` (narration seule), `fact` (les deux) |
| `content` | text | une ou quelques phrases en anglais, jamais traduites ni affichées |
| `tags` | text[] | références de lieux, de PNJ ou d'objets ; vide = toujours envoyé ; index GIN |
| `secret` | boolean | ne part qu'à l'arbitrage ; jamais vrai pour une `ambiance` |
| `created_at` / `updated_at` | timestamptz | — |

- Ni `labels`, ni embeddings : un fragment ne s'affiche pas, et la recherche par similarité
  n'est envisagée que si le volume de lore l'exige. Le cas échéant, une colonne
  `embedding vector(n)` (pgvector) s'ajouterait ici plutôt qu'une référence vers un store
  externe.
- Suppression toujours permise : aucune partie ne référence un fragment.
- Contrôles du backend, au formulaire comme à l'import : un tag doit désigner un lieu, un
  PNJ ou un objet de l'univers — ou du scénario, pour un fragment de scénario — sinon
  `unknown_tag` ; une `ambiance` secrète est refusée (`secret_ambiance`), en plus de la
  contrainte `CHECK` de la table. `checkScenario` signale aussi un tag orphelin à la
  publication (`unknown_tag`).

### `scenarios`

Trame narrative rattachée à un univers, d'où une partie est lancée. **Schéma de la Phase 5** :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds (cascade) | univers parent |
| `reference` | varchar | référence stable, unique dans l'univers, immuable |
| `labels` | jsonb | titre par langue, `en` obligatoire |
| `synopsis` | text | résumé anglais, montré dans le catalogue **New game** |
| `status` | enum `scenario_status` | `draft` / `published` ; seul un scénario publié est proposé aux joueurs |
| `chapters` | jsonb | `[{ reference, labels }]`, dans l'ordre ; sans conditions de progression à ce stade |
| `quests` | jsonb | `[{ reference, labels }]` |
| `pregenerated_character` | jsonb, nullable | le personnage copié dans chaque partie : `name`, `characteristics` (les sept du BRP), `skills` (en pourcentage, les seules compétences entraînées), `resources` (valeurs par référence), `items` (`definition`, `descriptor`, `quantity`, `equipped`). Pas de points de vie : ils se dérivent de CON et TAI au lancement de la partie |
| `initial_state` | jsonb, nullable | là où une partie commence : `location` (lieu unique), `chapter`, `quests` (`reference`, `step`, `summary`), `knownNpcs` facultatif (les PNJ uniques que le personnage connaît de nom au départ) |
| `start_time` | time, non nul, 08:00 par défaut | heure d'ouverture de l'histoire, à la minute (Phase 7) |
| `start_date` | date, nullable | date grégorienne d'ouverture, si l'histoire en a une (Phase 7) |
| `glossary` | jsonb | complète le glossaire de l'univers |
| `created_by` | FK → users, nullable | auteur |
| `created_at` / `updated_at` | timestamptz | — |

- Unicité sur `(world_id, reference)`, et sur `(id, world_id)` : cible des clés étrangères
  composites qui empêchent une définition ou une partie de nommer le scénario d'un autre
  univers.
- **Brouillon et publication** : un brouillon peut manquer de personnage ou d'état initial. La
  publication vérifie que le scénario tient debout (`checkScenario`, références, archétypes
  génériques, personnage, état initial, nom anglais partout) et renvoie la liste complète des
  incohérences ; la vérification est refaite au lancement de chaque partie.
- **Lancer une partie** copie le prétiré, l'état initial et le départ de l'horloge (heure et
  date) dans une partie neuve, dans une transaction : modifier ensuite le scénario ne décale
  pas une partie en cours. La création guidée de personnage attend la Phase 12.
- Différés : `branch_points`, conditions de progression des chapitres.

**`glossary`** fige la traduction des noms propres, pour éviter qu'un même nom soit rendu
différemment d'un tour à l'autre. Les noms des PNJ et des lieux viennent de leurs
définitions ; le glossaire ne porte que le reste. Seules ses entrées traduites dans la langue
du tour vont à la narration — quelques dizaines de jetons, contre des milliers si l'on
dupliquait tout le lore par langue.

### Définitions : `npc_definitions`, `location_definitions`, `item_definitions`

Les trois catalogues fermés, **de même forme** : une définition de l'univers (`scenario_id`
null), ou d'un scénario, qui **remplace la définition de l'univers de même référence** pour
les parties de ce scénario. Le tour lit l'univers résolu (`resolveWorld`). Voir architecture,
sections 6bis, 6ter et 6quater.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds (cascade) | univers |
| `scenario_id` | uuid, nullable | scénario qui surcharge ; clé étrangère composite `(scenario_id, world_id)` → `scenarios(id, world_id)` |
| `reference` | varchar | référence stable : ce que manipulent le code, l'état et le LLM ; immuable |
| `labels` | jsonb | noms par langue, `en` obligatoire |
| `description` | text | une ligne d'anglais pour le modèle, jamais affichée |
| `kind` | enum `definition_kind` | `unique` (une instance par partie au plus) / `archetype` |

Colonnes propres à chaque catalogue :

| Table | Colonnes |
|---|---|
| `npc_definitions` | `generic` (archétype servant aux PNJ improvisés), `default_disposition` (enum `npc_disposition`), `combat` (jsonb : `skills` en pourcentage, `hitPointsMax`, `weapon` — référence d'objet ou null —, et depuis la Phase 10 `damageModifier` — dés comme `+1D4`, ou null — et `armor`, l'armure ordinaire), `initial_location` (référence du lieu unique où un PNJ unique attend au début de la partie ; null sinon, et toujours pour un archétype — CHECK) |
| `location_definitions` | `parent` (lieu unique englobant ; null pour un archétype, qui reçoit son parent par instance) ; depuis la Phase 7, `exits` (jsonb, `[]` par défaut : `to`, `passage`, `backPassage`, `hidden`, `requires`, `oneWay`, `duration` — voir architecture, section 6quater) et `entrance` (booléen) |
| `item_definitions` | `generic`, `stackable`, `equippable`, `modifiers` (jsonb, voir `inventory_items`), `weapon` (jsonb, nullable depuis la Phase 6 : `kind` `melee` / `thrown` / `projectile` — à la place de `skill` depuis la Phase 10, la compétence venant de la catégorie d'action —, `damage` en dés comme `1D6+1`, `damageModifier` `full` / `half` / `none`, `special`), `armor` (int ≥ 0, Phase 10 : ce que l'objet arrête de chaque coup quand il est porté ; 0 pour ce qui n'est pas une armure), `initial_holder` (jsonb `{ holder: npc \| location, reference }`, pour un unique seulement) |

- Unicité de la référence parmi les définitions de l'univers, et parmi celles de chaque
  scénario (index uniques partiels) : une définition de scénario peut reprendre la référence
  d'une définition de l'univers — c'est ainsi qu'elle la surcharge.
- CHECK : un unique n'est ni générique ni empilable ; un archétype n'a ni parent ni détenteur
  initial, ni sortie, ni entrée. L'API le refuse en amont, sur le champ fautif (`kind_mismatch`).
- **Une définition qu'emploie une instance d'une partie ne se supprime pas** (`content_in_use`) ;
  libellés, description et mécanique restent modifiables et valent dès le tour suivant.

### `resolution_rules`

Barèmes de jeu paramétrables, table clé pour l'étape de résolution du pipeline LLM. Elle
rattache chaque catégorie d'action (`action_type`) à la compétence qui la résout : le LLM
d'arbitrage choisit la catégorie dans une liste fermée, le backend en déduit la compétence.

**Schéma de la Phase 5** — volontairement réduit à ce qu'un tour lit réellement :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `world_id` | FK → worlds (cascade) | univers (remplace `world_reference` en Phase 5) |
| `action_type` | varchar | catégorie d'action, référence anglaise stable (ex : `melee_combat`, `social_persuasion`) |
| `description` | text | une phrase anglaise sur ce que couvre la catégorie, transmise à l'arbitrage |
| `associated_skill` | varchar, nullable | référence d'une compétence de l'univers |
| `associated_characteristic` | enum `characteristic`, nullable | caractéristique jetée à × 5 (Phase 6) ; une contrainte impose exactement l'un des deux |
| `created_at` / `updated_at` | timestamptz | — |

Contrainte d'unicité sur `(world_id, action_type)`. `action_type` est un `varchar`, pas un
enum : la liste est propre à chaque univers, donc ouverte.

- **Pas de clé étrangère vers les compétences**, qui vivent dans `worlds.skills` : la
  publication d'un scénario vérifie que chaque `associated_skill` existe ; une
  caractéristique est un enum natif.
- **Lue avec l'univers** : les catégories font partie de la photo de l'univers prise au début
  du tour, comme le reste du contenu.
- **Pas de barème par ligne** : l'échelle de difficulté du BRP est fixe dans le code.
- **Édition** par le back-office ; le seeder de contenu écrit celles des univers en code
  (`database/content/`). Une catégorie qu'un jet journalisé a résolue ne se supprime pas.

**Colonnes envisagées plus tard**, ajoutées chacune par un `alterTable` quand un tour les lira :

| Colonne | Type | Contenu |
|---|---|---|
| `scenario_id` | FK → scenarios, nullable | scénario parent si la règle surcharge celle de l'univers |
| `specific_conditions` | jsonb | prérequis stricts, conséquences d'échec/réussite critique, mécaniques propres au type d'action |

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
| `world_id` | FK → worlds (restrict), non null | univers de la partie (Phase 5) |
| `scenario_id` | uuid, non null | scénario d'où la partie est lancée ; clé étrangère composite `(scenario_id, world_id)` → `scenarios(id, world_id)`, restrict |
| `status` | enum `session_status` | `in_progress` / `paused` / `completed` |
| `current_chapter` | varchar, nullable | référence du chapitre courant, parmi `scenarios.chapters` |
| `created_at` / `last_activity_at` | timestamptz | — |
| `deleted_at` | timestamptz, nullable | moment où le joueur a retiré la partie de sa liste ; null tant qu'elle y figure |

- **Suppression douce** : une partie supprimée par le joueur reste en base avec ses tours
  (coût des jetons compris), mais toute route de jeu — liste, lecture, tours, soumission,
  canal SSE — y répond comme à une partie inexistante (scope `listed` du modèle). Un tour déjà
  en cours se joue jusqu'au bout sans être vu. Elle continue d'empêcher la suppression du
  contenu avec lequel elle a été jouée.
- `world_id` et `scenario_id` sont arrivés `NOT NULL` **sans reprise de données** : la
  migration refuse de passer tant que des parties existent (`node ace game:reset --no-seed`).
- Le contenu avec lequel une partie a été jouée ne se supprime pas (restrict).

### `characters`

Le personnage joué dans une partie donnée.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions | partie parente |
| `characteristics` | jsonb | les sept caractéristiques du BRP (`STR`, `CON`, `SIZ`, `INT`, `POW`, `DEX`, `CHA`) |
| `skills` | jsonb | compétences entraînées, en pourcentage ; une compétence absente vaut sa chance de base |
| `hit_points` | int | PV courants |
| `hit_points_max` | int | PV maximum, dérivés de la fiche au lancement : `CON + SIZ` depuis la Phase 10 (provisoire, Phase 13) |
| `bleeding` | bool | saigne d'un coup reçu : 1 PV par round de combat, jusqu'aux premiers soins ou la fin du combat (Phase 10) |
| `first_aid_available` | bool | une blessure reçue depuis la dernière tentative de premiers soins : une tentative par blessure (Phase 10) |
| `healing_since` | int, nullable | horloge de jeu d'où la guérison naturelle compte ses semaines ; null à PV pleins (Phase 10) |
| `resources` | jsonb | autres ressources courantes (mana, endurance, etc.) |
| `progression` | jsonb | niveau, expérience si applicable |
| `created_at` / `updated_at` | timestamp | — |

**Exemple de contenu `characteristics`** : `{ "STR": 13, "CON": 14, "SIZ": 12, "INT": 13, "POW": 12, "DEX": 16, "CHA": 14 }`
**Exemple de contenu `skills`** : `{ "swordsmanship": 60, "persuasion": 45, "athletics": 30 }`

### `inventory_items`

Objets d'une partie, où qu'ils soient : chez le personnage, aux mains d'un PNJ ou rangés dans
un lieu. Une ligne est une **instance** qui pointe vers une **définition** d'objet et ne porte
que l'état propre à l'instance. Voir architecture, section 6bis.

**Définitions d'objets.** En dur dans la définition d'univers en Phase 4, comme les PNJ et les
lieux ; en base depuis la Phase 5 (`item_definitions`, section 2). Chaque définition porte :

| Champ | Contenu |
|---|---|
| `reference` | **référence stable en anglais** (ex. `letter_to_treville`) — c'est elle que manipulent le code et le LLM |
| `labels` | noms d'affichage par langue, `en` obligatoire (Phase 5 ; un seul libellé anglais en Phase 4) |
| `description` | une ligne d'anglais pour le modèle, jamais affichée |
| `kind` | `unique` (une instance au plus par partie) ou `archetype` |
| `generic` | archétype servant aux objets improvisés (`improvised_weapon`, `rope`…) |
| `stackable` | archétype interchangeable : une ligne par détenteur, avec une quantité |
| `equippable` | peut passer `equipped` |
| `modifiers` | modificateurs fixes, chacun ciblant une compétence ou les dégâts, avec une condition |
| `initial_holder` | pour un unique seulement, facultatif : le PNJ unique ou le lieu unique qui le détient au départ |

**Schéma de la table** (tranché à l'ouverture de la Phase 4) :

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant technique de la ligne |
| `session_id` | FK → sessions | partie parente |
| `character_id` | FK → characters, nullable | détenteur : le personnage |
| `npc_instance_id` | FK → npc_instances, nullable | détenteur : un PNJ |
| `location_instance_id` | FK → location_instances, nullable | détenteur : un lieu |
| `handle` | varchar, nullable | exemplaire non empilable : identifiant stable dans la partie, attribué par le backend (la référence pour un unique, `rapier_2` pour un archétype) ; null pour un empilable |
| `definition_reference` | varchar | référence de la définition instanciée |
| `descriptor` | text, nullable | description courte en anglais d'un objet improvisé, réservée au narrateur, jamais traduite ni affichée |
| `quantity` | int | ≥ 1 tant que l'objet existe, toujours 1 pour un exemplaire non empilable ; 0 une fois `gone` (CHECK) |
| `state` | enum `item_state` | `carried` / `equipped` / `gone` |
| `created_at` / `updated_at` | timestamptz | — |

- **Exactement un détenteur** (CHECK), sauf pour un objet `gone`. Trois vraies clés étrangères
  plutôt qu'un couple polymorphe `holder_type` / `holder_id`, qui n'aurait aucune intégrité
  référentielle.
- **L'identité d'un objet ne dépend pas de son détenteur** : un exemplaire garde son handle
  quand il change de mains, et ce handle est unique dans la partie. Un empilable compte au plus
  une ligne par détenteur et par définition (index uniques partiels) : vingt balles données à un
  PNJ font deux lignes, une quantité de chaque côté.
- **Changer de détenteur n'est pas perdre.** Donner, voler, cacher, poser, ramasser sont des
  transferts. `gone` est réservé à l'objet détruit ou consommé ; une ligne n'est jamais
  supprimée, comme un PNJ passe `absent`.
- **`equipped` est réservé au personnage** en Phase 4 (CHECK) ; l'équipement d'un PNJ arrive
  avec ses jets, en Phase 10.
- **Placement initial** : un unique doté d'un `initial_holder` est instancié avec lui à la
  première instanciation de ce détenteur (entrée en scène du PNJ, première visite du lieu) ;
  sans détenteur initial, il est instancié à son premier gain.
- **À la mort d'un PNJ**, ses objets passent dans l'inventaire du lieu courant : un PNJ mort
  sort de la scène, et le pillage devient un transfert depuis le lieu.
- **Durabilité et charges** : différées. Le modèle d'instance permettra de les ajouter par un
  `alterTable` le moment venu.

**Pourquoi séparer référence et nom affiché** : sans référence stable, rien n'empêche le LLM
de désigner le même objet par « the letter », puis « recommendation letter », puis — en partie
non anglophone — par son nom traduit. La référence est l'identité de l'objet pour le code ; le
libellé est ce que voit l'humain. Une ligne d'instance ne stocke **aucun nom** : le passage aux
noms par langue, en Phase 5, ne demandera aucune migration de données de parties. À l'étape de
narration, **seule la langue de la partie est injectée**, jamais la table complète des
traductions.

**Structure de `modifiers`** : liste de modificateurs fixes, en pourcentage, chacun ciblant une
compétence, avec une condition d'activation. Depuis la Phase 6, une arme ne porte plus de bonus
de dégâts : ses dés sont dans son profil d'arme (`weapon`).

```json
[
  { "target": "skill", "skill": "persuasion", "value": 20, "condition": "owned", "description": "Recognised official seal" },
  { "target": "skill", "skill": "fine_manipulation", "value": 20, "condition": "equipped", "description": "Locksmith's picks" },
  { "target": "skill", "skill": "stealth", "value": -20, "condition": "equipped", "description": "Heavy, noisy armour" }
]
```

- `condition: "owned"` — le bonus s'applique dès que l'objet est détenu (`carried` ou `equipped`), sans besoin d'être activement porté (ex : un document, une lettre).
- `condition: "equipped"` — le bonus ne s'applique que si l'instance est `equipped` (ex : un outil en main, une armure).
- Les modificateurs d'une même définition ne comptent **qu'une fois par jet**, quel que soit le nombre d'exemplaires détenus.
- Le champ `description` **interne à un modificateur reste en anglais** et n'est jamais traduit : il sert l'audit et le debug (« pourquoi ce bonus s'applique-t-il ? »). Sans cette distinction, on finit par traduire des données de debug.
- Ces valeurs sont **exclusivement calculées par le backend** au moment du jet ou des dégâts, à partir des objets du détenteur — elles ne transitent jamais par un appel LLM et ne sont jamais proposées ou réinterprétées par le modèle.

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
| `game_time` | int, non nul | horloge de jeu : secondes depuis minuit du premier jour (Phase 7). Heure, période, jour et date en dérivent, jamais stockés |
| `start_date` | date, nullable | date d'ouverture copiée du scénario au lancement (Phase 7) |
| `known_npcs` | jsonb, non nul, `[]` par défaut | références des PNJ uniques dont le personnage connaît le nom, dans l'ordre où il les a appris : ceux de `initialState.knownNpcs`, copiés au lancement, puis ceux qui se présentent en jeu. Les parties lancées avant la colonne ont reçu les uniques déjà rencontrés. Voir architecture, section 6ter |
| ~~`world_objects`~~ | — | **retiré en Phase 4** : les objets du monde sont les lignes d'`inventory_items` détenues par un lieu ou un PNJ |
| `updated_at` | timestamp | — |

### `location_instances`

Lieux tels qu'ils existent dans une partie : lieux uniques visités et lieux d'archétype
improvisés, sous une même forme. Définitions en dur dans la définition d'univers en Phase 3,
en base depuis la Phase 5 (`location_definitions`, section 2).
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

### `npc_instances`

État des PNJ tels qu'ils existent dans une partie précise, distinct de leur définition
(catalogue fermé : en dur dans la définition d'univers en Phase 3, table `npc_definitions`
depuis la Phase 5). PNJ uniques, archétypes et PNJ improvisés y ont tous la même forme : un improvisé
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
| `status` | enum `npc_status` | `present` / `absent` / `dying` (Phase 10) / `dead` |
| `created_at` / `updated_at` | timestamptz | — |

- Contrainte d'unicité sur `(session_id, handle)` ; le numéro d'un archétype est attribué par
  le backend, jamais par le LLM.
- Un unique n'a qu'une instance par partie : une réapparition la repasse `present`.
- Les instances ne sont jamais supprimées : un PNJ qui quitte la scène passe `absent`.
- **Placement initial** : un unique doté d'un `initial_location` (définition) est instancié
  `absent` dans ce lieu à la première visite de celui-ci, puis rendu `present` par l'arrivée du
  joueur — comme un objet doté d'un `initial_holder` naît avec son détenteur.
- La disposition initiale vient de la définition. L'extraction propose une disposition
  absolue, jamais un delta chiffré.

**Ajouté en Phase 4** : `hit_points` (int, nullable), initialisé depuis le profil de combat de
la définition à l'instanciation ; null sur une instance antérieure, lu comme « indemne ». Les
objets qu'un PNJ détient sont des lignes d'`inventory_items`.

**Ajouté en Phase 7** : `location_instance_id` (FK → location_instances, nullable, `on delete
set null`) — le lieu où se trouve le PNJ quand la scène n'est plus avec lui : celui où il a été
laissé, null s'il est parti de lui-même. À l'arrivée du joueur dans un lieu, les PNJ absents qui
s'y trouvent repassent `present`. La migration place les PNJ présents dans le lieu courant de
leur partie ; les absents restent sans lieu.

**Ajouté en Phase 10** : `bleeding` et `first_aid_available` (bool), comme sur `characters` ; la
valeur `dying` de `npc_status` — un PNJ ramené à 0 point de vie reste dans la scène un tour, et
meurt à l'application du tour suivant (un aparté excepté) sauf premiers soins réussis. Un
archétype attaqué avant d'être introduit est instancié par le backend dans la transaction du
tour (architecture, section 6ter). La migration recalcule les PV des parties en cours
(`hit_points_max = CON + SIZ`, dégâts subis conservés) et convertit les profils déjà en base.

**Colonne prévue plus tard** : `revealed_information` (jsonb, ce que ce PNJ a révélé au
joueur), quand un tour le lira.

### `passage_states`

Ce qu'une partie a appris de ses passages (Phase 7) : une ligne par passage dont l'état a
changé, partagée par ses deux sens. Écrite par le seul service des passages. Voir architecture,
section 6quater.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions (cascade) | partie parente |
| `from_reference` / `to_reference` | varchar | le passage tel que déclaré : le lieu qui le déclare et celui où il mène. Au plus un passage joint deux lieux, la paire le nomme |
| `discovered_at` | timestamptz, nullable | passage caché trouvé |
| `unlocked_at` | timestamptz, nullable | passage verrouillé ouvert, pour de bon |
| `created_at` / `updated_at` | timestamptz | — |

- Unicité sur `(session_id, from_reference, to_reference)`.

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
| `roll_result` | jsonb | détail du jet le cas échéant (compétence ou caractéristique, chance, d100, degré, modificateurs appliqués avec leur origine) |
| `narrated_text` | text | sortie de l'étape D |
| `extraction_output` | jsonb, nullable | sortie validée de l'étape E, telle que proposée — avant application |
| `applied_effects` | jsonb | delta réellement appliqué au state après validation (étape E) |
| `rejected_attempts` | jsonb, nullable | sorties structurées refusées par la validation : étape, numéro de tentative, sortie reçue, motifs du rejet — conservées même quand la tentative suivante réussit |
| `status` | enum `turn_status` | `pending` / `completed` / `failed` — seul un tour `completed` fait partie de l'histoire |
| `failure` | jsonb | pour un tour `failed` uniquement : code et message montrés au joueur, étape et règles rejetées pour le diagnostic |
| `alerts` | jsonb | prompt injection suspectée, hors cadre, etc. |
| `llm_usage` | jsonb | jetons consommés par appel du tour (entrée, sortie, raisonnement), tentatives rejetées comprises ; chaque entrée porte son étape (`arbitration`, `narration`, `extraction`) et son numéro de tentative |
| `language` | text | langue de la partie pour ce tour |
| `game_time_before` / `game_time_after` | int, nullable | horloge de jeu de part et d'autre du tour (Phase 7) ; null avant la Phase 7 ou pour un tour mort avant l'arbitrage |
| `duration` | jsonb, nullable | durée proposée par l'arbitrage : label, avec `count` ou `period` (Phase 7) |
| `lore_sent` | jsonb, nullable | références des fragments de lore envoyés, par étape : `{ arbitration, narration }`, une étape non atteinte valant `null` (Phase 8) ; null pour un tour mort avant l'arbitrage ou joué avant la Phase 8 |
| `combat_result` | jsonb, nullable | le round de combat joué (Phase 10) : chaque coup, chaque défense et chaque jet — ceux des PNJ compris, que le joueur ne voit jamais —, dégâts, effets, maladresses, armes perdues, état des deux camps, et l'archétype instancié pour l'occasion |
| `first_aid` | jsonb, nullable | les premiers soins donnés (Phase 10) : cible, degré, s'il restait une blessure à soigner, PV rendus, mourant sauvé |
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
  "actionType": "social_persuasion",
  "base": { "kind": "skill", "skill": "persuasion", "value": 45 },
  "baseChance": 45,
  "difficulty": "average",
  "appliedModifiers": [
    { "source": "contextual", "origin": "favorable_reputation", "effect": "major_bonus", "value": 20 },
    { "source": "item", "origin": "recommendation_letter", "value": 10 }
  ],
  "chance": 75,
  "roll": 12,
  "result": "success",
  "degree": "special"
}
```

**Trace des tentatives rejetées** (tranché en Phase 3) : une colonne dédiée plutôt qu'un
champ dans la sortie de chaque étape. Une sortie refusée est par définition hors schéma et
n'a pas sa place parmi les sorties validées, et le taux de rejet se lit en un seul endroit.
Ses jetons restent dans `llm_usage`, sous le même couple étape / tentative : le coût d'un tour
est la somme de `llm_usage`, sans double comptage.

Index recommandé : `(session_id, turn_number)` pour la récupération rapide des tours qu'aucun
résumé ne couvre, lus à chaque tour.

### `narrative_summaries`

Résumés hiérarchiques générés par le job asynchrone, dans sa propre file (Phase 9, roadmap
« Décisions de cadrage » ; architecture, section 5). Écrits une fois, jamais modifiés : un
nouveau résumé d'un niveau remplace le précédent dans le contexte, l'ancien reste en base.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `session_id` | FK → sessions, `ON DELETE CASCADE` | partie parente |
| `level` | enum natif `narrative_summary_level` | `scene` (un bloc de tours) / `global` (glissant, absorbe les `scene` les plus anciens). Pas de `chapter` : le chapitre ne change jamais en cours de partie |
| `content` | text | résumé condensé, **toujours en anglais** quelle que soit la langue de la partie |
| `turn_start` / `turn_end` | int | plage de `turn_log.turn_number` couverte, bornes comprises ; `1` pour un `global` |
| `llm_usage` | jsonb | les appels qui l'ont écrit, sous la forme de `turn_log.llm_usage` (étape `summary`) : un résumé n'appartient à aucun tour, et `llm:cost` le compte dans le coût d'une partie |
| `created_at` | timestamptz | — |

Contraintes : `1 ≤ turn_start ≤ turn_end` ; unicité `(session_id, level, turn_end)` — une plage
n'est résumée qu'une fois par niveau, même par un job lancé deux fois, et c'est aussi ce qui
retrouve le dernier résumé d'un niveau.

---

## 5. Domaine "Utilisateur et accès"

### `users`

| Colonne | Type | Contenu |
|---|---|---|
| `id` | uuid | identifiant |
| `full_name` | varchar, nullable | nom affiché |
| `email` | varchar(254), unique | identifiant de connexion |
| `password` | varchar | hash du mot de passe |
| `role` | enum `user_role` | `player` (défaut) / `game_master` / `superadmin` ; un seul par compte |
| `suspended_at` | timestamptz, nullable | date de suspension ; null pour un compte actif (Phase 5bis) |
| `created_at` / `updated_at` | timestamptz | — |

- **Suspension** : un compte suspendu ne se connecte plus, et sa session déjà ouverte est
  coupée à la requête suivante — la session est un cookie chiffré, impossible à révoquer côté
  serveur, l'état du compte est donc relu à chaque requête. Ses parties sont conservées.
- **Pas de suppression de compte** ni de changement de rôle à ce stade.
- **Envisagé plus tard** : `preferences` (jsonb : langue, options d'affichage), avec le choix
  de langue de la Phase 14.

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
worlds ──┬── resolution_rules
         ├── npc_ / location_ / item_definitions ──┐ (univers, ou scénario qui surcharge)
         ├── lore_fragments (Phase 8) ─────────────┤ (idem)
         └── scenarios ────────────────────────────┘
               └── sessions ──┬── characters ─────────┐
                              ├── npc_instances ──────┼── inventory_items
                              ├── location_instances ─┘   (un détenteur parmi trois)
                              ├── world_states (1:1)
                              ├── passage_states (Phase 7)
                              ├── turn_log
                              └── narrative_summaries (Phase 9)

users ──── sessions
users ──── worlds, scenarios (created_by)
users ──── usage_quotas (optionnel)
```

---

## 7. Recommandations PostgreSQL spécifiques

- **JSONB plutôt que JSON** systématiquement : permet l'indexation (GIN) et les requêtes sur clés internes si besoin de filtrer sur un champ précis d'une structure (ex: retrouver toutes les quêtes actives d'un certain type dans `world_states.active_quests`).
- **Index GIN sur les colonnes jsonb** interrogées régulièrement, en particulier `resolution_rules.specific_conditions` si des requêtes filtrent sur des sous-clés, et `world_states.narrative_flags` si le scénario a besoin de vérifier des conditions de progression.
- **Contrainte d'unicité** sur `world_states.session_id` pour garantir la relation 1:1 avec `sessions`.
- **pgvector** comme option native si le RAG est hébergé directement dans PostgreSQL plutôt que dans un vector store externe dédié — évite une dépendance d'infrastructure supplémentaire pour un volume de lore raisonnable, à réévaluer si le corpus devient très volumineux.
- **Partitionnement de `turn_log`** à envisager si le volume de parties/tours devient important (par exemple partition par `session_id` ou par plage temporelle), pour garder les performances de lecture sur les tours récents indépendantes du volume historique total.
- **Séparation lecture chaude / lecture froide** : `world_states`, `characters`, `npc_instances` sont lus à chaque tour (chemin critique) — `turn_log` et `narrative_summaries` sont surtout écrits en continu ; à chaque tour, on n'en lit que les quelques lignes de la mémoire (les résumés d'une partie, les tours qu'ils ne couvrent pas), le reste ponctuellement (debug, reprise, génération de résumé, pages du journal) : ce sont des profils d'accès différents à garder en tête pour le dimensionnement des index.

---

## 8. Points ouverts / prochaines décisions

- Choix définitif du mécanisme RAG : pgvector intégré vs vector store externe (Pinecone, Qdrant, etc.).
- Politique de rétention/archivage de `turn_log` pour les parties terminées anciennes.
- ~~Emplacement définitif du glossaire~~ — tranché en Phase 5 : univers, complété par le scénario, réduit aux noms propres qui ne sont pas des entités.
- Faut-il indexer `inventory_items.definition_reference` — dépend du volume d'objets par partie, probablement inutile avant la Phase 10.
- Stratégie de migration de schéma pour les colonnes jsonb (versionnement de structure interne si le format évolue avec de nouveaux univers) — différée en Phase 5 : chaque `jsonb` saisi est validé côté backend, et aucune donnée de production n'existe encore.
