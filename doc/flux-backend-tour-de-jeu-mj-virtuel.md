# Flux backend d'un tour de jeu — MJ virtuel

## Document de référence technique

**Objet** : décrire, sous forme d'organigrammes, le fonctionnement **cible** du backend une
fois la roadmap achevée (Phase 9) — de l'action écrite par le joueur jusqu'à la réponse finale
reçue par le front.

**Ce que ce document n'est pas** : une nouvelle source de décisions. Il assemble ce qui est
déjà tranché dans les autres documents, qui restent la source de vérité. En cas de
divergence, ce sont eux qui font foi. Les renvois entre crochets pointent vers eux :

- [archi §x] — `architecture-mj-virtuel-llm.md`
- [BDD] — `base-de-donnees-mj-virtuel-postgresql.md`
- [règles §x] — `systeme-regles-jeu-mj-virtuel.md`
- [roadmap Px] — `roadmap-mj-virtuel-llm.md`
- [front §x] — `cahier-des-charges-front-mj-virtuel.md`

Les éléments encore ouverts sont signalés comme tels, en fin de document et dans les
diagrammes (libellé *« à trancher »*).

**Lecture des diagrammes** :

| Forme | Signification |
|---|---|
| Rectangle | Traitement déterministe du backend |
| Hexagone `{{ }}` | Appel au LLM (via le LLM Gateway) |
| Losange | Décision du backend |
| Cylindre | Lecture ou écriture PostgreSQL |
| Parallélogramme `[/ /]` | Événement SSE envoyé au front |
| Arrondi | Entrée ou sortie du flux |

Les identifiants (tables, colonnes, événements, champs JSON) sont en anglais, comme dans le
code.

---

## 1. Vue d'ensemble

Un tour se déroule en **deux temps** découplés par la file de jobs :

1. **La soumission**, synchrone, dans un process HTTP : elle enregistre le tour et répond
   immédiatement `202`.
2. **L'exécution**, asynchrone, dans un worker : elle joue le pipeline et informe le front
   par SSE au fil des étapes.

```mermaid
flowchart TD
    P([Joueur : texte libre]) --> F[Front : POST /sessions/:id/turns<br/>+ clé d'idempotence]
    F --> S["§2 — Soumission<br/>(process HTTP)"]
    S -->|202 + identifiant du tour| F
    S -->|job : identifiant du tour seul| Q[(File de jobs<br/>BullMQ)]
    Q --> W["§3 — Exécution du tour<br/>(worker)"]

    subgraph pipeline [Pipeline — un appel LLM par responsabilité]
        W --> C0[Étape 0 — Préparation du contexte<br/>SQL + lore par tags + mémoire]
        C0 --> ABC{{Étape 1 — A+B+C<br/>arbitrage}}
        ABC --> R[Étape 2 — Calcul du jet<br/>si requis]
        R --> D{{Étape 3 — D<br/>narration streamée}}
        D --> E{{Étape 4 — E<br/>extraction des effets}}
        E --> V[Étape 5 — Validation + application<br/>transaction du tour]
    end

    ABC -.-> SSE1[/step_started arbitration/]
    R -.-> SSE2[/roll_resolved/]
    D -.-> SSE3[/step_started narration<br/>+ narration_chunk.../]
    V -.-> SSE4[/turn_completed/]
    pipeline -.->|toute erreur| SSE5[/turn_failed/]

    SSE1 & SSE2 & SSE3 & SSE4 & SSE5 -.-> T[Transmit<br/>canal sessions/:id]
    T -.-> F

    V --> J{Seuil de résumé<br/>atteint ?}
    J -->|oui| Q2[(File : job résumé)]
    Q2 --> SUM["§9 — Régénération du résumé<br/>(hors chemin critique)"]
```

**Invariants qui traversent tout le flux** [CLAUDE.md, archi §7] :

- **Le LLM propose, le backend décide** : dés, seuils, formules et écriture du state sont
  déterministes, côté backend.
- **Aucune confiance dans une sortie LLM** : toute sortie structurée est validée avant usage.
- **Listes fermées** : le LLM ne désigne une entité (compétence, catégorie d'action, PNJ,
  lieu, objet, flag) que par une référence issue d'une liste transmise dans le contexte.
- **Le narrateur ne voit jamais de chiffres** : uniquement `result` + marge qualitative.
- **Tout en anglais en interne** : seule la narration (D) est produite dans la langue du
  joueur.
- **Rien de ce qui garantit l'intégrité d'un tour ne dépend de la file** : idempotence,
  sérialisation et événements SSE vivent dans le code du tour et en base.

---

## 2. Soumission — process HTTP

```mermaid
flowchart TD
    A([POST /sessions/:id/turns<br/>player_input + idempotency_key]) --> B{Session du joueur<br/>valide ?<br/>cookie + CSRF}
    B -->|non| B1([401 / 403])
    B -->|oui| C{La partie appartient-elle<br/>au joueur connecté ?}
    C -->|non| C1([404])
    C -->|oui| D{Entrée valide ?<br/>longueur, clé présente}
    D -->|non| D1([422])
    D -->|oui| E[(turn_log : clé déjà connue<br/>pour cette partie ?)]
    E -->|oui| E1([202 — accusé du tour existant<br/>aucune nouvelle mise en file])
    E -->|non| F[(INSERT turn_log<br/>status = pending<br/>idempotency_key, player_input, language)]
    F --> G{Mise en file réussie ?}
    G -->|non| G1[(turn_log : failed<br/>turn_queue_unavailable)]
    G1 --> G2([503])
    G -->|oui| H([202 — accusé du tour<br/>identifiant du tour])
```

- **La clé est enregistrée avant la mise en file** : un doublon arrivant pendant l'exécution
  du tour retrouve la ligne `pending` et reçoit le même accusé [roadmap P2].
- **Aucun numéro de tour à ce stade** : il est attribué dans la transaction qui applique les
  effets. Un tour `pending` ou `failed` n'en a jamais [roadmap P2, KAN-17].
- **Le job ne transporte que l'identifiant du tour** ; tout le reste est relu en base par le
  worker.
- Le front s'est abonné au canal `sessions/:id` **avant** de soumettre : aucun événement ne
  peut partir avant l'abonnement [archi §8bis].

---

## 3. Exécution — prise en charge par le worker

```mermaid
flowchart TD
    A([Job : identifiant du tour]) --> B[pg_advisory_xact_lock<br/>sur session_id]
    B --> C[(Relire le tour)]
    C --> D{status = pending ?}
    D -->|non : déjà réglé,<br/>par le balayage le plus souvent| D1([Fin silencieuse<br/>aucun événement])
    D -->|oui| E[Démarrer le budget du tour<br/>3 minutes]
    E --> F[Étape 0 — Préparation du contexte<br/>§4]
    F --> G[Étapes 1 à 5<br/>§5 à §7]
```

- **Sérialisation par partie** : un verrou PostgreSQL par `session_id` garantit que deux tours
  d'une même partie ne s'exécutent jamais en même temps, quel que soit le nombre de workers
  [archi §8bis]. Deux parties différentes s'exécutent en parallèle.
- **Budget de temps** : chaque appel LLM reçoit un `AbortSignal` limité à
  `min(timeout d'un appel, temps restant)`. Budget épuisé = échec `llm_timeout` [archi §8bis].
- **Pas de retry de la file** : un job échoué ne rejoue jamais ; c'est le joueur qui soumet à
  nouveau, avec une nouvelle clé.

---

## 4. Étape 0 — Préparation du contexte

Trois natures de données, trois mécanismes de sélection — jamais confondus [archi §4].

```mermaid
flowchart LR
    subgraph sources [Sources]
        ST[(State — SQL déterministe<br/>characters, world_states,<br/>npc_instances present,<br/>location_instances courant,<br/>inventory_items)]
        LO[(Lore — filtrage par tags<br/>lore_fragments<br/>RAG seulement si le volume l'exige)]
        ME[(Mémoire<br/>dernier narrative_summary<br/>+ N derniers tours)]
        CA[(Catalogues fermés<br/>resolution_rules,<br/>npc_definitions,<br/>location_definitions,<br/>définitions d'objets)]
    end

    ST --> K1[Contexte A+B+C]
    LO -->|règles| K1
    ME -->|résumé anglais<br/>+ buffer court : 2 tours| K1
    CA -->|action_types + descriptions,<br/>handles et références| K1

    ST --> K2[Contexte D]
    LO -->|ambiance du lieu| K2
    ME -->|résumé<br/>+ buffer récent : 2 à 4 tours| K2
    CA -->|noms d'affichage<br/>langue de la partie<br/>+ glossaire| K2

    CA -->|listes fermées| K3[Contexte E]
```

| Étape | Lore | State | Mémoire | Catalogues |
|---|---|---|---|---|
| A+B+C | Règles ciblées par les tags | Scène : lieu courant, PNJ présents, objets pertinents (références anglaises, **sans valeurs mécaniques ni valeurs de compétence**) | Résumé anglais + buffer court (2 derniers tours, langue du joueur) | `action_types` avec descriptions |
| Calcul du jet | — | Compétence du personnage, inventaire complet avec effets mécaniques | — | `resolution_rules` |
| D | Ambiance liée au lieu | Scène complète | Résumé + buffer récent (2–4 tours, langue du joueur) | Noms d'affichage dans la langue de la partie, glossaire |
| E | Aucun | Handles présents, schéma des effets autorisés (pas les valeurs actuelles) | Aucune | Listes fermées de définitions (PNJ, lieux, objets, flags) |

Toutes les sélections sont déterministes : aucune n'est déléguée au LLM.

---

## 5. Étape 1 — A+B+C : arbitrage

### 5.1 Toute étape à sortie JSON — la nouvelle tentative unique

Ce mécanisme s'applique à l'arbitrage (A+B+C) comme à l'extraction (E) [archi §7].

```mermaid
flowchart TD
    A([Contexte de l'étape]) --> B[Construire le message<br/>system prompt statique<br/>+ données cadrées comme données de jeu]
    B --> C{{LLM Gateway<br/>generateJson}}
    C -->|timeout, API injoignable,<br/>erreur HTTP| X([Échec du tour<br/>llm_timeout / llm_unreachable /<br/>llm_http_error<br/>jamais retenté])
    C -->|réponse| D{Validation backend<br/>JSON lisible, schéma,<br/>bornes, listes fermées}
    D -->|valide| OK([Sortie validée])
    D -->|rejet| E{Première tentative ?}
    E -->|oui| F[(turn_log : trace de la tentative<br/>sortie, motifs, tokens)]
    F --> G[Message correctif du backend<br/>valeurs rejetées + listes valides<br/>cadré comme donnée de jeu]
    G --> C
    E -->|non| Y([Échec du tour<br/>llm_invalid_output /<br/>turn_validation_failed])
```

### 5.2 Arbitrage

```mermaid
flowchart TD
    A([Contexte A+B+C]) -.-> SSE[/step_started arbitration/]
    A --> B{{A+B+C — sortie JSON<br/>§5.1}}
    B --> C["intent, validity,<br/>resolution { mode, action_type,<br/>difficulty, contextual_modifiers },<br/>alert"]
    C --> D[(turn_log : arbitration_output,<br/>alerts, llm_usage)]
    D --> E{resolution.mode}
    E -->|automatic_success| N[Issue fixée : succès<br/>pas de jet]
    E -->|narrative_automatic_failure| M[Issue fixée : échec<br/>pas de jet]
    E -->|roll_required| R[Étape 2 — Calcul du jet<br/>§6]
    N --> D2[Étape 3 — Narration]
    M --> D2
    R --> D2
```

- **L'arbitrage ne narre jamais** et ne produit aucun chiffre de règle [archi §6].
- **`action_type`**, pas de compétence : le backend déduit la compétence via
  `resolution_rules` [BDD].
- **Au plus 2 à 3 modificateurs contextuels**, jamais un modificateur d'objet [règles §5].
  *À trancher en Phase 4 : le chiffrage des modificateurs contextuels (valeur proposée par le
  LLM, ou label qualitatif converti par le backend).*
- **`alert.prompt_injection_suspected`** est enregistré dans `turn_log.alerts`. L'action
  suspecte est traitée comme invalide, mais **la sécurité ne repose pas sur cette détection** :
  le confinement est assuré par la validation backend, qui ne fait jamais confiance au modèle
  [roadmap, stratégie de test].
- **Le joueur n'est jamais bridé** : une action imprudente ou immorale est résolue
  normalement, jamais refusée [règles §10].

---

## 6. Étape 2 — Calcul du jet (backend, aucun LLM)

```mermaid
flowchart TD
    A([action_type, difficulty,<br/>contextual_modifiers]) --> B[(resolution_rules :<br/>action_type → compétence)]
    B --> C[Valeur de compétence<br/>du personnage]
    A --> K[Plafonner les modificateurs<br/>contextuels : 2 à 3 au plus]
    B --> I[(Inventaire : objets dont un<br/>modificateur cible la compétence<br/>et dont la condition owned /<br/>equipped est satisfaite)]
    C --> T["Total = 2d6 + compétence<br/>+ modificateurs contextuels<br/>+ modificateurs d'objets"]
    K --> T
    I --> T
    DICE[Service de dés<br/>injectable] --> T
    T --> S[Seuil par difficulté<br/>easy 7 · medium 9 ·<br/>hard 11 · very_hard 13]
    S --> MG["Marge = total − seuil<br/>≥ +5 critical_success<br/>+1..+4 comfortable · 0 narrow<br/>−1..−3 minor_failure<br/>≤ −4 critical_failure"]
    MG --> L[(turn_log : roll_result<br/>dés, total, seuil, marge,<br/>applied_modifiers avec origine)]
    L -.-> SSE[/roll_resolved<br/>compétence libellée, result, marge<br/>jamais les chiffres/]
    L --> O([Vers la narration :<br/>result + marge qualitative seulement])
```

- **Dégâts** (combat, Phase 8) : dégâts de base de l'arme + marge ÷ 2 arrondie au supérieur,
  sans second jet [règles §7].
- **Combat** : aucun sous-système dédié ; un round est un tour normal de ce pipeline, avec le
  même moteur pour le joueur et les PNJ [règles §8]. *À trancher en Phase 8 : la cible d'un jet
  opposé contre un PNJ improvisé pas encore instancié* [roadmap P8].

---

## 7. Étapes 3 à 5 — Narration, extraction, application

### 7.1 Narration (D), streamée

```mermaid
flowchart TD
    A([Contexte D + issue :<br/>result + marge qualitative]) -.-> S0[/step_started narration/]
    A --> B{{D — llm.streamText<br/>texte libre, langue du joueur}}
    B -->|fragment| C[/narration_chunk<br/>fragment à ajouter/]
    C --> B
    B -->|erreur de transport<br/>ou budget épuisé| X([Échec du tour<br/>le front retire la narration])
    B -->|fin du flux| D[Narration complète<br/>en mémoire du worker]
    D --> E[(turn_log : narrated_text<br/>llm_usage)]
    E --> F([Vers l'extraction])
```

- La narration diffusée est **provisoire** jusqu'à `turn_completed` [archi §8bis].
- Les fragments ne sont jamais persistés ; un front reconnecté en cours de narration attend
  `turn_completed`.
- Le narrateur est libre d'évoquer qui et quoi il veut ; seule l'extraction décide de ce qui
  **existe** mécaniquement.

### 7.2 Extraction (E)

```mermaid
flowchart TD
    A([Texte narré + listes fermées]) --> B{{E — sortie JSON<br/>§5.1}}
    B --> C["Delta proposé :<br/>movement, npcs_entered, npcs_left,<br/>npcs_following, npc_names,<br/>npc_relations, scenario_flags,<br/>hit_points_delta, items_gained,<br/>items_lost"]
    C --> D([Delta validé<br/>vers l'application])
```

La nouvelle tentative de l'extraction **ne relance jamais la narration** : elle travaille sur
le texte déjà produit.

### 7.3 Validation finale et application — la transaction du tour

```mermaid
flowchart TD
    A([Delta validé]) --> B[Ouvrir la transaction]
    B --> C[(Verrouiller la ligne du tour<br/>et relire son statut)]
    C --> D{status = pending ?}
    D -->|non : expiré entre-temps| D1[Abandonner le résultat<br/>aucun événement]
    D -->|oui| M[Déplacement<br/>lieu unique : instance à la<br/>première visite, sinon réutilisée<br/>archétype : nouvelle instance<br/>current_location_id]
    M --> N[Changement de lieu :<br/>PNJ présents → absent<br/>sauf npcs_following]
    N --> O[Sorties de PNJ → absent]
    O --> P[Entrées de PNJ<br/>unique : repassé present<br/>unique mort : refusé<br/>archétype : nouvelle instance]
    P --> Q[Noms appris, dispositions]
    Q --> R[Inventaire : gains et pertes<br/>unique jamais dupliqué<br/>stackable : quantité]
    R --> S[Flags, points de vie]
    S --> T[Attribuer le numéro de tour<br/>unicité session_id + turn_number]
    T --> U[(turn_log : applied_effects,<br/>status = completed)]
    U --> V[Commit]
    V -.-> W[/turn_completed<br/>tour relu + fiche + lieu libellés/]
    V --> Z{Fin de partie ?<br/>mort, victoire<br/>à trancher en Phase 8}
    Z --> J([Seuil de résumé ? — §9])
```

- **Ordre d'application déterministe** : déplacement, puis sorties, puis entrées, pour qu'un
  PNJ qui entre dans le nouveau lieu ne soit pas aussitôt marqué absent [KAN-39].
- **`turn_completed` n'est émis qu'après le commit** ; il porte le tour sous la forme de la
  route de lecture, avec toutes les références transformées en `{ reference, label }` dans la
  langue de la partie [archi §8bis, CLAUDE.md].
- **Tout ou rien** : un échec à n'importe quel point de la transaction l'annule ; rien n'est
  appliqué et le tour passe `failed`.

---

## 8. Chemins d'échec et filets de sécurité

```mermaid
flowchart TD
    subgraph erreurs [Erreurs pendant l'exécution]
        E1[Erreur de transport LLM<br/>timeout · injoignable · HTTP]
        E2[Second rejet d'une<br/>sortie structurée]
        E3[Budget de 3 min épuisé]
        E4[Échec de la transaction<br/>ex. contrainte turn_number]
    end
    E1 & E2 & E3 & E4 --> F[(turn_log : status = failed<br/>failure = code + message<br/>trace des étapes déjà jouées)]
    F -.-> G[/turn_failed<br/>code d'erreur/]
    G -.-> FR[Front : encadré d'échec<br/>narration provisoire retirée<br/>Retry = nouvelle clé · Edit]

    subgraph balayage [Balayage périodique]
        B1[Toutes les minutes<br/>et au démarrage du worker] --> B2[(Tours pending<br/>depuis plus de 5 minutes)]
        B2 --> B3[(status = failed<br/>turn_expired)]
    end
    B3 -.-> G
```

- **Un tour se termine toujours par exactement un** `turn_completed` ou `turn_failed`
  [archi §8bis].
- **Le balayage ne rattrape jamais un tour vivant** : le budget (3 min) est plus court que son
  délai (5 min) [archi §8bis]. Il ne rattrape que les tours orphelins (worker arrêté, job
  perdu).
- **Rattrapage côté front** : un client qui a manqué des événements relit le tour par
  `GET /sessions/:id/turns/:turnId`. Pas de rejeu d'événements côté serveur.
- **Un envoi SSE raté ne fait jamais échouer un tour** : le front rattrape en relisant.
- Chaque code d'erreur a sa traduction côté front [front §5.3.6].

---

## 9. Hors chemin critique — résumé narratif

```mermaid
flowchart TD
    A([Tour complété]) --> B{Seuil de résumé atteint ?<br/>nombre de tours et/ou<br/>changement de scène<br/>à trancher}
    B -->|non| Z([Rien])
    B -->|oui| C[(File : job résumé<br/>identifiant de partie)]
    C --> D[(Dernier narrative_summary<br/>+ tours bruts accumulés)]
    D --> E{{LLM — résumé<br/>toujours en anglais}}
    E --> F[(INSERT narrative_summaries)]
```

Ce job ne bloque jamais la réponse au joueur, et il n'émet aucun événement SSE [archi §5].

---

## 10. Séquence complète vue du front

```mermaid
sequenceDiagram
    autonumber
    participant J as Joueur
    participant FR as Front
    participant API as Backend HTTP
    participant DB as PostgreSQL
    participant Q as File (BullMQ)
    participant W as Worker
    participant LLM as LLM Gateway
    participant T as Transmit

    FR->>T: Abonnement au canal sessions/:id (à l'ouverture de l'écran)
    J->>FR: Écrit son action
    FR->>API: POST /sessions/:id/turns + clé d'idempotence
    API->>DB: INSERT turn_log (pending)
    API->>Q: Job (identifiant du tour)
    API-->>FR: 202 + identifiant du tour
    Q->>W: Job
    W->>DB: Verrou de partie, relecture, contexte
    W->>T: step_started (arbitration)
    T-->>FR: step_started
    W->>LLM: A+B+C
    LLM-->>W: JSON (validé, au plus une nouvelle tentative)
    opt Jet requis
        W->>W: Calcul du jet (dés, compétence, modificateurs)
        W->>T: roll_resolved
        T-->>FR: roll_resolved
    end
    W->>T: step_started (narration)
    T-->>FR: step_started
    W->>LLM: D (stream)
    loop Fragments
        LLM-->>W: fragment
        W->>T: narration_chunk
        T-->>FR: narration_chunk
    end
    W->>LLM: E
    LLM-->>W: JSON (validé, au plus une nouvelle tentative)
    W->>DB: Transaction : effets, numéro de tour, turn_log completed
    W->>T: turn_completed
    T-->>FR: turn_completed (remplace la narration provisoire)
    FR-->>J: Narration définitive, fiche et lieu à jour
    opt Seuil de résumé
        W->>Q: Job résumé (hors chemin critique)
    end
```

---

## 11. Déploiement cible

```mermaid
flowchart LR
    FR[Front<br/>navigateur] -->|HTTPS<br/>API + SSE| LB[Répartiteur]
    LB --> H1[Instance HTTP 1]
    LB --> H2[Instance HTTP n]
    H1 & H2 --> PG[(PostgreSQL)]
    H1 & H2 -->|mise en file| RD[(Redis)]
    RD -->|jobs BullMQ| W1[Worker 1]
    RD -->|jobs BullMQ| W2[Worker n]
    W1 & W2 --> PG
    W1 & W2 -->|événements| RD
    RD -->|transport Transmit| H1 & H2
    W1 & W2 --> LLMX[API LLM externe<br/>via LLM Gateway]
```

- **Workers séparés des process HTTP**, file BullMQ sur Redis [archi §8bis].
- **Transport Redis de Transmit** : un événement émis par un worker atteint le client SSE,
  quelle que soit l'instance HTTP qui tient sa connexion.
- **Verrou PostgreSQL par `session_id`** pour sérialiser les tours d'une même partie entre
  workers.
- Le passage à cette topologie est prévu avant le beta test (Phase 9) ; jusque-là, un seul
  process tient HTTP et worker, avec pg-boss et Transmit en mémoire.

---

## 12. Ce que ce document ne tranche pas

Repris des points ouverts des autres documents, sans les résoudre :

- **Chiffrage des modificateurs contextuels** : valeur proposée par le LLM (règles §5.1) ou
  label qualitatif converti par le backend (principe « le LLM ne manipule jamais de valeur
  numérique » du document de base de données) — Phase 4.
- **Schéma de l'inventaire** (`stackable`, détenteur d'un objet, durabilité, charges) — Phase 4.
- **Seuils de déclenchement du résumé narratif** — Phase 7.
- **Conditions de fin de partie et jets opposés contre un PNJ improvisé** — Phase 8.
- **Modération de contenu** au-delà du prompt injection — Phase 9.
- **Versionning des prompts** et différenciation du modèle par étape — Phase 9.
- **Battement de cœur SSE** (`pingInterval`) à régler selon l'hébergement retenu.
- **Hébergement** définitif.
