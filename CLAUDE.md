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
   modificateurs situationnels (3 au plus par jet), qualifiés par un label que le backend
   chiffre. Les bonus/malus d'objets sont lus dans l'inventaire et calculés par le backend —
   le LLM ne les chiffre jamais.
5. **Le narrateur ne reçoit jamais de données mécaniques brutes** (dés, chance, valeurs de
   compétence) — uniquement `result` + le degré qualitatif (`degree`, ex-`margin`). Le
   joueur, lui, voit le détail de chaque jet **de son personnage** depuis la Phase 6 : l'invariant
   porte sur le LLM. Les jets des PNJ ne quittent jamais le backend (Phase 10).
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
  `frontend` (joueur) et `back-office` (game masters, Phase 5, même stack que le front).
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
- Docker en local pour PostgreSQL + Redis (`docker compose up -d` à la racine), sur les ports
  **5433** et **6380** (les ports par défaut sont pris par un autre projet) — Redis n'est
  requis qu'une fois la file basculée sur BullMQ.
- LLM : **Google Gemini** (`gemini-3.8-flash`, SDK `@google/genai`), encapsulé derrière le
  **LLM Gateway**. Aucun autre fichier de l'app n'importe un SDK de provider.

## Règles de travail

- **Construction par phases** (roadmap `doc/roadmap-mj-virtuel-llm.md`). Chaque phase reste
  jouable de bout en bout. Ne pas anticiper une phase ultérieure sans raison explicite.
- **Réutiliser le scaffolding AdonisJS** (register/login déjà en place) plutôt que de
  reconstruire. Seul le champ `role` est une extension propre au projet.
- **Pas de retry automatique LLM des erreurs de transport** (timeout, API injoignable,
  erreur HTTP). **Exception, à partir de la Phase 3** : une sortie structurée rejetée par la
  validation backend (JSON illisible, hors schéma, hors bornes, référence hors liste fermée)
  est renvoyée **une seule fois**, avec un message correctif. Un second rejet fait échouer
  le tour. Chaque erreur remonte au front avec un message différencié selon sa catégorie.
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
public). Ses simplifications volontaires ont été levées en Phase 3 (pipeline séparé, étape E),
en Phase 4 (modificateurs) et en Phase 5 (univers en base).

**Phase 2 (front minimal) terminée** — epic Jira `KAN-13`. Un joueur connecté joue un tour
depuis l'interface web, avec retour progressif par SSE et erreurs affichées par catégorie.
Ses choix d'exécution restent en vigueur (détail : roadmap Phase 2, architecture §8bis) :
- file **pg-boss** derrière un port, BullMQ à la bascule multi-instance ; idempotence,
  sérialisation des tours et événements SSE ne dépendent **jamais** de la file (le job ne
  porte que l'identifiant du tour) ;
- worker **dans le process HTTP**, `concurrency: 1`, sans retry ; Transmit en
  mémoire, sans transport Redis — ne tient pas à plusieurs instances, à reprendre avant la
  beta ;
- **clé d'idempotence** fournie par le client, une par soumission, enregistrée avant la mise
  en file ; un retry après `turn_failed` est une nouvelle soumission ;
- SSE : un canal par partie, abonné avant la soumission ; jalons (`step_started`,
  `roll_resolved`, `turn_completed`, `turn_failed`) ; rattrapage par lecture du tour.

**Pipeline d'un tour** (séparé depuis KAN-40, `#runPipeline` dans `turn_service.ts`) :
arbitrage A+B+C (`action_type` et circonstances en labels, jamais de narration) → jet côté
backend si requis (d100 BRP sur la compétence ou la caractéristique déduite via
`resolution_rules`, une compétence absente de la fiche valant sa chance de base ; circonstances
et objets du personnage ajoutés, chacun tracé avec son origine) →
narration D en **texte libre streamé** (`narration_chunk`) → extraction E, structurée, qui lit
la narration et renvoie le delta complet, validé contre les listes fermées → application par
`applyDelta` (`app/services/game/apply_delta.ts`) dans la transaction du tour, dans un ordre
fixe : déplacement, sorties, entrées, noms et dispositions, puis objets (créations,
transferts, destructions, équipement — « le lieu » étant celui où le tour a commencé). Trois
appels au minimum par tour,
sauf pour un **aparté au MJ** (`intent.type: out_of_character`) : narré en réponse brève,
sans extraction ni changement d'état. Hors du tour, un job de résumé (Phase 9) condense les
tours anciens dans sa propre file.
SSE : `step_started(arbitration)`, `roll_resolved` (avec les objets qui ont pesé, sans
valeur), `step_started(narration)`, des `narration_chunk`, puis un seul `turn_completed` (avec
le lieu courant libellé et l'inventaire à jour) ou `turn_failed` — pas de jalon pour
l'extraction.

**Phase 3 (pipeline complet) terminée** — epic Jira `KAN-28`. Ses choix restent en vigueur
(détail : roadmap Phase 3, architecture §6ter, §6quater, §7, §8bis) :
- pipeline séparé A+B+C → jet → D → E ; l'appel fusionné de la branche sans jet disparaît ;
- **une seule nouvelle tentative** sur une sortie structurée rejetée (JSON illisible, hors
  schéma, hors bornes, référence hors liste fermée), avec message correctif, puis échec ;
- **narration en streaming** (`narration_chunk`), provisoire jusqu'à `turn_completed`,
  retirée par le front sur `turn_failed` ;
- **budget de 3 minutes par tour** ; le balayage des tours `pending` reste à 5 minutes ;
- un seul modèle pour toutes les étapes pendant les phases de test — `gemini-3.8-flash` depuis
  octobre 2026, `gemini-2.5-flash` n'étant plus ouvert aux nouvelles clés API ;
- **`resolution_rules`** réduite (`world_id` depuis la Phase 5, `action_type`, `description`,
  `associated_skill`) ; l'arbitrage choisit un
  `action_type`, le backend en déduit la compétence, et le LLM ne voit plus les valeurs de
  compétence ;
- **PNJ et lieux : définitions et instances** — `unique` / `archetype`, l'improvisé est une
  instance d'archétype générique ; tables `npc_instances` et `location_instances`, handles
  attribués par le backend, instances créées par la seule étape E.

**Phase 4 (inventaire et modificateurs d'objets) terminée** — epic Jira `KAN-44`. Ses choix
restent en vigueur (détail : roadmap Phase 4, architecture §6bis, base de données
`inventory_items`, règles §5, §7, §8) :
- **objets : définitions et instances**, sur le modèle des PNJ (en base depuis la Phase 5) ;
  `stackable`, `equippable`,
  modificateurs ciblant une compétence ou les dégâts, détenteur initial facultatif ;
- **trois détenteurs** — personnage, PNJ, lieu — par trois clés étrangères dont exactement une
  renseignée ; donner, voler, cacher, ramasser = **transfert**, l'exemplaire garde son handle ;
  `gone` = détruit ou consommé ; à la mort d'un PNJ, ses objets passent au lieu courant ;
- seuls les **objets en scène** (personnage, PNJ présents, lieu courant) vont au pipeline ;
  le front n'affiche que l'inventaire du personnage ; `world_states.world_objects` disparaît ;
- **modificateurs contextuels** en labels, convertis par le backend, 3 au plus (barème
  passé en pourcentage en Phase 6) ;
  **modificateurs d'objets** du seul détenteur, une fois par définition ;
- formule de dégâts posée en Phase 4, branchée dans le tour en Phase 10 — **remplacée en
  Phase 6 par celle du BRP** ; l'arme ordinaire d'un PNJ est une référence de son profil de
  combat ;
- durabilité et charges différées, consommables par la quantité.

**Phase 5 (multi-univers et back-office minimal) terminée** — epic Jira `KAN-58`. Un
`game_master` crée un univers et un scénario complets depuis le back-office, un joueur les
joue. Ses choix restent en vigueur (détail : roadmap Phase 5, « Décisions de cadrage » ; base
de données, section 2) :
- **contenu en base** : `worlds`, `scenarios`, et trois catalogues de même forme
  (`npc_definitions`, `location_definitions`, `item_definitions`), au niveau de l'univers ou
  d'un scénario qui **surcharge** la définition de même référence ; Trois Mousquetaires écrits
  par le seeder de contenu depuis `database/content/` ;
- **univers chargé une fois par tour** (`loadWorld`), sans cache, et passé à toutes les étapes ;
- **noms d'affichage par langue** (`labels`, anglais obligatoire, repli sur l'anglais) ;
  glossaire réduit aux noms propres non-entités, univers complété par le scénario ; seule la
  narration reçoit des noms traduits ;
- **scénario `draft` / `published`**, cohérence vérifiée à la publication et au lancement de
  chaque partie (`checkScenario`) ; une partie se lance en copiant l'**état initial** du
  scénario (le prétiré a disparu en Phase 12) ; un `game_master` voit et joue les brouillons ;
- **référence immuable**, suppression refusée (`content_in_use`) si une partie emploie le
  contenu ; le reste est modifiable et vaut dès le tour suivant ;
- **back-office** (`apps/back-office`) sur la stack du front, routes `/api/v1/admin` réservées
  au `game_master` ; JSON brut validé pour les structures imbriquées (profil de combat,
  modificateurs, équipement de départ) ;
- front, back-office et API sur **trois sous-domaines** d'un domaine à nous (`CORS_ORIGINS`,
  `COOKIE_DOMAIN`) ; premier `game_master` par seeder.

**Phase 5bis (gestion des comptes) terminée** — epic Jira `KAN-71`. Un superadmin crée,
suspend et réactive un compte de n'importe quel rôle depuis le back-office. Ses choix restent
en vigueur (détail : roadmap Phase 5bis, « Décisions de cadrage ») :
- **premier superadmin** par `node ace account:create-superadmin`, production comprise ; les
  autres comptes depuis le back-office ;
- **un compte = un rôle** : le superadmin ne gère que les comptes (`/api/v1/admin/accounts`),
  le `game_master` que le contenu ; le back-office ne montre à chacun que ses sections ;
- **suspension** par `users.suspended_at` : connexion refusée (`403 account_suspended`),
  session déjà ouverte coupée à la requête suivante (`401`, l'état du compte étant relu à
  chaque requête — le cookie de session ne se révoque pas), parties conservées ;
- ni suspension de soi-même (`cannot_suspend_self`) ni du dernier superadmin actif
  (`last_superadmin`) ;
- pas de changement de rôle, de modification d'email ni de suppression ; l'inscription libre
  attend la Phase 14.

**Phase 6 (bascule sur le système BRP) terminée** — epic Jira `KAN-78`. Le Basic
Roleplaying de Chaosium (édition 2023, licence ORC) remplace le moteur 2d6, pour tous les
univers. Ses choix restent en vigueur (détail : roadmap Phase 6, système de règles) :
- **d100 sous la chance** : base (compétence, ou caractéristique × 5) × difficulté (`easy`
  × 2, `average`, `difficult` ÷ 2), puis modificateurs contextuels (±10, ±20, 3 au plus) et
  d'objets ; 01–05 réussit, 96–00 échoue toujours ;
- **sept caractéristiques fixes** (`STR`…`CHA`), enum du système : plus d'attributs par
  univers ; compétences en pourcentage, avec catégorie et chance de base, une compétence
  absente valant sa chance de base ;
- **cinq degrés** (`critical`, `special`, `success`, `failure`, `fumble`) remplacent la marge ;
  `margin` devient `degree` ;
- **le joueur voit le détail du jet** (compétence, modificateurs, chance, d100, degré) ; le
  narrateur n'en reçoit toujours que le résultat et le degré ;
- points de vie du personnage dérivés (`(CON + SIZ) ÷ 2`) ; profil d'arme et formule de
  dégâts du BRP posés, branchés en Phase 10 ; aucune règle optionnelle avant la Phase 13 ;
- bascule sans reprise de données ; texte du livre jamais recopié, notice ORC dans le produit.

Le livre (« ORC Content Document ») est rangé hors du dépôt, dans `tmp/` (ignoré par git).

**Phase 7 (gestion du temps et des lieux) terminée** — epic Jira `KAN-89`. Ses choix restent
en vigueur (détail : roadmap Phase 7, architecture §6quater et §6quinquies) :
- **horloge tenue par le backend** : compteur en secondes depuis minuit du premier jour,
  départ (heure obligatoire, date grégorienne facultative) copié du scénario au lancement ;
  sans rapport avec le port `Clock` ;
- **durée en label proposée par l'arbitrage** (`moment`, `minutes`, `hour`, `hours`, `days` +
  `count` 1–7, `until` + `period`), convertie par le backend ; même durée en échec ; l'aparté ne
  prend aucun temps ; round et soins du BRP attendent la Phase 10 ;
- **sept périodes à bornes fixes** (`night`…`evening`), sans saison ; l'arbitrage reçoit la
  période, la narration les périodes, l'heure au quart d'heure, la date et le numéro de jour
  (heure précise seulement si le personnage a de quoi la connaître), l'extraction rien ;
- **le joueur ne voit que la période** — ni heure, ni date, ni sorties à l'écran ;
- **le grain est celui du catalogue** ; **sorties** déclarées une fois, d'un seul côté
  (`exits` : passage, caché, objet requis, sens unique, durée), état dans `passage_states` ;
- **lieux libres, en réseau, entrées** : dans un réseau, on ne passe que par les sorties, vers
  les lieux visités et leurs voisins ; l'arbitrage désigne la destination, le backend chiffre
  le chemin, l'extraction juge du déplacement réel ; pas d'improvisation dans un réseau ;
- **objet requis** détenu = passage ouvert, déverrouillé en le franchissant ; découverte et
  crochetage proposés par l'extraction, en liste fermée ; un passage trouvé ou ouvert peut être
  franchi dans le même tour (les passages s'appliquent avant le déplacement) ;
- **localisation des PNJ** (`location_instance_id`) : laissé dans un lieu, retrouvé au retour ;
  un PNJ hostile bloque le passage au travers de sa pièce.

**Lot d'interface entre les Phases 7 et 8 (jet en direct et préférences) terminé** — epic
Jira `KAN-104`, hors roadmap, front seul, **sans changement d'API**. Décisions (détail : cahier des charges du front, 5.3.1, 5.3.7,
5.5 et section 7) :
- **jet lancé à la main** : le d100 est déjà tiré par le backend, le geste ne fait que le
  révéler, sans mécanique d'adresse ; préparation, deux d10 en 2D (CSS, sans dépendance),
  degré, repli en pastille ; pas de jauge, la chance chiffrée suffit ;
- **narration retenue** jusqu'au lancer, saisie verrouillée ; un tour terminé avant le lancer
  est **retenu** à la place du tour en cours, et ne rejoint le journal, la fiche, le bandeau
  de scène et la voix qu'à la révélation ; un tour échoué révèle son jet aussitôt ; un tour
  relu n'est jamais rejoué ;
- **préférences d'interface** (thème, lecture à voix haute, lancer automatique, animations
  une à une) propres au navigateur, **jamais en base** ni envoyées au backend ;
  `prefers-reduced-motion` est un plancher ; le bouton de voix de l'en-tête double le réglage ;
- **bandeau de scène** sous l'en-tête (lieu et période, toujours visibles) ; l'onglet
  *Situation* de la fiche devient *Quests* ; texture du fond fixe par thème.

**Complément de la Phase 7 : placement initial des PNJ** (détail : roadmap, « Complément de la
Phase 7 » ; architecture §6ter et §6quater), sur le modèle du détenteur initial d'un objet :
- un PNJ **unique** peut déclarer `initialLocation`, le lieu unique où il attend au début de la
  partie (`npc_definitions.initial_location`) ; jamais un archétype ;
- le backend l'instancie `absent` dans ce lieu à sa **première visite** (`visitUniqueLocation` →
  `placeInitialNpcs`), puis l'arrivée le rend présent (`meetThoseWaiting`), au lancement compris ;
  seule exception à « l'extraction crée les PNJ » ;
- la narration de l'arrivée le reçoit dans `npcs_at_destination` avant qu'il existe ; tant qu'il
  n'est pas rencontré, la liste fermée de l'extraction (`enterableNpcs`) ne l'admet que depuis son
  lieu ou un lieu d'où l'on s'y rend.

**Lot « Ce que le personnage sait » terminé** — epic Jira `KAN-113`, entre les Phases 7 et 8
(détail : roadmap, même titre ; architecture §4, §6ter et §6quater) :
- **ce que le personnage sait est tenu par le backend** : `world_states.known_npcs`, les uniques
  dont il connaît le nom, copiés de `initialState.knownNpcs` au lancement, complétés quand un
  unique se présente (`npc_names` ; la chaîne proposée est ignorée, le nom reste celui de la
  définition) ;
- la narration reçoit chaque nom **marqué `known`** : un unique inconnu est désigné par son
  apparence ou son rôle ; un archétype est toujours connu ;
- une sortie ne porte le lieu où elle mène (`to`) que s'il a été visité ;
- **contenu** : `passage` et `backPassage` ne nomment jamais ce qu'il y a derrière, ni d'un côté
  ni de l'autre ; une description ne nomme ni une pièce voisine ni un unique pas encore
  rencontré — vérifié par `giveaways` (`#tests/helpers/knowledge`) sur les réseaux du contenu.

**Phase 8 (lore étendu) terminée** — epic Jira `KAN-120`. Ses choix restent en vigueur
(détail : roadmap Phase 8, « Décisions de cadrage » ; architecture §4 ; base de données,
`lore_fragments`) :
- **lore en fragments** (`lore_fragments`), au niveau de l'univers ou d'un scénario qui
  **surcharge** le fragment de même référence, comme les catalogues ; `kind` dit où il part —
  `rule` à l'arbitrage, `ambiance` à la narration, `fact` aux deux — et `secret` le réserve à
  l'arbitrage (jamais sur une `ambiance`), qui le reçoit à part (`secret_lore`) et ne l'énonce
  ni dans `validity.justification` ni dans `intent.summary` ; l'extraction ne reçoit rien ;
- **`worlds.rules` et `worlds.ambiance` disparus**, repris en fragments sans tag
  (`rule_01`, `ambiance_01`…) ; une seule source de lore, éditée au back-office (onglet *Lore*) ;
- **sélection par la scène, jamais par le texte du joueur** : tags = références de lieux, de
  PNJ ou d'objets, vérifiées (`unknown_tag`) ; un fragment sans tag part toujours, un fragment
  tagué quand la scène tient un de ses tags (lieu et parents, PNJ présents, objets en scène ;
  pour la narration d'un déplacement, la destination et ceux qui y attendent), du plus
  spécifique au moins spécifique, **12 fragments tagués au plus par étape** ;
- **traçabilité** : `turn_log.lore_sent`, les références envoyées à chaque étape ;
- **pas d'embeddings** : la recherche par similarité attend un volume de lore qui l'exige ;
- **import JSON complet** : un univers **clé en main** (catégories d'action, lieux, PNJ, objets,
  lore ; ses scénarios à part) ou un scénario avec ses catalogues, en une transaction, la
  première entrée fautive refusant tout le fichier ;
- **démonstration** : deux scénarios de test des Trois Mousquetaires, *The Grain Road* (un
  village des environs de La Rochelle, 1627) et *The Drowned Anchor* (une auberge bretonne),
  en JSON dans `test-worlds/`, hors dépôt.

**Hors roadmap : un événement blesse le personnage** (novembre 2026, détail : architecture
§6sexies) : effet `character_harmed`, une formule de dés de l'auteur (`12D6`, `6`, `2D4+8`) tirée
par le backend (`RulesEngine.harm`), moins la meilleure armure portée, infligée au seul
personnage témoin de l'événement ; tirage tracé dans `events_fired`, jamais au LLM.

**Hors roadmap : objets cachés** (novembre 2026, détail : roadmap, « Complément de la Phase 7 —
Objets cachés » ; architecture §6bis), sur le modèle des sorties cachées : un unique détenu au
départ par un lieu peut être caché (`item_definitions.hidden`), l'état vit dans
`inventory_items.hidden` ; arbitrage et narration le reçoivent marqué, l'extraction à part
(`hidden_items`) et propose `items_discovered` ; pris ou détruit avant d'être trouvé, rejet
`hidden_item` ; pas de lore avant la découverte.

**Hors roadmap : suppression d'une partie par le joueur**, depuis *My games*, avec
confirmation. Suppression douce (`sessions.deleted_at`) : la partie et ses tours restent en
base, mais toute route de jeu y répond comme à une partie inexistante.

**Phase 9 (mémoire long terme) terminée** — epic Jira `KAN-128`. Ses choix restent en vigueur
(détail : roadmap Phase 9, « Décisions de cadrage » ; architecture
§5 ; base de données, `narrative_summaries`) :
- **deux niveaux de résumé, en anglais** (`narrative_summaries`) : un `scene` condense **tous**
  les tours non couverts plus anciens que les 4 derniers dès qu'il y en a 8
  (`SCENE_SUMMARY_THRESHOLD`, `TURNS_KEPT_VERBATIM`) ; un `global` glissant absorbe les `scene`
  au-delà de 4 (`SCENES_BEFORE_FOLD`). Pas de niveau `chapter` (le chapitre ne change jamais) ;
- **pas de trou de mémoire** : arbitrage et narration reçoivent `story_so_far` (dernier
  `global`, puis les `scene` non repliés), puis **tous les tours qu'ils ne couvrent pas** — la
  narration tous, l'arbitrage les 2 derniers, l'extraction rien ;
- **le résumé ne lit que l'entrée du joueur et la narration**, jamais la sortie d'arbitrage
  (que le `secret_lore` influence) ; son prompt écarte consignes et apartés ;
- **file à part** (`narrative-summary`, `SummaryWorker`, `concurrency: 1`) : le tour réussi met
  le job en file si le seuil est atteint, sans jamais échouer pour autant ; le job recalcule ce
  qui est dû et ignore une partie supprimée ; ni nouvelle tentative ni SSE, un échec n'écrit
  rien ;
- **coût** dans `narrative_summaries.llm_usage` (étape `summary`), compté par `llm:cost` ;
- **journal paginé** : `GET /sessions/:id/turns` par pages de 20 (`?before=`,
  `metadata.hasEarlier`), *Load earlier* au front ;
- hors périmètre : rappel des PNJ absents et retour dans un lieu improvisé (lot à part).

**Langue de narration par défaut** : `DEFAULT_LANGUAGE` (backend, `config/game.ts`, `en` si
absente, fixée à `en` dans `.env.test`) ; `VITE_DEFAULT_LANGUAGE` pour l'interface, qui retombe
sur l'anglais faute de traductions.

**Phase 10 (combat) terminée** — epic Jira `KAN-136`. Ses choix restent en vigueur (détail :
roadmap Phase 10, « Décisions de cadrage » ; règles §7, §8 ; architecture §3, §6ter, §8bis) :
- **un tour de combat = un round de 12 s**, déduit à chaque tour de l'arbitrage (`combat` :
  adversaire présent ou archétype attaqué, parade et esquive possibles, circonstances de la
  défense), sans état en base ; **avantage au joueur** : son attaque d'abord, puis une seule
  riposte, d'un adversaire **tiré au hasard** parmi la cible (si elle tient debout, l'a vu venir
  et l'atteint) et les autres hostiles présents debout — aucune sur une attaque surprise
  (révisé hors phase, novembre 2026) ;
- **compétence d'attaque par la catégorie d'action**, jamais par l'arme (`kind` : `melee`,
  `thrown`, `projectile`) ; `melee_combat`, `ranged_combat`, `first_aid` et `dodge` sont des
  références du système, exigées par `checkScenario` ;
- **matrice attaque / défense** du BRP, meilleure défense choisie par le backend ; effets
  spéciaux et maladresses (table réduite) réglés dans le round, sauf le saignement ;
- **seuls les jets du personnage partent au front**, un `roll_resolved` chacun (deux au plus),
  dégâts infligés détaillés, jamais lancés ; la lecture d'un tour porte `rolls` ;
  `turn_log.combat_result` trace tout le round ;
- **PV totaux `CON + SIZ`** pour le personnage (provisoire, Phase 13), qui n'est jamais tué : à
  0, il revient à 1, hors de combat une heure ; un PNJ à 0 est `dying` et meurt au tour suivant,
  sauf premiers soins ; hors de combat à 2 PV ou moins ;
- **soins** : premiers soins (une tentative par blessure, jamais en plein combat), guérison de
  1D3 par semaine de jeu ; l'extraction ne lit plus que les blessures hors combat, jamais un soin ;
- **surprise et portée jugées par l'arbitrage** (`opponent_aware`, `riposte_possible`,
  `opponent_defense_modifiers`) : un adversaire surpris ne se défend ni ne riposte, un adversaire
  hors d'atteinte ne riposte pas ; chaque jet de combat nomme l'adversaire, ou son rang parmi les
  inconnus (`Opponents`, `#services/game/opponents`) — jamais le nom d'un unique inconnu ;
- **coût mesuré** (novembre 2026, `gemini-3.8-flash` à 0,75 $ / 3,75 $ le million) : 0,93 ¢ par
  tour en moyenne, 0,98 ¢ par tour de combat ;
- démonstration : *The Duel at the Carmes* dans `test-worlds/`.

**Phase 11 (échéances et événements) terminée** — epic Jira `KAN-143`. Ses choix restent en
vigueur (détail : roadmap Phase 11, « Décisions de cadrage » ; architecture §6sexies ; base de
données, `event_states`, `place_notes`) :
- **le monde n'avance qu'avec l'horloge de jeu**, évalué par le backend dans le tour — ni job
  différé, ni appel LLM de plus ; un aparté ne déclenche rien ;
- **cycles sans état** (emploi du temps d'un unique, passage bloqué par période, note de période)
  et **événements avec état** (`scenarios.events`, `event_states`), qui tombent une fois au plus :
  échéance datée, ou événement d'état, aussitôt ou après un délai (armé), annulé par un `unless` ;
- **conditions et effets en listes fermées**, lus dans l'état et appliqués par les services
  existants ; un effet sur un lieu jamais visité ou un unique jamais rencontré **attend**
  (`world_states.pending_place_effects`) sa première visite ou rencontre ;
- **ordre dans la transaction** : horloge, mourants, round, premiers soins, événements de temps,
  delta, guérison, événements d'état (chaîne de 3 passes, `EVENT_CHAIN_DEPTH`, le reste reporté
  au tour suivant, jamais un échec), emplois du temps ;
- **interruption** par un événement `interrupts` dont le personnage est témoin, ou l'arrivée d'un
  unique hostile ou dont l'entrée porte `interrupts` — jamais sur un `moment` ni un round, ni
  pendant un trajet ;
- **attente** `until_event` (événement prévisible, jamais son heure) et `until_npc` (unique connu),
  7 jours au plus, sinon `hours` et `awaited: did_not_happen` ;
- **emplois du temps** des seuls uniques, placement paresseux tant qu'ils ne sont pas rencontrés ;
  en scène, on ne part qu'avec `leavesScene` ; `schedule_stopped` y met fin ;
- **un passage bloqué ne se franchit d'aucune façon**, des deux côtés ; **une note d'événement par
  lieu** ; notes et raisons de blocage passent `giveaways` ;
- **ce que voit chaque étape** : la narration, les seuls événements dont le personnage est témoin
  (un événement d'état au tour suivant, une fois) ; l'arbitrage, les événements tombés comme faits,
  les prévisibles et les PNJ attendables ; l'extraction, les flags du catalogue pas encore posés ;
  le front, rien ;
- **flags en liste fermée** : catalogue `scenarios.flags`, validation sur tout le catalogue ;
- trace dans `turn_log.events_fired` ;
- **coût mesuré** (novembre 2026, `gemini-3.8-flash` à 0,75 $ / 3,75 $ le million) : 1,04 ¢ par
  tour sur la démonstration, dans la variation d'un scénario à l'autre ;
- démonstration : *The Golden Lion* dans `test-worlds/`.

**Phase 12, premier lot (création du personnage et parties d'un personnage) terminé** — epic
Jira `KAN-151`. Ses choix restent en vigueur (détail : roadmap Phase 12, « Décisions
de cadrage — création du personnage… » et ce qui a été tranché à l'implémentation ; règles §3bis ;
base de données, `characters`, `character_states`, `professions`, `character_rolls` ;
architecture 8bis ; cahier du front 5.6) :
- **le personnage appartient au joueur et à un univers**, plus à une partie ; le prétiré
  disparaît. Fiche durable (`characters` : nom, genre, profession, caractéristiques,
  compétences), état d'une partie dans `character_states` (PV, saignement, premiers soins,
  guérison, ressources), inventaire de la partie avec le personnage pour détenteur ; rien ne
  passe d'une partie à l'autre pour l'instant ;
- **création selon le livre, avec un écart** : sept fois **4D6, les trois meilleurs gardés**,
  tirés par le backend (`character_rolls`, une série par joueur, relance à volonté), placés en
  permutation exacte, SIZ et INT relevées à 8, profession du catalogue de l'univers, réserves
  professionnelle et personnelle (INT × 10) et plafond selon le **niveau de puissance** de
  l'univers (`worlds.power_level`) ; nom de 1 à 35 caractères, genre `female` / `male` /
  `neutral` ;
- **le front ne calcule rien, même à la création** : un aperçu sans écriture
  (`POST /characters/preview`) et la création partagent le calcul pur `createCharacter` ;
- **professions en catalogue d'univers** (`professions`, sans surcharge par scénario) ;
  **équipement de départ = profession + scénario** (`scenarios.starting_kit`), ressources
  additionnées ;
- **une partie à la fois par personnage** (index unique partiel, `character_engaged`) ; statut
  `failed` et `ended_at` ; abandon (refusé pendant un tour), rejeu d'un scénario échoué, jamais
  d'un scénario réussi ; seule une partie `failed` se supprime, un personnage seulement hors
  partie ;
- **ce que voient les étapes** : l'arbitrage le nom et la profession, la narration le nom, le
  genre et la profession traduite ; l'extraction rien de plus. Le nom est un texte du joueur,
  introduit comme donnée de jeu ;
- **front** : accueil par personnages et univers, page d'un personnage, création en cinq étapes,
  bandeau d'une partie close ; **back-office** : niveau de puissance, onglet *Professions*,
  équipement de départ du scénario.

**Phase 12, deuxième lot (conditions de fin de partie) terminé** — epic Jira `KAN-175`. Ses choix
restent en vigueur (détail : roadmap Phase 12, « Décisions de cadrage — conditions de fin de
partie » et ce qui a été tranché à l'implémentation ; architecture §6sexies « Fin de partie » et
§8bis ; base de données, `sessions.end_reason`, `turn_log.game_end` et `epilogue`) :
- **victoire et défaite sont des effets d'événement** (`game_ended`, `outcome` `completed` /
  `failed`), déclenchés comme tout événement ; **au moins une victoire par scénario**
  (`no_victory_event`), à la publication et au lancement ;
- **le personnage meurt à 0 PV**, quelle qu'en soit la source, sur le coup (révise la Phase 10) ;
  vivant à 2 PV ou moins, il reste hors de combat une heure ;
- **une fin par tour**, mort puis défaite puis victoire (`gameEndOf`) ; une fin proposée arrête
  échéances suivantes, événements d'état et emplois du temps ; clôture dans la transaction
  (`closing()` : `status`, `ended_at`, `end_reason` — `victory`, `defeat`, `death`, `abandoned`) ;
- **la narration ne reçoit jamais la fin** : elle raconte la chute, l'**épilogue** (étape LLM
  `epilogue`, après le commit, streamée, pour toute fin sauf l'abandon) raconte la fin ; son
  échec laisse la fin intacte, sans épilogue ; c'est la seule autre étape à écrire dans la langue
  du joueur ;
- **contrat** : `step_started(epilogue)`, `epilogue_chunk`, puis `turn_completed` ; `gameEnd` sur le
  tour lu, `endReason` sur la partie ; écrans de fin au front ;
- démonstration : *The Three Levers* dans `test-worlds/` (Trois Mousquetaires, trois issues).

Lots suivants de la Phase 12 : progression, pause et reprise.

**Refonte visuelle du front joueur — « la table de jeu »** — maquettes epic KAN-160, intégration
epic KAN-167, hors roadmap, front seul, sans changement d'API (détail : cahier du front, sections
5 et 8 ; maquettes et écarts dans `apps/frontend/design/`) :
- les éléments du jeu sont des **objets posés sur une table** : le récit sur une feuille, chaque
  jet sur une carte tamponnée, les points de vie en pastilles, les dés (de vrais d10 et d6
  dessinés) dans un plateau creusé qui porte la saisie, le personnage en pile de fiches à
  onglets, le lieu sur une étiquette épinglée à la feuille ; hors partie, ni barre d'application
  ni barre d'onglets ;
- **thème clair par défaut**, le sombre devient « la table la nuit », *System* reste un choix
  (stocké comme tel) ;
- le **jet en direct se joue dans le plateau de dés**, puis rejoint la feuille en carte ; une
  fois révélé, le plateau ne le garde pas (il ne porte que la saisie) ;
- **pas de points de vie sur la fiche d'un personnage hors partie** : ils n'existent que dans
  une partie.

Décision non tranchée, sans urgence : choix de l'hébergeur pour la phase de test — piste
privilégiée Railway (backend, PostgreSQL et SPA statiques sur une même plateforme ; pas de
serverless pour le backend).

---

## Conventions d'implémentation établies

- **`database/schema.ts` est auto-généré** par `node ace migration:run` (schema generation
  Lucid) — ne jamais l'éditer à la main, ni le reformater : il est réécrit à chaque
  migration. Il est exclu de Prettier via `apps/backend/.prettierignore`. Les modèles de
  `app/models/` étendent les classes qu'il expose et y ajoutent la logique métier.
  **Migrer avant d'écrire le modèle** : un modèle qui importe une classe de schéma pas
  encore générée empêche ace de démarrer (`start/transmit.ts` charge `Session` et ses
  relations), donc de générer le schéma. Pour régénérer sans toucher à la base de dev :
  `NODE_ENV=test node ace migration:run`.
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
- **Le contenu de test manuel vit dans `test-worlds/`** (racine, ignoré par git) : des JSON à
  la forme du contenu en code, importés par le back-office. Les seeders n'écrivent que ce dont
  les tests automatisés ont besoin, plus le contenu de `database/content/` et la partie de
  démo. Un univers s'y nomme `<référence du monde>.world.json`, sans ses scénarios ; un
  scénario `<référence du monde>.<référence du scénario>.scenario.json`
  (`three_musketeers.the_golden_lion.scenario.json`).
- **Ce que les validateurs ne voient pas d'une définition ou d'un fragment** (champ réservé à
  un `kind`, tag qui ne désigne rien, ambiance secrète, catégorie d'action sans résolution
  unique) se refuse dans `app/controllers/admin/catalogue_checks.ts`, partagé par le formulaire
  et l'import, sur le chemin du champ fautif — avant les contraintes de la base.
- **Le contenu de jeu écrit en code vit dans `database/content/`** (forme `WorldContent`,
  `#services/game/content/types`) et s'écrit en base par `storeWorldContent`
  (`#services/game/content/store`), idempotent par référence — jamais par des insertions à la
  main. Le tour lit une `WorldDefinition` résolue par `resolveWorld` (univers + scénario, la
  définition de scénario remplaçant celle de l'univers de même référence).
- **Les seeders sont préfixés d'un numéro à deux chiffres** (`01_`, `02_`…) : Lucid les
  joue par ordre de nom de fichier, et un simple `node ace db:seed` doit remplir une base
  vide. Le contenu de jeu (tous environnements) passe en premier, puis les données de test
  (`environment = ['development', 'test']`), dans l'ordre de leurs dépendances.
- **Un service substituable** = un port (interface), une implémentation réelle reçue **par
  le constructeur**, et un singleton de module exporté par défaut — le cache de modules ESM
  suffit. **Jamais le conteneur IoC** : le projet n'en utilise aucun pour ses services, et
  un `container.swap()` ferait de la substitution un état global à restaurer après chaque
  test. Un test construit sa propre instance avec un double. Voir `app/services/llm.ts` et
  `app/services/dice.ts`.
- **Le temps de jeu n'est pas le port `Clock`.** L'horloge de jeu (`world_states.game_time`,
  secondes depuis minuit du premier jour) se lit et se convertit par `#services/game/game_time`,
  pur : échelle des durées, périodes, jour, date. Le port `Clock` ne sert qu'au temps réel
  (budget du tour). Le front ne reçoit que la période, jamais l'heure ni la date.
- **Tout changement de passage passe par le service des passages** (`#services/game/passages`) :
  découverte, déverrouillage, blocage et dégagement, jamais d'écriture directe dans
  `passage_states`. La topologie (sens de lecture d'un passage, réseaux, lieux qui en contiennent
  un) y est pure, et le parcours (lieux atteignables, chemins, destinations permises, parents
  d'un lieu improvisé — `improvisationParents`, jamais une pièce d'un réseau) vit dans
  `#services/game/travel`, pur lui aussi : arbitrage, extraction et application le lisent,
  jamais le LLM.
- **Un événement du scénario s'évalue par `#services/game/events`** et un emploi du temps par
  `#services/game/schedules`, purs, sur un `WorldSnapshot` lu par `#services/game/game_events`
  (`loadSnapshot`, `loadProgress`) — jamais sur le texte. Tout effet d'événement s'applique par
  `#services/game/apply_events` (`applyEffect`, `settleStateEvents`, `followSchedules`), qui seul
  écrit `event_states` et `place_notes` ; ce qu'un effet pose chez un lieu jamais visité ou un
  unique jamais rencontré passe par `#services/game/pending_effects`, seul à écrire
  `world_states.pending_place_effects`. Un nouvel effet ou une nouvelle condition = une entrée
  dans `EVENT_EFFECT_TYPES` / `EVENT_CONDITION_TYPES`, son validateur, sa vérification dans
  `checkScenario`.
- **Une fin de partie se décide par `gameEndOf`** et s'écrit par `closing()`
  (`#services/game/game_lifecycle`), dans la transaction du tour : jamais un `status` ni un
  `end_reason` écrit à la main. Un événement propose une fin (`applyEvent` renvoie `ended`), le
  tour en garde une. L'épilogue passe par `#services/game/prompts/epilogue`, après le commit.
- **Un round de combat se joue par `playRound`** (`#services/game/combat`), pur, sur le moteur de
  règles, et s'applique par `#services/game/apply_combat` dans la transaction du tour — avant le
  delta de l'extraction, qui ne chiffre jamais un coup. Les références que le backend lit pour
  lui-même (`melee_combat`, `ranged_combat`, `first_aid`, `dodge`) vivent dans
  `#services/game/system_references`.
- **Tout changement d'objet passe par le service d'inventaire** (`#services/game/inventory`) :
  création, transfert, destruction, équipement, placement initial, découverte d'un objet caché
  (`discoverItem`). Jamais d'écriture directe
  dans `inventory_items` : les règles d'unicité, d'empilement et de détenteur y vivent.
- **Tout tirage aléatoire passe par `import dice from '#services/dice'`** — jamais
  `Math.random()` dans le code métier, sinon le moteur de règles n'est plus testable.
- **Toute lecture du temps dans le code du tour passe par le port `Clock`**
  (`#services/clock`, `FakeClock` en test) — jamais `Date.now()` ni `AbortSignal.timeout()`
  directement. Le budget de 3 minutes d'un tour (`TurnBudget`) part de sa prise en charge
  par le worker, et chaque appel LLM reçoit un signal borné au temps restant.
- **Les routes du back-office vivent sous `/api/v1/admin`**, derrière `auth` puis
  `role({ roles: ['game_master'] })` : un joueur reçoit `403 forbidden_role`. Le rôle n'est
  exposé qu'au compte lui-même (`/account/profile`). Comptes de test locaux :
  `player@wanderlore.test`, `gm@wanderlore.test` et `admin@wanderlore.test` (superadmin), mot
  de passe `password`. Ailleurs, le premier superadmin vient de `account:create-superadmin`.
- **Un refus que le client peut traiter** lève `Refusal(status, code, message, details?)`
  (`#exceptions/refusal`), rendu en `{ error: { code, message, details? } }`.
- **Tout appel LLM passe par `import llm from '#services/llm'`** — jamais un provider ni un
  SDK directement. `generateJson()` pour les étapes structurées (A+B+C, E),
  `generateText()` / `streamText()` pour la narration (D).
- **Toute mise en file passe par `import queue from '#services/queue'`** — jamais pg-boss ni
  BullMQ directement. Un job ne transporte que des identifiants ; rien de ce qui garantit
  l'intégrité d'un tour (idempotence, sérialisation, événements SSE) ne repose sur la file.
  Le pilote se choisit dans `config/queue.ts` (`QUEUE_DRIVER`), la suite de tests tourne sur
  le pilote mémoire, et le worker (`start/worker.ts`) ne démarre qu'avec le serveur web.
- **La mémoire d'un tour se lit par `loadMemory`** (`#services/game/summary_service`) et se
  calcule par `#services/game/narrative_memory`, pur : un tour envoie `story_so_far` puis
  **tous** les tours après le dernier résumé (`coveredUpTo`) — jamais une limite fixe, qui
  rouvrirait un trou entre résumés et tours. Le résumé ne lit jamais `arbitration_output`.
- **Un résumé s'écrit dans la file `narrative-summary`** (`SUMMARISE_QUEUE`), jamais dans
  celle des tours, et seulement par `SummaryService` : le job recalcule ce qui est dû, et la
  contrainte d'unicité `(session_id, level, turn_end)` empêche un doublon. Son coût va dans
  `narrative_summaries.llm_usage`, sous la forme de `usageRow()` (`turn_trace`).
- **Tout événement de tour passe par le port `TurnEvents`** (`#services/turn_events` en
  application, `RecordingTurnEvents` en test), émis par le code du tour — jamais dérivé de la
  file. Un envoi raté ne fait jamais échouer un tour : le front rattrape en relisant le tour.
- **Toute référence de contenu envoyée au front passe par `ContentLabels`**
  (`#services/game/content_labels`) et sort en `{ reference, label }`, construit sur l'univers
  de la partie concernée — par requête, ou par tour pour les événements SSE qui le portent —
  et dans une langue (celle du tour pour les événements, l'anglais ailleurs jusqu'au choix
  de langue de la Phase 14), avec repli sur l'anglais. Une référence sans libellé lève
  `MissingLabelError` : jamais de référence brute ni « embellie » en repli.
- **La narration ne reçoit un nom de PNJ que marqué `known`**, et le lieu où mène une sortie
  que s'il a été visité : ce que le personnage sait se lit dans l'état (`known_npcs`, lieux
  visités), jamais dans le récit. Un scénario nouveau déclare `initialState.knownNpcs`, et un
  réseau de lieux du contenu en code passe le test `giveaways`. De même, un fragment de lore
  qui part à la narration ne nomme ni un PNJ unique ni ce qu'il y a derrière un passage :
  vérifié par `loreGiveaways` (`#tests/helpers/knowledge`) sur le contenu en code.
- **Le lore d'un tour se choisit par `#services/game/lore`** (`loreSceneOf`, `loreFor`), pur,
  sur la `WorldDefinition` du tour : la scène donne les tags, jamais le texte du joueur, et
  chaque étape ne reçoit que les `kind` qui la servent — un `secret` jamais la narration. Toute
  étape qui reçoit du lore inscrit ses références dans `turn_log.lore_sent`. Le plafond
  (`TAGGED_LORE_CAP`) est dans le code, pas par univers.
- **Une partie se lit par le scope `listed`** (`Session.query().withScopes((scopes) =>
  scopes.listed())`) dans toute route de jeu et à la soumission d'un tour : une partie
  supprimée par le joueur (`deleted_at`), ou dont le personnage est supprimé, répond comme une
  partie inexistante. Seul le worker la relit sans le scope, pour finir un tour déjà en cours.
  Un personnage se lit de même par le scope `listed` de `Character`.
- **Le personnage d'une partie se lit en deux morceaux** : la fiche durable (`Character` :
  caractéristiques, compétences, profession, genre), jamais copiée, et l'état de la partie
  (`CharacterState` : PV, blessures, ressources). Tout ce qui ne dure qu'une partie s'écrit sur
  `character_states`, jamais sur `characters` — la progression seule écrira sur la fiche. Les
  objets ont pour détenteur `character_states.character_id`, dans la partie.
- **Une partie se lance par `startGame`** (`#services/game/new_game`) et se clôt par
  `#services/game/game_lifecycle` (`lockOwnGame`, `abandonGame`) : l'abandon et la soumission
  d'un tour prennent le même verrou (`forUpdate`) sur la partie. Une partie close
  (`isOngoing` faux) refuse tout tour (`game_ended`).
- **La création d'un personnage se calcule par `createCharacter`**
  (`#services/rules/character_creation`), pur, une suite d'étapes (placement, puis la place de
  l'espèce de la Phase 13bis, plancher de 8, profession, points, identité) — jamais un calcul au
  front ni dans un contrôleur. Le tirage, l'aperçu et l'écriture passent par
  `#services/game/character_creation` (`rollSeries`, `previewCharacter`,
  `createCharacterFrom`) ; les réserves et plafonds par niveau vivent dans
  `#services/rules/power_levels`, pas en base.
- **Seule la narration reçoit des noms traduits** (`names`, `items_in_scene`), dans la seule
  langue du tour, et le glossaire réduit à ses entrées traduites dans cette langue. Arbitrage
  et extraction ne lisent que l'anglais (`label`) — jamais `labels` ni le glossaire.
- **L'univers d'une partie se lit par `loadWorld`** (`#services/game/content/load`), sans
  cache : une fois par tour, à sa prise en charge, et la photo passe à toutes les étapes.
  Aucun code du tour ne relit le contenu en cours de route. Les specs qui donnent un univers
  directement à un service utilisent `THREE_MUSKETEERS` de `#tests/helpers/worlds`.
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
- **Un jet en direct passe par la machine `revealReducer`** (`src/games/roll_reveal.ts`), pure
  et distincte de `turnReducer` (qui repasse à `idle` sur `turn_completed`) : seul un
  `roll_resolved` reçu en direct l'ouvre. Un tour terminé avant le lancer est retenu par
  `useTurn` (`src/games/held_turn.ts`) : rien de ce qui trahirait l'issue — journal, fiche,
  bandeau de scène, voix — ne le reçoit avant la révélation.
- **Le texte d'un jet se construit par `rollText()`** (`src/games/roll_text.ts`), pour la
  pastille comme pour la carte — jamais assemblé à la main.
- **Une préférence d'interface passe par le module `src/preferences.ts`** (`usePreferences`,
  `preferences.setX()`, `useAnimates`) — jamais `localStorage` directement. Le stockage local
  ne contient que le brouillon de saisie et ces préférences : ni jeton, ni donnée de jeu, ni
  rien qui aille en base ou au backend. La clé `wanderlore.theme` est lue aussi par le script
  de premier affichage d'`index.html`.
- **Toute animation notable a sa préférence** (`ANIMATIONS`) et se joue sous `useAnimates()`
  ou `animates()` : `prefers-reduced-motion` est un plancher qu'aucune préférence ne lève. Les
  indicateurs d'état (points d'attente, chargement) n'en ont pas.
- **Couleurs par jetons sémantiques uniquement** (`src/styles.css`) — jamais une valeur brute.
- **Les objets de la table se dessinent par les primitives partagées** : `src/components/surfaces.ts`
  (feuille, carte, plateau, onglet), `actions.ts` (boutons), `stamp.tsx`, `place_tag.tsx`,
  `dice.tsx` (d10, d6), `hit_points.tsx` (pastilles) — jamais redessinés à la main dans un écran.
- **Un composant se teste rendu en HTML statique** (`*.test.tsx`, `renderToStaticMarkup`,
  sous Node) — jamais dans un DOM : la suite Vitest reste sans navigateur.
- En développement, Vite proxifie `/api` et `/__transmit` vers le backend (même origine).

### Back-office (`apps/back-office`)

- **Mêmes conventions que le front joueur** (section précédente) : `api()`, aucun texte en
  dur, erreurs par `code`, jetons de couleur, tests en HTML statique.
- **`src/api/client.ts` est une copie** de celui du front : les garder alignés.
- **Réservé aux `game_master`** : la connexion relit le profil et déconnecte aussitôt tout
  autre rôle ; un compte déjà connecté côté front (cookie partagé) est accueilli sur `/login`
  par un message et un bouton de déconnexion. Le backend refuse de toute façon chaque route
  `/api/v1/admin`.
- En développement, port **5174** (le front reste sur 5173), `/api` proxifié vers le backend.

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
  `fresh` n'accepte même pas `--no-schema-generate`). `migration:reset` le réécrit **vide**,
  ce qui empêche ace de démarrer : ne jamais l'utiliser, base de test comprise. `migration:rollback`
  sur la base de test fait de même : la suite la migre en un seul lot, qu'un rollback annule en
  entier. Pour rejouer une migration pas encore commitée, passer par `MigrationRunner` avec
  `step: 1`, comme les specs de migration.
- **Échec en cascade connu** : environ un passage complet sur trois, des dizaines de tests
  tombent sur « unable to release database lock » (verrou consultatif de Lucid pris et relâché
  sur deux connexions différentes du pool). Relancer avant d'enquêter.
- **Un réseau de lieux de test** : la maison de `#tests/helpers/places` (`HOUSE_WORLD`, et
  `seedHouse()` de `#tests/helpers/content` pour l'écrire en base sur le scénario des
  Mousquetaires) — passages caché, verrouillé, à sens unique, deux entrées.
- **Les tests importent `#services/llm/gateway`**, jamais `#services/llm`, qui construirait
  un vrai client Gemini. `FakeLlmProvider` (`#tests/helpers/fake_llm_provider`) sert de
  double : il **doit** honorer `AbortSignal`, sinon les tests de timeout pendent.
- **Aucun appel à l'API LLM réelle dans la suite.** `node ace llm:ping` couvre ça à la
  demande.
- On ne teste pas le framework (routes AdonisJS, génération d'uuid, middleware d'auth).

## Commandes

Aide-mémoire complet, comptes de test compris : `doc/aide-memoire-dev-testeur.md`.

```bash
docker compose up -d              # PostgreSQL (5433) + Redis (6380), à la racine
npm run dev                       # tous les workspaces via Turborepo
npm run test / lint / typecheck   # idem

cd apps/backend
node ace migration:run            # migre et régénère database/schema.ts
node ace migration:rollback
node ace migration:fresh          # repart d'une base vide
node ace db:seed                  # contenu de jeu, puis compte et partie de test
node ace llm:ping                 # vérifie que le provider LLM répond
node ace llm:cost --input-per-million=… --output-per-million=…
                                  # coût réel par tour, partie, étape, langue (lecture seule)
node ace game:reset               # supprime parties et turn_log (personnages gardés), re-seed la partie de démo (hors prod)
node ace game:reset --no-seed     # supprime sans re-seeder (avant une migration qui refuse les parties)
node ace account:create-superadmin  # crée un superadmin hors de l'interface, production comprise

node ace test                     # suite complète
node ace test unit                # suite unitaire seule (suite en positionnel)
node ace test functional
```
