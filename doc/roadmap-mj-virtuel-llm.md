# Roadmap de développement — Logiciel de jeu de rôle piloté par LLM

## Document de référence technique

> **⚠️ Convention de nommage** : conformément à la convention actée pour le projet, tout le nommage technique (tables, colonnes, valeurs de rôle) est donné en anglais dans ce document. Le texte explicatif reste en français.

**Principe directeur** : construire par fonctionnalités minimales successives, chaque phase restant jouable et cohérente de bout en bout. Aucune phase "à moitié finie" ne doit bloquer la suivante. Les couches les plus coûteuses en architecture (RAG, mémoire hiérarchique, back-office avancé, gestion de comptes fine) sont volontairement repoussées à des phases ultérieures.

**Documents complémentaires** : ce document s'appuie sur trois documents de référence déjà établis — architecture et pipeline LLM, structure de base de données PostgreSQL, système de règles de jeu générique. Les décisions prises ici respectent les principes déjà posés dans ces documents (séparation front/backend, moteur de règles déterministe côté backend, modificateurs contextuels vs modificateurs d'objets, etc.).

**Point de vigilance transversal** : les premières phases s'appuient sur un univers déjà connu du LLM (ex. Star Wars, Le Seigneur des Anneaux) pour accélérer le prototypage, sans construction de lore dédié. Ce choix est valable pour du développement et du test, mais implique une vigilance sur les droits de propriété intellectuelle avant toute diffusion publique ou commerciale — un univers original ou sous licence devra être substitué avant la mise en ligne (voir Phase 5).

---

## Phase 0 — Socle technique minimal

**Objectif** : disposer d'une base technique fonctionnelle, sans aucune logique de jeu encore implémentée.

### Contenu

- Squelette applicatif AdonisJS créé avec `--kit=api`, en **monorepo géré par Turborepo (workspaces)**. Structure par défaut : package `backend` (API AdonisJS) et package `frontend` (front joueur). Un troisième package `back-office` est ajouté en Phase 5 pour les `game_master`, puis accueille l'interface superadmin en Phase 5bis — la structure en workspaces permet cet ajout sans réorganisation du repo.
- **Environnement de dev et de tests locaux sous Docker** : conteneurs PostgreSQL et Redis, pour un environnement reproductible dès la Phase 0 (Redis provisionné dès cette phase en prévision de BullMQ ; la Phase 2 retient finalement pg-boss, et Redis ne devient nécessaire qu'au passage à plusieurs instances).
- Connexion à une base PostgreSQL.
- Tables strictement nécessaires pour un tour de jeu, en version minimale :
  - `sessions`
  - `characters`
  - `world_states`
  - `turn_log`
- Pas encore de tables `worlds`, `lore_fragments`, `resolution_rules` — voir Phase 3 et 5.
- Mise en place d'un LLM Gateway simple : un seul provider LLM, pas encore de choix de modèle différencié par étape du pipeline. Pour cette première phase de test, un provider économique est privilégié (ex. Gemini), cohérent avec le budget cadré en introduction du projet.
- **Choix d'hébergement léger pour la phase de test** : solution peu onéreuse à tier gratuit ou quasi-gratuit (ex. Vercel, Supabase, Railway), suffisante au volume attendu en développement solo et en beta fermé. Budget global visé de l'ordre de 15-20€ mensuels sur l'ensemble hébergement + LLM à ce stade.
- **Table `users` créée dès cette phase**, même si l'authentification n'est pas encore branchée côté front. Structure minimale :
  - identifiant
  - email
  - mot de passe (`password_hash`)
  - `role` (enum : `player` / `game_master` / `superadmin`)
- **Note** : la création d'un projet AdonisJS inclut par défaut un système de register/login scaffoldé (starter kit avec authentification). Ce socle est réutilisable directement pour la Phase 0/2 plutôt que d'implémenter l'authentification from scratch — seul le champ `role` et son enum sont une extension propre au projet, à ajouter au schéma `users` généré par défaut.
- Aucune interface de gestion de comptes, aucun flux d'inscription à ce stade. Un utilisateur de test est créé directement en base pour permettre les phases suivantes.

### Pourquoi poser `users.role` dès maintenant

Même sans usage réel du multi-rôle à ce stade, poser ce champ dès la Phase 0 évite une migration de schéma désagréable une fois que plusieurs types de comptes existeront réellement (Phase 5 et au-delà).

- **Harnais de test** : suites unitaire (sans base) et fonctionnelle (PostgreSQL), cycle de vie de la base, isolation transactionnelle par test, et faux provider LLM réutilisable par toutes les phases suivantes. Voir la section « Stratégie de test » pour le périmètre couvert.

### Critère de sortie de phase

- L'application démarre, se connecte à la base et au LLM externe.
- Un utilisateur de test existe en base avec un rôle défini.
- La suite de tests s'exécute et passe, sans appel à l'API LLM réelle.

---

## Phase 1 — Boucle de jeu minimale, univers "connu" du LLM

**Objectif** : obtenir un cycle de jeu complet et jouable, du texte du joueur jusqu'à la mise à jour de l'état du monde, avec le minimum de sophistication.

### Simplifications volontaires de cette phase

- **Pas de `lore_fragments`, pas de RAG, pas de `resolution_rules` en base.** L'univers choisi (connu du LLM) et les règles de base sont écrits directement dans le system prompt, en dur.
- **Pipeline réduit, en deux branches selon qu'un jet est requis.** Le découpage initialement prévu — un appel LLM unique fusionnant A+B+C+D — a été amendé : dans un appel unique, le modèle narrerait l'issue du jet avant que le backend ne l'ait calculé, ce qui viole l'invariant « le LLM propose, le backend décide ». Retenu à la place :
  - **aucun jet requis** → un seul appel fusionné A+B+C+D, retournant narration + effets ;
  - **jet requis** → un premier appel d'arbitrage (A+B+C, sans narration), puis calcul du jet par le backend, puis un second appel de narration.
  Cela reste en deçà de la séparation complète en cinq étapes, toujours reportée à la Phase 3 : A, B et C restent fusionnés et l'étape E n'existe pas.
- **Résolution simplifiée à un seul type de jet** : `2d6 + valeur de compétence` contre un seuil unique (moteur remplacé par le BRP en Phase 6). Pas de distinction combat / social / autre à ce stade — uniquement "jet requis" ou "pas de jet".
- **Pas de modificateurs**, ni contextuels ni d'objets. Ajoutés en Phase 4.
- **Pas d'étape E séparée.** Le delta de `world_states` est extrait dans le même appel que la narration : un JSON de sortie avec un champ `narration` et un champ `effects`. Conséquence du découpage en deux branches : ce sont **toujours** les effets de l'appel de narration qui font foi, y compris dans la branche avec jet — ils dépendent de l'issue du jet et ne peuvent donc pas sortir de l'arbitrage.

### Contenu

- **Univers retenu** : *Les Trois Mousquetaires*. Connu du LLM, et dans le domaine public — le point de vigilance sur la propriété intellectuelle signalé en tête de ce document ne s'applique donc pas à cette phase.
- Un ou deux appels LLM par tour selon la branche, le dernier retournant toujours une sortie structurée contenant narration + effets.
- **Le narrateur ne reçoit jamais les données mécaniques du jet** — uniquement `result` et la marge qualitative. Contrainte déjà posée par le document d'architecture, mais qui devient concrète ici, l'appel de narration étant séparé dès cette phase dans la branche avec jet.
- Écriture systématique dans `turn_log` dès cette phase, même sous forme minimale — indispensable pour déboguer les tours suivants.
- **Tracking minimal de consommation LLM** : enregistrement du volume de tokens consommés par appel (et donc par tour), même sous forme brute dans `turn_log` ou une table dédiée simple. Cet ajout est mineur techniquement mais conditionne la capacité à chiffrer plus tard un coût réel par tour/par partie — donnée indispensable à toute réflexion future sur un modèle de monétisation (voir document de synthèse, section budget).
- **Colonne `turn_log.language` posée dès cette phase**, à côté du tracking de consommation. Le coût par tour varie sensiblement selon la langue, et un coût moyen toutes langues confondues fausserait la réflexion sur le modèle de revenu. La partie est en anglais à ce stade — la colonne est posée pour que la mesure soit exploitable plus tard, pas parce qu'elle sert déjà.
- **Paramètre `language` présent dans le contexte transmis au LLM dès le premier appel**, même s'il vaut toujours `en` à ce stade. Le document d'architecture (section 4bis) impose qu'il soit explicite et jamais supposé fixe : l'introduire maintenant coûte une ligne, le rétro-ajouter obligerait à reprendre tous les prompts.
- **Jet de dés injectable dès sa première implémentation** : le tirage aléatoire doit passer par un service substituable, faute de quoi le moteur de règles n'est pas testable. C'est une contrainte de conception à respecter tout de suite — la rattraper une fois le moteur appelé de partout est nettement plus coûteux. Même principe pour l'horloge, dès qu'une logique dépend du temps. Voir la section « Stratégie de test ».
- Gestion d'erreur conforme à la décision prise pour le projet : **pas de retry automatique**. Une erreur est renvoyée avec un message spécifique selon le type détecté (timeout, sortie hors schéma, erreur HTTP de l'API externe, échec de validation backend). Un système de log d'erreurs structuré est explicitement différé (voir Phase 11 / todolist).
- Pas encore de front : validation du pipeline via des requêtes directes (Postman, curl, ou équivalent).

### Critère de sortie de phase

- Un tour de jeu complet est exécutable de bout en bout dans un univers connu, avec mise à jour effective de `world_states` et retour d'une narration cohérente.
- Les erreurs du pipeline renvoient un message différencié selon leur nature.

---

## Phase 2 — Front minimal

**Objectif** : rendre le pipeline de la Phase 1 accessible via une interface web basique, avec authentification joueur.

### Décisions de cadrage

Tranchées à l'ouverture de la phase, avant toute implémentation :

- **Stack front** : Vite + React, Tailwind CSS, TanStack Router. TanStack Query envisagé pour les lectures (partie, personnage, historique), à confirmer à l'usage.
- **Internationalisation du front dès la Phase 2**, avec une bibliothèque d'i18n, même si elle ne contient au départ que l'anglais. Tous les textes d'interface passent par ses fichiers de traduction, jamais en dur : ajouter une langue ne doit être qu'un travail de traduction, pas une reprise de chaque écran. Bibliothèque retenue : **react-i18next** (motifs : cahier des charges front, section 7). Pas de sélecteur de langue avant la Phase 11.
- **Authentification par cookie de session** (guard `web`, déjà configuré dans le scaffolding) plutôt que par access token. Motif : le flux SSE repose sur `EventSource`, qui ne peut pas porter d'en-tête `Authorization` mais envoie nativement les cookies. En développement, le serveur Vite proxifie l'API : front et backend partagent la même origine, sans configuration CORS avec credentials. Contrepartie : l'authentification par cookie expose au CSRF — la protection de `@adonisjs/shield`, aujourd'hui désactivée, est à activer.
- **File de jobs derrière un port, servie par pg-boss.** La file est un service substituable (port, adaptateur choisi dans la configuration), comme le LLM Gateway. **pg-boss** stocke ses jobs dans PostgreSQL : aucun Redis à héberger tant qu'il n'y a qu'une instance, et l'hébergement léger de la phase de test n'a qu'une base à fournir. **BullMQ reste la cible** du passage à plusieurs instances, qui ramène de toute façon Redis pour le transport de Transmit : la bascule se fera en écrivant l'adaptateur BullMQ et en changeant la configuration, file vidée. Contrepartie acceptée : pg-boss interroge la base à intervalle régulier au lieu d'être notifié ; l'intervalle est réglé explicitement pour ne pas retarder visiblement le début du tour.
- **Rien de ce qui garantit l'intégrité d'un tour ne dépend de la file** — c'est la condition d'une bascule simple :
  - le job ne transporte que l'identifiant du tour, tout l'état est lu en base ;
  - l'idempotence vit dans `turn_log`, jamais dans la déduplication propre à l'outil ;
  - la sérialisation des tours relève de `concurrency: 1`, puis d'un verrou PostgreSQL par `session_id` — jamais d'une fonctionnalité de file ;
  - les événements SSE sont émis par le code du tour via Transmit, jamais dérivés des événements de la file ;
  - aucune logique ne repose sur la mise en file dans la même transaction que l'écriture du tour (pg-boss le permet, BullMQ non). Un tour resté `pending` au-delà d'un délai — process arrêté en cours de tour, mise en file échouée — est passé en échec.
  - **Tranché (KAN-18)** : délai de 5 minutes, balayage au démarrage du worker puis chaque minute ; échec immédiat si la mise en file échoue. Détail : architecture, section 8bis.
- **Worker dans le process HTTP**, démarré au boot du serveur web (pas en environnement de test ni de console). C'est l'option la plus simple : un seul process à lancer, et Transmit diffuse en mémoire sans transport Redis — l'événement émis par le job atteint directement les connexions SSE du même process. **Limite assumée** : ne passe pas à plusieurs instances. Un worker séparé imposera le transport Redis de Transmit ; à reprendre au plus tard en Phase 11.
- **Pas de retry de la file** (`retryLimit: 0` avec pg-boss, `attempts: 1` avec BullMQ), conformément à la décision projet sur les erreurs LLM.
- **Clé d'idempotence fournie par le client** pour la protection contre les doubles soumissions (voir ci-dessous).
- **Événements SSE limités aux jalons**, sans streaming de la narration (voir document d'architecture, section 8bis).

### Contenu

- Interface de chat : historique de messages + champ de saisie.
- Affichage en lecture seule des statistiques du personnage (points de vie, compétences). Pas d'inventaire à ce stade (aucun objet n'existe encore dans le système).
- **Routes de lecture** nécessaires au front : liste des parties du joueur, détail d'une partie (personnage, historique des tours pour le chat), lecture d'un tour. Cette dernière sert aussi de rattrapage quand le flux SSE a été manqué ou coupé.
- **Exécution asynchrone du pipeline via la file de jobs (pg-boss), avec retour progressif via AdonisJS Transmit (SSE)** : le front soumet l'action du joueur, reçoit un accusé de réception (`202`), puis affiche des messages d'attente contextuels au fil des événements reçus (étape en cours, jet résolu) jusqu'au résultat final du tour. Voir document d'architecture, section 8bis, pour le contrat d'événements. Ce choix remplace l'hypothèse initiale d'une réponse synchrone simple, dès cette phase plutôt qu'en Phase 11.
- **Sérialisation des tours par partie** — point non négociable, découvert en Phase 1 : un tour passe plusieurs secondes en attente du LLM entre la lecture du dernier numéro de tour et son écriture. Deux soumissions rapprochées calculent donc le même numéro. **Un seul joueur qui envoie deux fois suffit** : ce n'est pas un problème de multi-joueur. La contrainte d'unicité `(session_id, turn_number)` le rattrape et doit être conservée comme dernier filet, mais elle n'est pas une solution.
  - La file **ne règle pas ce point par sa seule présence** : sa concurrence se paramètre par worker, pas par clé (BullMQ ne sérialise par clé qu'avec les *groups* de sa version Pro, payante). Les pistes générales sont un verrou par `session_id` autour du job — en PostgreSQL, pour rester indépendant de la file — ou une file par partie (ingérable).
  - **Retenu pour cette phase : un worker unique en `concurrency: 1`.** Les tours s'exécutent strictement l'un après l'autre, chacun lisant l'état laissé par le précédent : la course sur le numéro de tour disparaît. Le prix — un débit plafonné toutes parties confondues — est sans effet tant qu'un seul joueur teste. **À reprendre avant le beta test** (Phase 11), avec un verrou PostgreSQL par `session_id`.
  - **La mise en file ne suffit pas non plus** : deux jobs valides produiraient deux tours de jeu là où le joueur en voulait un, chacun facturé — une erreur bruyante remplacée par un état de jeu faux. **Retenu : une clé d'idempotence fournie par le client** avec chaque soumission.
    - Une clé identifie **une soumission**, pas un texte : le client en génère une par action envoyée, et la réutilise telle quelle s'il renvoie la même requête (double clic, perte réseau avant l'accusé de réception). Le backend qui reçoit une clé déjà connue renvoie l'accusé du tour existant sans remettre de job en file.
    - La clé est enregistrée **au moment de la soumission**, avant la mise en file — un enregistrement en fin de tour laisserait passer le doublon pendant toute la durée des appels LLM. Elle est aussi conservée dans `turn_log`, sous contrainte d'unicité par partie.
    - Le **numéro de tour est attribué quand le tour aboutit**, dans la transaction qui applique ses effets (KAN-17). Un tour `pending` ou `failed` n'en a pas : la numérotation reste celle de l'histoire, sans trou, et la contrainte `(session_id, turn_number)` continue d'attraper deux tours concurrents — le perdant passe `failed`. Un tour se désigne donc par son identifiant, jamais par son numéro.
    - Le bouton de nouvelle tentative après un `turn_failed` est une **nouvelle** soumission, donc une nouvelle clé : réutiliser l'ancienne renverrait le tour échoué.
    - Désactiver le bouton côté front reste une commodité d'ergonomie, pas une protection.
- Gestion d'erreur côté front : affichage d'un message spécifique à la catégorie d'erreur (via l'événement `turn_failed` ou en cas d'échec de soumission), traduit par l'i18n du front d'après le `code` renvoyé par l'API — le `message` textuel de l'API ne sert qu'au débogage et de repli pour un code inconnu, avec un bouton de nouvelle tentative qui réutilise l'input déjà saisi (le joueur ne doit jamais avoir à retaper son texte après une erreur).
- **Authentification joueur simple** : connexion par identifiant/mot de passe, par cookie de session (voir décisions de cadrage), en s'appuyant sur le système register/login inclus par défaut dans le scaffolding AdonisJS posé en Phase 0 — pas de système d'authentification à construire from scratch. Un seul rôle actif à ce stade (`player`) — pas de distinction fonctionnelle par rôle côté front.
- `sessions.user_id` est une relation vers un compte authentifié réel — déjà en place depuis la Phase 0 (clé étrangère vers `users`), et la Phase 1 cherche déjà la partie parmi celles du joueur connecté.
- Pas d'inscription libre nécessaire à ce stade : un compte peut encore être créé manuellement en base.

### Critère de sortie de phase

- Un joueur authentifié peut jouer un tour complet depuis l'interface web, avec affichage correct de l'état de son personnage, retour progressif via SSE pendant l'exécution du tour, et gestion visible des erreurs.

---

## Phase 3 — Retour au pipeline complet, séparation des étapes

**Objectif** : remplacer l'appel fusionné de la Phase 1 par le pipeline complet tel que défini dans le document d'architecture, une fois la boucle de base validée en usage réel.

### Décisions de cadrage

Tranchées en clôture de la Phase 2 :

- **Une seule nouvelle tentative sur une sortie structurée rejetée.** Quand le backend rejette la sortie JSON d'une étape (A+B+C ou E) — JSON illisible, hors schéma, hors bornes, référence absente de la liste fermée —, l'appel est renvoyé une fois avec un message correctif qui nomme les valeurs rejetées et rappelle la liste valide. Un second rejet fait échouer le tour. Les erreurs de transport ne sont toujours pas retentées. Détail : architecture, section 7.
- **Narration en streaming dès cette phase** (événement `narration_chunk`). La narration diffusée reste provisoire jusqu'à `turn_completed`, et le front la retire si le tour échoue ensuite. Détail : architecture, section 8bis.
- **Budget de 3 minutes par tour**, compté depuis sa prise en charge : chaque appel LLM reçoit au plus le temps restant, et un budget épuisé fait échouer le tour en `llm_timeout`. Le balayage des tours `pending` reste à 5 minutes et ne peut plus expirer un tour vivant. Détail : architecture, section 8bis.
- **Un seul modèle pour toutes les étapes** (`gemini-2.5-flash`, remplacé en octobre 2026 par `gemini-3.8-flash`, le premier n'étant plus ouvert aux nouvelles clés API) pendant les phases de test. La séparation des étapes rend la différenciation possible, mais elle attend les mesures de coût réelles (Phase 11).

### Contenu

- Séparation effective des étapes :
  - Appel A+B+C (interprétation, validation, résolution) — sortie structurée.
  - Calcul du jet en étape backend déterministe isolée, avec traçabilité complète (`applied_modifiers`) enregistrée dans `turn_log`.
  - Appel D (narration) — texte libre.
  - Appel E (extraction des effets) — sortie structurée, validée avant application au state.
- Cette séparation permettra d'utiliser un modèle LLM différent (potentiellement moins coûteux) pour l'extraction que pour la narration — pas avant la Phase 11 (voir décisions de cadrage).
- Narration en streaming : événement `narration_chunk`, et côté front un bloc de narration qui grandit puis se remplace par le tour persisté, ou se retire sur `turn_failed`.
- Introduction de la table `resolution_rules` en base — encore limitée à un seul univers, mais structurée proprement plutôt qu'écrite en dur dans le prompt. Premier pas vers la généricité multi-univers. Schéma réduit (`world_reference`, `action_type`, `description`, `associated_skill`), rempli par un seeder de contenu idempotent (voir document de base de données). L'arbitrage choisit désormais un `action_type` et non plus une compétence : `skill_used` disparaît de sa sortie, le backend déduit la compétence, et les valeurs de compétence du personnage ne sont plus transmises à l'arbitrage (architecture, section 6, étape 1).
- **PNJ : définitions et instances** (tranché avant la phase — architecture, section 6ter). PNJ uniques, archétypes et PNJ improvisés passent par un seul mécanisme :
  - **catalogue en dur** dans la définition d'univers, comme les lieux, avec ses libellés : chaque définition est `unique` ou `archetype`, et quelques archétypes **génériques** (`commoner`, `thug`, `soldier`…) servent aux PNJ improvisés ;
  - **table `npc_instances`** (voir document de base de données) : `handle` attribué par le backend (`treville`, `cardinal_guard_2`), nom appris, descripteur, disposition en label qualitatif, statut `present` / `absent` / `dead` ;
  - les PNJ présents sont transmis au contexte (`npcs_present`) ; l'étape E extrait les entrées en scène (définition + descripteur), les sorties, les noms appris et les changements de disposition, toujours depuis des **listes fermées** — le LLM ne crée pas de PNJ ayant un état ;
  - objectif : qu'une réaction de PNJ ait une suite d'un tour à l'autre (un PNJ insulté reste hostile), et que le passant imprévu devienne un PNJ suivi, sans rien toucher au moteur de règles.
- **Lieux : même modèle que les PNJ** (tranché avant la phase — architecture, section 6quater) :
  - catalogue en dur enrichi : chaque lieu est `unique` (avec son parent) ou `archetype` (`tavern`, `town`, `road`…), et quelques lieux de grande échelle (`france`, `england`) servent de racines ;
  - **table `location_instances`** : un lieu unique y entre à sa première visite, un lieu improvisé y est créé avec définition, parent, descripteur et nom éventuel ; `world_states.visited_locations` est remplacé par `current_location_id` ;
  - l'extraction propose un déplacement vers un lieu unique ou vers un nouveau lieu d'archétype ; au changement de lieu, les PNJ présents passent `absent`, sauf ceux qui suivent le joueur (`npcs_following`) ;
  - le front affiche le nom propre du lieu, sinon « archétype · parent » ;
  - objectif : qu'un voyage hors catalogue (« je file à Orléans ») soit suivi par le state au lieu d'être rejeté, et que la narration et le state ne divergent plus.

### Critère de sortie de phase

- Le pipeline complet en 5 étapes (A+B+C, calcul de jet, D, E, validation/persistance) fonctionne de bout en bout, avec un `turn_log` détaillé par étape.
- **Étape 1 de la démarche budget/monétisation réalisable** : le tracking de consommation mis en place en Phase 1 permet, à partir de cette phase, de mesurer un coût moyen réel par tour et par partie (voir document de synthèse, section budget) — première donnée chiffrée disponible pour instruire une future réflexion sur un modèle de revenu.

---

## Phase 4 — Inventaire et modificateurs d'objets

**Objectif** : introduire la gestion d'objets et leur impact mécanique sur les jets, conformément au document de référence sur le système de règles.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (epic `KAN-44`) :

- **Objets : définitions et instances, sur le modèle des PNJ** (architecture, section 6bis). Définitions `unique` ou `archetype`, archétypes génériques pour l'improvisé, `stackable` pour l'interchangeable, `equippable`, modificateurs, détenteur initial facultatif pour un unique. En dur dans la définition d'univers, avec un seul libellé anglais ; les noms par langue arrivent en Phase 5 avec tout le contenu.
- **Trois détenteurs : le personnage, un PNJ, un lieu.** Un objet de quête peut être aux mains d'un PNJ ou rangé dans un lieu ; un PNJ qui prend la lettre du joueur l'ajoute à son inventaire ; une lettre cachée dans un coffre passe dans celui du lieu. Donner, voler, cacher, poser, ramasser sont des **transferts** ; `gone` est réservé à l'objet détruit ou consommé. À la mort d'un PNJ, ses objets passent au lieu courant.
- **Table `inventory_items`** : une ligne par instance, trois clés étrangères de détenteur dont exactement une renseignée, handle d'exemplaire stable d'un détenteur à l'autre, état `carried` / `equipped` / `gone`, `equipped` réservé au personnage (document de base de données).
- **Objets en scène** : ceux du personnage, des PNJ présents et du lieu courant. Seuls eux sont transmis au pipeline et peuvent changer de mains dans un tour. Pas d'indicateur « caché » : le narrateur ne révèle pas sans raison ce que détient un PNJ ou un lieu.
- **Modificateurs contextuels** : labels qualitatifs (`minor_bonus` +1, `major_bonus` +2, `minor_penalty` -1, `major_penalty` -2), convertis par le backend, 3 au plus par jet (règles, section 5.1). Barème passé en pourcentage en Phase 6.
- **Modificateurs d'objets** : ne comptent que pour leur détenteur, une fois par définition, sans emplacements d'équipement (règles, section 5.2).
- **Dégâts = dégâts du coup + bonus de l'arme**, le bonus étant un modificateur d'objet ciblant les dégâts ; dégâts du coup = marge ÷ 2 arrondie au supérieur, au moins 1 (règles, section 7). La formule est posée et testée ici, son branchement dans le tour attend la Phase 10. Remplacée en Phase 6 par celle du BRP, la marge disparaissant.
- **Arme ordinaire d'un PNJ** : simple référence dans son profil de combat ; un objet spécial est détenu par lui comme tout objet (règles, section 8).
- **Durabilité et charges différées** ; les consommables passent par la quantité.
- **`world_states.world_objects` retiré**, remplacé par l'inventaire des lieux.

### Contenu

- Catalogue d'objets en définitions dans la définition d'univers, effets mécaniques compris (modificateurs avec cible — compétence ou dégâts —, `value`, `condition` `owned` ou `equipped`).
- Table `inventory_items` et service d'inventaire : création, transfert entre détenteurs, destruction, équipement, placement initial des objets de quête.
- **Séparation référence / libellé.** La référence stable anglaise est l'identité de l'objet pour le code et le LLM ; le libellé est ce que voit le joueur. Une ligne d'instance ne stocke aucun nom : le passage aux noms par langue, en Phase 5, ne demandera aucune migration de parties déjà jouées.
- **L'étape d'extraction reçoit une liste fermée** — définitions créables et objets en scène — et ne peut ni inventer un objet, ni déplacer un objet hors scène. Un objet inventé n'aurait ni effets mécaniques, ni référence, ni traduction.
- **Modificateurs contextuels** proposés par l'arbitrage, jusqu'ici absents (Phase 1 : « ajoutés en Phase 4 »).
- Calcul des modificateurs d'objets **exclusivement côté backend**, au moment du calcul du jet — jamais proposés ou chiffrés par le LLM. Le rapprochement se fait par la référence de la définition, jamais via un nom d'affichage.
- Distinction effective, dans le résultat de jet et dans `turn_log`, entre modificateurs contextuels (source : LLM) et modificateurs d'objets (source : backend).
- Extension du front pour afficher l'inventaire du personnage (lecture seule), libellés résolus côté backend. Ce que détiennent les PNJ et les lieux n'est pas affiché : le joueur l'apprend par la narration.
- **Données de combat des PNJ** : compétences, points de vie et arme ordinaire, au même format que celles d'un personnage joueur (voir système de règles, section 8), et fonction de dégâts. Elles arrivent avec l'inventaire, dont dépend le bonus d'arme, pour que la Phase 10 trouve un modèle mécanique complet.

> **Note de séquencement** : le catalogue d'objets en base n'arrive qu'en Phase 5, avec les tables `worlds` et `scenarios`. En Phase 4, les définitions d'objets vivent en dur dans la définition d'univers, comme les PNJ et les lieux depuis la Phase 3 — l'important est que la séparation référence/affichage et le principe de liste fermée soient posés dès maintenant.

### Critère de sortie de phase

- Un objet possédé ou équipé influence correctement un jet, avec traçabilité claire de l'origine du bonus/malus appliqué.
- L'étape d'extraction ne peut pas faire apparaître un objet absent de la liste transmise.

---

## Phase 5 — Généricité multi-univers et back-office minimal

**Objectif** : sortir du cadre d'un univers unique codé en dur, et permettre la création de nouveaux univers/scénarios via une interface dédiée. Introduction du rôle `game_master`.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (epic `KAN-58`) :

- **Back-office : même stack que le front joueur** (Vite + React + TypeScript, Tailwind CSS 4, TanStack Router et Query, react-i18next, Vitest), mêmes conventions (`api()`, aucun texte en dur, jetons de couleur sémantiques, tests en rendu HTML statique).
- **Hébergement séparé, sur trois sous-domaines d'un domaine à nous** (`app.`, `admin.`, `api.`). Les trois applications forment ainsi un même site au sens du navigateur : le cookie de session reste `SameSite=Lax` et n'est jamais un cookie tiers, ce qui préserve aussi le flux SSE. L'API autorise les deux origines en CORS avec `credentials` ; le cookie de session et le cookie CSRF sont posés sur le domaine parent, lisible par les deux applications. Origines et domaine du cookie viennent de variables d'environnement ; en local, le proxy Vite reste la règle. Un domaine fourni par une plateforme (`*.up.railway.app`, `*.onrender.com`…) ne convient pas : il est inscrit sur la *Public Suffix List*, et ses sous-domaines y sont des sites distincts.
- **Premier compte `game_master` créé par seeder**, comme le compte de test, restreint aux environnements locaux. L'administration des comptes attend la Phase 5bis.
- **L'univers est chargé une fois par tour, sans cache.** Une fonction de chargement reconstruit, à partir des tables de contenu et de la surcharge scénario sur univers, la même forme `WorldDefinition` que la constante de la Phase 4. Le worker l'appelle à la prise en charge du tour et passe cette photo à toutes les étapes : un contenu modifié pendant un tour ne peut pas faire diverger l'arbitrage, l'extraction et l'application. Les libellés (`ContentLabels`) se construisent par requête ou par tour, d'après l'univers de la partie, et non plus au chargement du module. Pas de cache : son gain (quelques millisecondes face à trois appels LLM) ne justifie pas une invalidation à partager entre instances ; à réexaminer en Phase 11 sur mesures réelles.
- **Un personnage prétiré et un état initial par scénario.** Le scénario porte le personnage (nom, attributs, compétences, points de vie, ressources, objets de départ, équipés ou non) et l'état de départ (lieu, quêtes actives, chapitre initial). Lancer une partie les copie dans une partie neuve — ce que fait aujourd'hui le seeder de démo, à partir de la base. Aucune personnalisation avant la création guidée de la Phase 10 ; plusieurs prétirés au choix par scénario, plus tard.
- **Le back-office couvre tout ce dont un tour a besoin**, faute de quoi un univers créé ne serait pas jouable : en plus des formulaires listés plus bas, les catégories d'action (`resolution_rules`), les archétypes génériques, les profils de combat des PNJ et les ressources. Formulaires pour les champs simples (références, libellés, descriptions, rattachements) ; **champ JSON brut validé par le backend** pour les structures imbriquées (profil de combat, modificateurs d'objet), une saisie invalide étant refusée avec un message précis.
- **Scénario en brouillon (`draft`) ou publié (`published`), cohérence vérifiée à la publication.** Le backend contrôle les références croisées (compétence → attribut, `action_type` → compétence, lieu → parent, objet → détenteur initial), la présence des archétypes génériques dont l'improvisation a besoin, et la validité du personnage prétiré et de l'état initial. Un joueur ne voit que les scénarios publiés.
- **Un `game_master` peut lancer une partie** sur n'importe quel scénario, brouillons compris, depuis le front joueur : c'est ainsi qu'il teste un scénario avant de le publier, sans outillage dédié. La restriction initialement prévue (« un compte `game_master` ne peut pas créer de partie ») est levée.
- **Trois catalogues de même forme** : `npc_definitions`, `location_definitions` et **`item_definitions`** (table dédiée plutôt que `scenarios.item_catalog`), chacun avec univers obligatoire et scénario facultatif. **La surcharge vaut pour les trois** : une définition de scénario remplace celle de l'univers de même référence. Compétences, attributs, ressources et catégories d'action restent propres à l'univers, sans surcharge.
- **Contenu déjà joué** : une référence est **immuable après création** (saisie une fois, verrouillée ensuite) ; une définition ne se supprime que si **aucune instance** ne l'emploie, toutes parties confondues ; libellés, descriptions et mécanique restent modifiables et valent pour les parties en cours dès le tour suivant. Le versionnement complet du contenu reste ouvert (Phase 11).
- **Noms d'affichage par langue sur chaque définition**, et sur chaque compétence, attribut, ressource, chapitre et quête : anglais obligatoire, autres langues facultatives avec repli sur l'anglais. Ces noms forment déjà le glossaire des PNJ et des lieux ; **le glossaire ne porte plus que les noms propres qui ne sont pas des entités** (factions, figures historiques hors scène), saisi au niveau de l'univers et complété par le scénario. Le modèle accepte tout code de langue : la liste des langues cibles reste ouverte, le joueur ne choisissant sa langue qu'en Phase 11.
- **Ce qui sort de la définition en dur** :
  - `worlds` : `reference` stable (cible de la clé étrangère de `resolution_rules`, qui remplace `world_reference`), noms d'affichage, `narrative_tone`, `rules` et `ambiance` en listes de phrases (même rôle qu'aujourd'hui pour l'arbitrage et la narration, jusqu'au lore de la Phase 8), `attributes`, `skills` et `resources` chacun dans sa colonne `jsonb` plutôt que regroupés dans `general_rules` ;
  - `scenarios` : synopsis, chapitres et quêtes en listes `{ reference, labels }`, personnage prétiré, état initial, statut ;
  - **différés** : `content_boundaries` (modération, Phase 11), `branch_points` et conditions de progression des chapitres (tant qu'aucun tour ne sait les exploiter).
- **Les Trois Mousquetaires passent en base** par un seeder de contenu idempotent placé en tête (`01_`), qui crée l'univers et son scénario publié d'après leur référence ; `world.ts` ne garde que les types. `sessions` reçoit `world_id` et `scenario_id` **`NOT NULL`, sans reprise de données** : seules existent des parties de dev et de test, recréées par `game:reset`.
- **Pas de versionnement de structure des `jsonb`** à ce stade : chaque `jsonb` saisi est validé côté backend avant écriture, et aucune donnée de production n'existe à faire migrer.

Tranchés en cours de phase, laissés ouverts au découpage :

- **Code commun du back-office copié**, pas partagé dans un package : le client API, les jetons de couleur et le thème, signalés comme copies du front joueur.
- **Scénario publié modifié ensuite** : il reste publié, et sa cohérence est revérifiée au lancement de chaque partie plutôt que de bloquer les modifications qui la casseraient (`scenario_not_playable`, avec la liste des incohérences).
- **Une incohérence de nature** (unique générique ou empilable, archétype avec parent ou détenteur initial) est refusée par l'API sur le champ fautif (`kind_mismatch`), en amont des contraintes de la base.
- **`node ace game:reset --no-seed`** vide les parties avant la migration qui les refuse.

### Contenu applicatif

- Tables `worlds` et `scenarios` en base, avec attributs et compétences paramétrables par univers, conformément au document de référence sur le système de règles.
- **Définitions d'objets en base** : catalogue fermé des objets de l'univers et du scénario (référence stable, `unique` / `archetype`, effets mécaniques, noms d'affichage par langue), qui remplace la liste en dur de la Phase 4 et devient la source de vérité alimentant la liste transmise à l'étape d'extraction. Même forme que les définitions en dur de la Phase 4, dans une table dédiée `item_definitions` (voir décisions de cadrage).
- **Table `location_definitions`** : catalogue des lieux de l'univers et du scénario, même forme que `npc_definitions` plus le parent, qui remplace la liste en dur de la Phase 3.
- **Table `npc_definitions`** : catalogue des PNJ de l'univers et du scénario (uniques, archétypes, archétypes génériques), une définition de scénario surchargeant celle de l'univers de même référence. Elle remplace la liste en dur posée en Phase 3 et devient la source de vérité de la liste fermée transmise au pipeline — même trajectoire que `item_catalog`. Voir architecture, section 6ter.
- **Glossaire** : noms propres qui ne sont pas des entités (factions, figures historiques hors scène) et leurs traductions, au niveau de l'univers et complété par le scénario ; les noms des PNJ et des lieux viennent de leurs définitions. Injecté à la seule étape de narration pour figer la cohérence des noms d'un tour à l'autre. Voir document d'architecture, section 4bis.
- **Création du troisième package du monorepo, `back-office`** (aux côtés de `backend` et `frontend` posés en Phase 0) : formulaires CRUD basiques pour créer/éditer un univers (nom, ton narratif, attributs, compétences, règles générales) et un scénario (synopsis, structure de chapitres, catalogue d'objets, glossaire). Pas d'assistance LLM à la création, pas d'import de fichiers à ce stade.
- Possibilité, à partir de cette phase, de basculer vers un univers original si une diffusion plus large est envisagée (voir point de vigilance en introduction).

### Contenu lié à la gestion de comptes

- **Introduction du rôle `game_master`**, actif pour la première fois à cette phase — c'est le rôle qui utilise le back-office.
- Middleware de contrôle d'accès par rôle : un compte `player` ne peut pas accéder aux routes de back-office ; un compte `game_master` peut en revanche jouer, brouillons compris, pour tester son contenu (voir décisions de cadrage).
- Ajout d'un champ `created_by` (FK vers `users`) sur `worlds` et `scenarios`, pour tracer la propriété du contenu dès qu'il existe plusieurs comptes MJ — sans encore restreindre l'édition entre MJ à ce stade (tout MJ peut éditer tout contenu).

### Critère de sortie de phase

- Un compte `game_master` peut créer un univers et un scénario complets depuis le back-office, jouables ensuite par un compte `player`.
- Le contrôle d'accès par rôle empêche un `player` d'accéder au back-office.

---

## Phase 5bis — Gestion des comptes (rôle superadmin)

**Objectif** : permettre l'administration des comptes eux-mêmes, une fois qu'il existe réellement plusieurs types de comptes à gérer. Cette phase est volontairement positionnée après la Phase 5 : introduire le rôle `superadmin` plus tôt n'aurait rien de concret à administrer.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (epic `KAN-71`) :

- **Premier superadmin par une commande** `node ace account:create-superadmin` (nom, email, mot de passe saisi masqué), utilisable en production — un seeder ne suffit pas, les nôtres sont réservés aux environnements locaux. En plus, un compte de test local `admin@wanderlore.test` par seeder, comme les deux autres.
- **Un compte = un rôle** : le superadmin gère les comptes et seulement eux ; le `game_master` garde le contenu. Le back-office accueille les deux rôles, chacun ne voyant que ses sections ; les routes `/api/v1/admin/accounts` sont réservées au superadmin.
- **Suspension par `users.suspended_at`** : connexion refusée (`account_suspended`) ; une session déjà ouverte est coupée à la requête suivante — la session est un cookie chiffré, impossible à révoquer côté serveur, donc l'état du compte est relu à chaque requête ; les parties sont conservées et retrouvées à la réactivation.
- **Garde-fous** : un superadmin ne peut pas se suspendre lui-même, et le dernier superadmin actif ne peut pas être suspendu.
- **Création d'un compte** : nom, email, rôle et mot de passe initial, transmis par le superadmin hors de l'application. Ni envoi d'email ni changement de mot de passe imposé avant la Phase 11.
- **Hors périmètre** : changement de rôle d'un compte existant, modification d'email, suppression ; l'inscription libre (`/auth/signup`) reste en l'état, et crée toujours un `player`, jusqu'aux modalités d'inscription de la Phase 11.

Tranchés en cours de phase :

- **Un email déjà pris** à la création d'un compte est refusé par la validation, sur le champ `email` (422), plutôt que par un code dédié.
- **Une session coupée** renvoie vers la connexion sans message particulier ; le message « compte suspendu » s'affiche à la tentative de reconnexion.
- **Le dernier superadmin actif** ne peut pas être suspendu, règle portée par le service : par l'API, celui qui agit est lui-même un superadmin actif, qui ne peut pas se suspendre.

### Contenu

- Interface superadmin minimale, ajoutée au sein du package `back-office` déjà créé en Phase 5 (pas de nouveau package à créer) :
  - liste des comptes existants,
  - création manuelle de compte avec attribution de rôle,
  - suspension / réactivation de compte.
- Pas de gestion fine de permissions à ce stade : uniquement les trois rôles fixes (`player` / `game_master` / `superadmin`), pas de rôles personnalisés, pas de délégation partielle.
- Le tout premier compte superadmin est créé directement en base (bootstrap), pas via l'interface elle-même, pour éviter le problème classique de l'œuf et la poule sur la création du premier administrateur.

### Critère de sortie de phase

- Un superadmin peut créer, suspendre et réactiver un compte de n'importe quel rôle depuis une interface dédiée.

---

## Phase 6 — Bascule sur le système BRP

**Objectif** : remplacer le moteur de règles maison (2d6 + compétence) par le *Basic Roleplaying* de Chaosium (édition 2023, licence ORC), pour s'appuyer sur un système existant et éprouvé plutôt que sur des règles inventées. Insérée avant le lore étendu : tout contenu écrit ensuite l'est directement au format BRP.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (2026-10-25, epic `KAN-78`), d'après une lecture complète de l'« ORC Content Document » du livre (détail : système de règles, sections 2 à 7) :

- **Le BRP pour tous les univers**, Trois Mousquetaires et Mythe compris : un seul système, un seul moteur.
- **Jet d100 sous la chance**, calculée par le backend : base (compétence, ou caractéristique × 5), multipliée par la difficulté, puis modificateurs contextuels et d'objets ajoutés. 01–05 réussit toujours, 96–00 échoue toujours.
- **Difficulté en trois labels** : `easy` (× 2), `average`, `difficult` (÷ 2). Les modes de résolution de l'arbitrage (succès automatique, échec automatique, jet) ne changent pas et couvrent l'« automatique » et l'« impossible » du livre.
- **Modificateurs contextuels** : mêmes quatre labels, 3 au plus, barème en pourcentage — `minor` ±10, `major` ±20. Le livre va jusqu'à ±50 ; les cas extrêmes passent par la difficulté, pour borner l'influence de l'arbitrage.
- **Sept caractéristiques fixes** (`STR`, `CON`, `SIZ`, `INT`, `POW`, `DEX`, `CHA`), enum fermé du système : **les attributs par univers disparaissent**. Une règle de résolution désigne une compétence ou une caractéristique (jet à × 5) ; chaque univers choisit d'exposer ou non des jets de caractéristique comme `action_type`.
- **Compétences en pourcentage**, avec une catégorie (enum fermé) et une chance de base (fixe, ou caractéristique × multiplicateur) ; **une compétence absente de la fiche vaut sa chance de base**. Une spécialité est une compétence à part entière ; pas de bonus de catégorie.
- **Cinq degrés de réussite** (`critical`, `special`, `success`, `failure`, `fumble`) remplacent les paliers de marge ; le champ **`margin` devient `degree`**.
- **Le joueur voit le détail de chaque jet** : compétence ou caractéristique et sa valeur, modificateurs appliqués avec leur valeur (une circonstance par son label d'effet, un objet par son nom), chance finale, résultat du d100, degré. Transmis par `roll_resolved` et la lecture du tour ; le front n'en calcule rien. **Le narrateur, lui, ne reçoit toujours que le résultat et le degré** : l'invariant tient.
- **Points de vie du personnage dérivés** de la fiche, `(CON + SIZ) ÷ 2` ; ceux des PNJ restent saisis. Les points de vie totaux attendent la Phase 10.
- **Modificateurs d'objets en pourcentage**, même mécanisme. Le bonus d'arme disparaît, remplacé par un **profil d'arme** sur la définition d'objet : compétence, dés de dégâts, usage du modificateur de dégâts, type d'effet spécial.
- **Formule de dégâts du BRP** (dés de l'arme + modificateur de dégâts − armure ; critique au maximum, armure ignorée) posée et testée ici ; son branchement reste en Phase 10. La décision « pas de second jet » est abandonnée : un jet de dés backend ne coûte aucun appel LLM.
- **Aucune règle optionnelle** : pas de jet opposé, de table de résistance, de progression ni de drapeau de règle par univers. Santé mentale, Passions, Réputation et jets cachés attendent la Phase 10bis.
- **Bascule sans reprise de données** : les parties sont vidées par `game:reset --no-seed` avant la migration, le contenu créé à la main dans les bases de dev est supprimé plutôt que converti, et le seeder réécrit les deux univers au format BRP.
- **Licence ORC** : notice à la racine du dépôt et mention « Powered by BRP » dans le front ; le texte du livre n'est jamais recopié.

### Contenu

- **Moteur de règles** (`app/services/rules/`) : formule d100, difficulté multiplicative, bornes, degrés de réussite, barème contextuel, jets de caractéristique, formule de dégâts du BRP. `DiceService` gagne le d100 et le jet d'une expression de dés (`1D6+1`).
- **Tour et prompts** : labels de difficulté et de degré dans l'arbitrage, la narration (guide de lecture des degrés) et l'extraction ; validation de la sortie d'arbitrage ; trace et `turn_log` au nouveau format ; détail du jet dans `roll_resolved` ; règle de l'attaque ouverte sur les nouveaux degrés.
- **Contenu** : types de contenu (compétences avec catégorie et chance de base, règles de résolution vers compétence ou caractéristique, prétiré à sept caractéristiques, profil d'arme), vérification de cohérence (`checkScenario`), réécriture des Trois Mousquetaires et du Mythe d'après les valeurs du livre (chances de base, armes, profils de PNJ).
- **Base** : migrations des colonnes de contenu et des fiches de personnage ; plus de colonne d'attributs.
- **Back-office** : éditeur d'univers sans attributs, compétences avec catégorie et chance de base, règles de résolution, prétiré, profils de combat et d'arme.
- **Front joueur** : fiche (caractéristiques, compétences en pourcentage, points de vie), détail de chaque jet dans le journal, enums et traductions.
- **Documentation** : architecture, base de données, flux du tour, cahier des charges du front et synthèse alignés sur le BRP ; notice ORC.

### Critère de sortie de phase

- Une partie des Trois Mousquetaires et une partie du Mythe se jouent de bout en bout sur le moteur BRP : jet d100, difficulté en label, cinq degrés de réussite, compétences en pourcentage avec chance de base.
- Le joueur voit le détail de chaque jet ; le narrateur n'en reçoit que le résultat et le degré.
- Un `game_master` édite compétences, règles de résolution, prétirés et profils au format BRP depuis le back-office.
- Il ne reste aucune trace du moteur 2d6 (code, contenu, prompts, documentation), et la notice ORC est en place.

---

## Phase 7 — Gestion du temps et des lieux

**Objectif** : tenir le temps qui passe en jeu et la topologie des lieux, pour que la partie reste cohérente dans la durée (cycle jour/nuit, trajets) comme dans l'espace (un manoir, un donjon, un labyrinthe se parcourent pièce par pièce). Insérée avant le lore étendu et la mémoire long terme : le résumé narratif gagne à être daté en temps de jeu, et la boucle de combat de la Phase 10 compte ses tours en rounds.

### Décisions de cadrage — temps de jeu

Tranchées à l'ouverture de la phase (2026-10-26, epic `KAN-89`) :

- **Horloge tenue par le backend** : un compteur en secondes depuis minuit du premier jour, dans l'état de la partie, sans rapport avec l'heure réelle (le port `Clock` n'est pas concerné). L'heure, la période, le numéro de jour et la date en dérivent.
- **Départ fixé par le scénario** : une **heure obligatoire** (`HH:MM`, pré-remplie à 08:00 dans le back-office) et une **date facultative**, copiées au lancement comme l'état initial. Modifier le scénario ne décale pas une partie en cours.
- **Durée d'une action en label**, proposée par l'arbitrage (A+B+C) et convertie par le backend, sur le modèle des modificateurs contextuels. L'arbitrage plutôt que l'extraction : la narration doit connaître l'heure d'arrivée pour la raconter. La durée couvre tout ce que fait le tour.

  | label | valeur | exemples |
  |---|---|---|
  | `moment` | 1 min | une réplique, jeter un œil, ouvrir une porte |
  | `minutes` | 10 min | fouiller une pièce, une conversation |
  | `hour` | 1 h | éplucher une bibliothèque, un repas, traverser une ville |
  | `hours` | 4 h | une demi-journée de route ou de travail |
  | `days` + `count` (1–7) | count × 24 h | un voyage, une convalescence |
  | `until` + `period` | calculée | « j'attends la nuit » : jusqu'au prochain début de la période, strictement dans le futur |

  Les valeurs vivent dans le code ; le prompt ne montre que des descriptions qualitatives. Au-delà d'une semaine, un trajet se joue en plusieurs tours. Une durée hors bornes est une sortie rejetée (nouvelle tentative unique).
- **Même durée en réussite et en échec**, sans modulation par le degré : la durée mesure le temps passé à *tenter*. Un échec qui coûte du temps se traduit par une nouvelle action au tour suivant.
- **Durées fixes imposées par le backend** : l'aparté au MJ ne prend aucun temps. **Aucune autre durée du BRP dans cette phase** — le round (12 s), les soins (guérison naturelle 1D3 PV par semaine) et la récupération attendent la Phase 10 ; d'ici là, un coup d'épée vaut `moment`.
- **Sept périodes à bornes fixes**, codées en dur, identiques pour tous les univers et sans saison : `night` 22 h–5 h, `dawn` 5 h–7 h, `morning` 7 h–12 h, `midday` 12 h–14 h, `afternoon` 14 h–18 h, `dusk` 18 h–20 h, `evening` 20 h–22 h. Dérivées de l'heure, jamais stockées ; enum fermé du système. `until` vise le début de la période.
- **Calendrier grégorien seul**, sans clé par univers (un calendrier propre attend la Phase 10 au plus tôt). Sans date de départ, l'horloge reste un compteur de jours.
- **Ce que voit chaque étape** :
  - l'arbitrage : la période courante, dont il tire au besoin une circonstance (obscurité, boutique fermée) ;
  - la narration : les périodes de départ et d'arrivée, l'heure d'arrivée **arrondie au quart d'heure**, la date si elle existe et le **numéro de jour** (les LLM calculent mal les écarts de dates). Consigne : ne jamais contredire le temps écoulé, et ne donner l'heure précise que si le personnage a de quoi la connaître (une montre qu'il détient, une horloge en marche, des cloches) et cherche à la savoir ; sinon, parler de lumière et de période. L'invariant 5 n'est pas en cause : il porte sur les données mécaniques du jet ;
  - l'extraction : rien.
- **Le joueur ne voit que la période**, dans le bandeau de scène (d'abord l'onglet « Situation ») : ni heure, ni date, ni numéro de jour, qui ne quittent jamais le backend. Une heure précise s'obtient dans le récit, par les moyens du personnage.
- **`turn_log`** enregistre l'horloge avant et après le tour, et la durée proposée.
- **Parties en cours à la migration** : la migration leur copie le départ de leur scénario. Pas de `game:reset` obligatoire.

### Décisions de cadrage — lieux

- **Description du lieu courant** transmise à l'arbitrage (ce que la pièce permet) et à la narration, jamais à l'extraction, en anglais : la `description` d'un lieu unique, ou le `descriptor` d'une instance d'archétype et la description de son parent. Quelques dizaines de jetons par appel, jamais le catalogue entier.
- **Le grain est celui du catalogue** : rejoindre un autre lieu de la liste fermée est un déplacement, si proche soit-il ; se déplacer à l'intérieur d'un lieu n'en est pas un. C'est l'auteur du scénario qui choisit le grain en détaillant un lieu en sous-lieux. Un lieu improvisé garde le grain de la scène.
- **Sorties (`exits`) sur une définition de lieu unique**, déclarées **une fois, d'un seul côté**, et valant dans les deux sens :

  ```ts
  type LocationExit = {
    to: string                       // reference of a unique place
    passage: string                  // one line of English, seen from here
    backPassage: string | null       // seen from the other side; null = same text
    hidden: boolean                  // hidden from this side only
    requires: string | null          // reference of the item that opens it
    oneWay: boolean
    duration: TravelDuration | null  // a label of the time scale, `moment` if null
  }
  ```

  Au plus un passage entre deux lieux. `requires` vaut des deux côtés ; `hidden` du seul côté déclaré (un passage caché des deux côtés ne s'exprime pas).
- **État des passages dans une table `passage_states`** (partie, passage tel que déclaré, `discovered_at`, `unlocked_at`), une ligne par passage dont l'état a changé, partagée par ses deux sens, écrite par un service dédié.
- **Lieux libres, lieux en réseau, entrées** :
  - un **lieu libre** n'a aucune sortie : on y voyage comme avant la phase ;
  - un **lieu en réseau** a au moins une sortie : on n'y entre et on n'en sort que par les sorties ;
  - une **entrée** (`entrance: true`) est un lieu en réseau qui communique avec le monde libre. Un réseau peut en avoir plusieurs.

  | depuis | vers |
  |---|---|
  | un lieu libre | les lieux libres, les entrées, un lieu improvisé |
  | un lieu en réseau | ses lieux atteignables seulement |
  | une entrée | les deux |

  On ne déclare pas de sortie vers un lieu libre. Pas d'improvisation dans un réseau. Un lieu qui contient un réseau (`ward_house`) n'est plus une destination ; il reste parent.
- **Lieux atteignables, calculés par le backend** : il existe un chemin de passages praticables (bon sens, découvert ou non caché, ouvert) dont toutes les étapes intermédiaires sont déjà visitées ; seule la dernière peut être nouvelle. On revient en un tour dans une pièce connue, on découvre un territoire nouveau pièce par pièce. Un lieu où se tient un PNJ absent `hostile` n'est jamais une étape intermédiaire.
- **Destination désignée par l'arbitrage**, dans un réseau : `intent.destination`, pris dans la liste fermée `reachable_locations` (hors réseau, une destination ne chiffre rien et est ignorée plutôt que refusée). La durée du tour vaut **le chemin le plus court en temps plus le label** de ce qui se fait à l'arrivée ; la narration reçoit le chemin, en noms traduits. L'extraction reste juge du déplacement réel, dans la liste fermée des destinations permises par le lieu courant.
- **Passage trouvé et franchi dans le même tour** (précisé à l'implémentation) : la liste fermée de l'extraction compte ouvertes les sorties cachées et verrouillées du lieu, et la validation n'accepte un déplacement à travers l'une d'elles que si la même narration la trouve ou l'ouvre. À l'application, les passages passent avant le déplacement, qui peut les emprunter.
- **Sorties dans les prompts** : l'arbitrage et la narration reçoivent toutes les sorties du lieu courant avec leur état ; la narration reçoit les passages cachés non découverts marqués comme tels, avec la consigne de ne les révéler que si le personnage cherche et que l'histoire lui en donne la raison (sur le modèle de `items_in_scene`). Un aparté reçoit les sorties visibles.
- **Objet requis** : le détenir suffit (un exemplaire de la définition, dans l'inventaire du personnage), et **franchir le passage avec lui le déverrouille pour de bon**, sans le LLM. Forcer ou crocheter est une action comme une autre, suivie de `passages_unlocked`. On ne referme pas une porte dans cette phase.
- **Découverte** proposée par l'extraction (`passages_discovered`), dans la liste fermée des passages cachés non découverts du lieu courant. Le backend ne vérifie pas qu'un jet a réussi.
- **Localisation des PNJ** (`npc_instances.location_instance_id`) : laissé derrière, un PNJ reste dans le lieu de la scène ; suivant, il prend le nouveau lieu ; parti de lui-même, son lieu devient inconnu. À l'arrivée du joueur, le backend rend présents les PNJ absents du lieu ; dans un réseau, la narration du tour d'arrivée les reçoit (`npcs_at_destination`).
- **Front** : pas de sorties à l'écran (une carte des lieux visités reste une piste). Un lieu en réseau s'affiche suivi du libellé de son parent (« La cuisine · Le manoir Ward ») ; un lieu libre garde son seul nom.
- **Manoir Ward** : deux entrées, le parc (par l'allée) et la cuisine (porte de service) ; le laboratoire derrière une porte cachée dans la cave, le caveau scellé derrière la porte de fer qu'ouvre la clé de fer.
- **Contenu et outils** : colonnes `exits` et `entrance` sur `location_definitions` ; vérifications de `checkScenario` (cible existante, pas de sortie vers soi, un seul passage entre deux lieux, objet requis existant, une entrée a des sorties, un réseau sans entrée contient le lieu de départ, le départ n'est pas un lieu qui contient un réseau) ; saisie en JSON brut validé dans le back-office ; réseau du manoir Ward dans le seeder, avec deux entrées (principale et porte arrière).

### Hors périmètre

- Échéances de scénario, événements déclenchés par le temps et emplois du temps des PNJ : Phase 10 (voir ses notes).
- Horaires d'ouverture des lieux, météo, calendrier propre à un univers : après la Phase 10 au plus tôt.
- Retour dans un lieu improvisé : reste à la mémoire long terme (Phase 9).
- Effets du temps sur le personnage (récupération des points de vie, vivres) : avec le combat et le cycle de vie de la Phase 10.

### Contenu

- **Moteur du temps** : échelle des durées, périodes, calcul de `until`, numéro de jour et date, en fonctions pures.
- **Horloge en base** : départ sur `scenarios`, compteur sur `world_states`, copie au lancement, reprise des parties en cours, temps du tour dans `turn_log`.
- **Le temps dans le tour** : durée dans l'arbitrage, avancée de l'horloge avant la narration, prompts, `period` dans `turn_completed` et la vue d'une partie.
- **Sorties** : modèle de contenu, `checkScenario`, `passage_states` et son service.
- **Parcours** : classement des lieux, lieux atteignables, chemin le plus court en temps, destinations permises.
- **Les lieux dans le tour** : description et sorties dans les prompts, destination et chemin, listes fermées de l'extraction, découverte et déverrouillage, libellé des pièces.
- **Localisation des PNJ**.
- **Back-office** : départ du scénario, sorties et entrée d'un lieu. **Front joueur** : la période dans l'onglet « Situation », passée depuis au bandeau de scène, toujours visible.
- **Contenu** : départs des trois scénarios, réseau du manoir Ward. **Documentation**.

### Critère de sortie de phase

- Chaque tour fait avancer une horloge de jeu tenue par le backend ; le joueur voit la période, et l'arbitrage comme la narration en tiennent compte.
- Dans un scénario découpé pièce par pièce (le manoir Ward), le joueur ne passe que par les sorties : un passage caché se découvre, une porte verrouillée exige son objet, le retour dans une pièce visitée se fait en un tour, et un PNJ laissé dans une pièce y est retrouvé.

---

## Entre les Phases 7 et 8 — Jet en direct et préférences (lot d'interface)

**Objectif** : faire du jet un geste du joueur, animé, et réunir les choix d'interface dans un écran de préférences, avant d'ouvrir le chantier du lore. Lot hors roadmap, **front seul et sans changement d'API** : le backend tire toujours le d100, le front ne calcule rien. Epic Jira `KAN-104`. Le détail vit dans le cahier des charges du front (sections 5.3.1, 5.3.7, 5.5 et 7).

### Décisions de cadrage

Tranchées le 2026-10-28, ajustées à la livraison :

- **Jet lancé à la main**, comme à la table : le d100 est déjà tiré quand `roll_resolved` arrive, le geste ne fait que le révéler. Aucune mécanique d'adresse ne laisse croire le contraire.
- **Trois temps** : préparation (compétence, modificateurs un à un, chance), lancer (deux d10, dizaines puis unités), révélation (degré, accent pour `critical` et `fumble`, repli en pastille). **En 2D**, en CSS, sans dépendance. **Pas de jauge** : la chance chiffrée suffit ; des zones de degré exigeraient que le backend transmette les seuils.
- **Narration retenue** jusqu'à la révélation, saisie verrouillée. Un tour terminé avant le lancer est **retenu** : il ne rejoint le journal, la fiche, le bandeau de scène et la voix qu'à la révélation, sans quoi les points de vie ou la voix trahiraient l'issue. Un tour échoué révèle son jet aussitôt ; un tour relu n'est jamais rejoué.
- **Préférences d'interface** — thème, lecture à voix haute, lancer automatique, animations une à une — propres au navigateur : en stockage local, **jamais en base** ni envoyées au backend. `prefers-reduced-motion` est un plancher qu'aucune préférence ne lève.
- **Stockage local** limité au brouillon de saisie et à ces préférences.

### Contenu

- **Préférences** : module unique, écran ouvert depuis le menu du compte, animations existantes soumises à leur préférence (fondu de la narration créé, jauge de points de vie qui rebondit et pulse).
- **Jet en direct** : machine de révélation pure, distincte de celle du tour ; carte de jet ; branchement dans le tour.
- **En cours de lot** : bandeau de scène sous l'en-tête (lieu et période, toujours visibles), l'onglet *Situation* de la fiche devenant *Quests* ; icône de d10 ; texture du fond par thème.

### Critère de sortie

- Pendant un tour avec jet, le joueur lance les dés à la main, les voit rouler et s'arrêter sur le d100 du backend, puis lit la narration ; avec le lancer automatique, les dés roulent seuls.
- Toutes les préférences se règlent dans un écran dédié, survivent au rechargement, et aucune ne transite par l'API.

---

## Phase 8 — Lore étendu et RAG

**Objectif** : dépasser les limites de la connaissance native du LLM sur un univers, ou construire un lore original détaillé.

### Contenu

- Pertinent uniquement dans deux cas : un univers original créé pour le produit, ou l'approfondissement d'un univers connu au-delà de ce que le LLM sait déjà nativement.
- Introduction de la table `lore_fragments`.
- Mécanisme de filtrage : **approche par tags à privilégier pour démarrer** (simple, prévisible, auditable), conformément à la recommandation du document d'architecture. Le passage à une recherche par similarité (embeddings, pgvector ou vector store externe) n'est envisagé que si le volume de lore le justifie réellement.

### Critère de sortie de phase

- Le contexte transmis aux étapes LLM concernées (arbitrage, narration) inclut des fragments de lore correctement filtrés par tags, pour un univers dont le contenu dépasse la connaissance native du modèle.

---

## Phase 9 — Mémoire long terme

**Objectif** : permettre à une partie de durer au-delà de ce qu'un buffer de tours bruts peut raisonnablement couvrir.

### Contenu

- Table `narrative_summaries`, avec granularité hiérarchique (scene / chapter / global) telle que définie dans le document de base de données.
- Job asynchrone de régénération périodique du résumé, hors du chemin critique de réponse au joueur.
- **Le résumé est rédigé en anglais**, quelle que soit la langue de la partie : le job étant asynchrone, il peut condenser une narration française en résumé anglais sans coût de latence perçu. C'est la principale économie de jetons du dispositif multi-langue, puisque le résumé est réinjecté à chaque tour (voir architecture, section 4bis).
- **Différenciation de l'injection du buffer** : le buffer récent, dans la langue du joueur, est dosé par étape — 2–4 tours pour la narration, un buffer court de 2 tours pour l'arbitrage, qui reçoit aussi le résumé anglais et le state structuré. Le buffer court reste nécessaire à l'arbitrage : les derniers tours ne figurent dans aucun résumé tant que le job ne l'a pas recalculé (architecture, section 4bis).
- Utile principalement lorsque les parties commencent à dépasser en pratique la fenêtre de contexte raisonnable en buffer brut — à activer selon l'usage observé, pas nécessairement dès l'ouverture de cette phase.

### Critère de sortie de phase

- Une partie longue reste cohérente narrativement sans dépendre uniquement du buffer de tours récents.

---

## Phase 10 — Combat étendu et cycle de vie complet

**Objectif** : compléter les mécaniques de jeu et le cycle de vie d'une partie.

### Contenu

- Combat modélisé comme séquence de jets alternés joueur/PNJ, conformément au modèle générique déjà défini dans le système de règles — cette phase implémente concrètement la boucle round par round, le modèle mécanique sous-jacent existant déjà depuis la Phase 3/4.
- Branchement de la formule de dégâts du BRP posée en Phase 6 (dés de l'arme + modificateur de dégâts − armure) : l'arbitrage désigne attaquant et cible, le backend calcule les dégâts et les applique, et l'extraction cesse de chiffrer les blessures. Une arme détenue par un PNJ l'emporte sur l'arme ordinaire de son profil, et c'est l'arme qui désigne la compétence d'attaque.
- Reste du combat du BRP (système de règles, sections 8 et 11) : matrice attaque / défense avec parade et esquive, jets opposés et table de résistance, armure, blessures grave et mortelle, effets spéciaux, table réduite de maladresses ; choix des points de vie totaux pour le personnage.
- Temps du combat et du personnage, sur l'horloge de la Phase 7 : un tour de combat vaut un round du BRP (12 secondes), durée imposée par le backend et non proposée par l'arbitrage, sans rangs de `DEX` ni actions multiples ; soins (premiers soins en un round, guérison naturelle de 1D3 PV par semaine) et récupération calés sur le temps écoulé.
- Échéances et événements déclenchés par le temps, à cadrer : une condition (jour, période, peut-être un flag) et un effet appliqué par le backend en delta validé, saisis comme contenu de scénario et vérifiés par `checkScenario`. Ils couvrent aussi les **emplois du temps des PNJ** (gardes moins nombreux la nuit, vampire au tombeau le jour et au château la nuit), qui déplacent ou retirent des instances via leur lieu (`location_instance_id`, Phase 7).
- Progression du personnage : tests d'expérience et jets d'amélioration du BRP, en fin de scénario.
- Cycle de vie complet de la partie :
  - création de personnage guidée (au-delà d'un simple formulaire technique),
  - conditions de fin de partie (victoire, mort du personnage, abandon volontaire),
  - gestion de la reprise après une pause longue (régénération du résumé avant reprise si nécessaire).

> **Prérequis** : la boucle de combat s'appuie sur `npc_instances`, posée en Phase 3 (état et disposition) et complétée en Phase 4 (données de combat). Cette phase n'ajoute que la boucle de rounds.
>
> **Point à régler ici** : les instances de PNJ ne sont créées que par l'extraction (E), en fin de tour. Un PNJ improvisé que le joueur attaque dès son apparition (« je frappe le passant ») n'existe donc pas encore au moment du jet. Sans incidence tant que le jet n'oppose le joueur qu'à une difficulté ; avec les jets opposés, l'arbitrage devra pouvoir désigner un archétype comme cible et le backend en lire le profil.

### Critère de sortie de phase

- Un combat complet est jouable de bout en bout avec plusieurs rounds.
- Une partie peut être créée, mise en pause, reprise et menée jusqu'à une fin définie.

---

## Phase 10bis — Règles optionnelles par univers

**Objectif** : activer, univers par univers, les règles optionnelles du BRP qui font le genre — sans toucher au moteur commun. Placée après la Phase 10, dont elle réutilise la progression (une passion s'améliore comme une compétence).

### Contenu

- **Drapeaux de règles par univers** : chaque univers déclare les règles optionnelles qu'il emploie ; un univers sans drapeau joue le BRP de base.
- **Santé mentale** (Mythe) : score de santé mentale, jet sous ce score face à l'horreur, pertes et folie temporaire tirées par le backend. L'arbitrage ou l'extraction ne fournit qu'un déclencheur en label fermé, choisi dans la liste de l'univers ; le narrateur ne reçoit qu'un état qualitatif.
- **Passions et Réputation** (Trois Mousquetaires) : honneur, loyauté, amour, renommée, comme bonus ou malus tirés par le backend, d'après un label fermé.
- **Jets cachés** : une compétence marquée cachée est jetée sans que le joueur en voie le détail, et le narrateur reçoit la consigne de taire ou d'égarer sur un échec — l'exception prévue à la règle « le joueur voit le détail de chaque jet » (Phase 6).

### Critère de sortie de phase

- Le Mythe se joue avec la santé mentale, les Trois Mousquetaires avec les passions et la réputation, chaque univers n'activant que ses propres règles.

---

## Phase 11 — Production-ready

**Objectif** : préparer le système à une exposition plus large et à un usage soutenu, au-delà du prototype fonctionnel.

### Contenu technique

- Système de log d'erreurs API structuré (point explicitement différé depuis la Phase 1 / présent sur la todolist).
- Observabilité : détection de dérive des system prompts, jeu de tours de référence / evals automatisés avant déploiement d'une modification de prompt, monitoring du taux d'échec de schéma et du taux de détection de prompt injection.
- Versionning des prompts et des règles de résolution, avec association d'une version à chaque partie ou tour du journal, pour la reproductibilité et le debug.
- Modération de contenu au-delà du prompt injection (thèmes sensibles, classification d'âge éventuelle).

### Contenu lié au budget et à la monétisation

- **Étape 2 de la démarche budget/monétisation** (voir document de synthèse, section budget) : organiser un beta test fermé auprès de la cible réelle (joueurs de JDR papier) et recueillir leur intention de payer pour l'expérience vécue, en s'appuyant sur le coût réel par partie déjà mesuré depuis la Phase 3 (étape 1).
- Sur la base de ces deux mesures (coût réel + appétence observée), sélection d'une piste de modèle économique parmi celles identifiées dans le document de synthèse (abonnement, crédits, contenu payant, don libre, ou modèle mixte) — décision non anticipée avant ce stade.
- Mesure réelle du budget coût/latence en usage à l'échelle visée, ajustement du choix de modèle LLM par étape en conséquence.
- Réévaluation du choix d'hébergement léger de la Phase 0 si le volume d'usage dépasse ce que permettent les tiers gratuits/quasi-gratuits initiaux.

### Contenu lié à la gestion de comptes

- Inscription self-service pour les joueurs, si une ouverture au public est prévue : validation d'email, réinitialisation de mot de passe, et tout ce qui relève de l'authentification grand public plutôt que de comptes créés manuellement.
- Durcissement des permissions : audit systématique qu'aucune route de back-office ou d'administration n'est accessible sans contrôle de rôle correctement vérifié.

### Critère de sortie de phase

- Le système dispose d'une observabilité suffisante pour détecter les dérives de qualité, d'un contrôle d'accès audité, et d'une authentification adaptée à une ouverture publique si celle-ci est décidée.
- Un modèle économique est sélectionné (ou le choix explicite de ne pas monétiser est confirmé), sur la base de données réelles de coût et d'appétence plutôt que d'une hypothèse.

---

## Synthèse — vue d'ensemble des phases

| Phase | Objet principal | Nouveau rôle utilisateur actif |
|---|---|---|
| 0 | Socle technique, table `users` posée | — |
| 1 | Boucle de jeu minimale, univers connu du LLM | — |
| 2 | Front minimal, authentification joueur | `player` |
| 3 | Pipeline complet en 5 étapes | — |
| 4 | Inventaire et modificateurs d'objets | — |
| 5 | Généricité multi-univers, back-office minimal | `game_master` |
| 5bis | Gestion des comptes | `superadmin` |
| 6 | Bascule sur le système BRP | — |
| 7 | Gestion du temps et des lieux | — |
| 7–8 | Jet en direct et préférences (lot d'interface, sans API) | — |
| 8 | Lore étendu et RAG | — |
| 9 | Mémoire long terme | — |
| 10 | Combat étendu, cycle de vie complet | — |
| 10bis | Règles optionnelles par univers | — |
| 11 | Production-ready | — |

---

## Stratégie de test — transverse à toutes les phases

Cette section est volontairement transverse plutôt que répartie phase par phase : la ligne de
partage décrite ci-dessous ne change jamais, seul le périmètre couvert s'étend.

### La ligne de partage

L'invariant central du projet — *le LLM propose, le backend décide* — est aussi la frontière de
test. D'un côté, du déterministe qui se vérifie par assertion binaire. De l'autre, du
probabiliste qui ne se mesure que par un score sur un corpus.

| | Déterministe (backend) | Probabiliste (LLM) |
|---|---|---|
| Nature | Test | Eval |
| Verdict | Succès / échec | Un taux, suivi dans le temps |
| Fréquence | À chaque commit | Au changement de prompt ou de modèle |
| Coût | Nul | Appels réels facturés |

Confondre les deux est le piège classique : on écrit des assertions sur du texte généré, la
suite devient instable, et on finit par la désactiver. **On n'asserte jamais sur le texte
narré.** On asserte sur des propriétés : la sortie respecte son schéma, la narration ne
mentionne aucune mécanique de jeu, elle ne contredit pas le résultat imposé, la langue de
sortie suit le paramètre `language`.

### Exigences de testabilité à respecter dès qu'un mécanisme apparaît

Ces points sont pénibles à rattraper après coup :

- **Le jet de dés doit être injectable** (générateur aléatoire remplaçable). Sans cela le
  moteur de règles n'est pas testable — c'est une contrainte de conception, pas un détail
  d'implémentation.
- **L'horloge doit être injectable** pour tout ce qui dépend du temps (`last_activity_at`,
  seuils de déclenchement du résumé).
- **Un faux provider LLM est écrit en même temps que le vrai.** C'est la pièce la plus
  rentable du dispositif : elle rend tout le pipeline testable sans réseau, sans coût et sans
  instabilité.

### Ce que chaque phase ajoute

| Phase | Ce qui devient testable |
|---|---|
| 0 | Harnais : cycle de vie de la base, isolation par test, faux provider. Catégories d'erreur du LLM Gateway, cascades et contraintes du schéma, réversibilité des migrations, non-exposition du rôle |
| 1 | Moteur de règles (formule, seuils, bornes de marge), validation du delta d'état, écriture de `turn_log` y compris sur échec |
| 2 | Contrat d'API : authentification requise, accusé de réception, **séquence des événements SSE** (granularité tranchée, voir architecture section 8bis), et idempotence — une clé rejouée ne remet aucun job en file |
| 3 | Un test de contrat par étape du pipeline, filet de sécurité lors des modifications de prompt |
| 4 | Séparation des deux familles de modificateurs, conditions `owned`/`equipped`, traçabilité de l'origine, refus d'un identifiant d'objet hors liste ou hors scène, transferts entre détenteurs, formule de dégâts |
| 5 | Contrôle d'accès par rôle, route par route — rend continu l'audit prévu en Phase 11 |
| 6 | Moteur BRP : bornes 01–05 et 96–00, seuils des degrés, difficulté multiplicative, ordre des modificateurs, jets de caractéristique, formule de dégâts sur dés simulés ; le narrateur ne reçoit jamais le détail du jet |
| 7 | Horloge de jeu : conversion des labels de durée, bornes, attente jusqu'à une période, période dérivée de l'heure, jour et date ; sorties : destinations atteignables, passages cachés et verrouillés, refus d'une destination hors liste, durée d'un chemin, passage trouvé et franchi dans le même tour, porte ouverte par sa clé ; PNJ laissé, suivant, parti, retrouvé ; cohérence d'un réseau (`checkScenario`) ; le joueur ne reçoit que la période |
| 8 | Qualité de récupération du lore : sur un jeu annoté, les bons fragments remontent-ils, et avec quel bruit |
| 9 | Le résumé ne perd pas les faits critiques (eval, pas test) |
| 11 | Evals automatisés, détection de dérive de prompt, taux d'échec de schéma |

Chaque **critère de sortie de phase** fait par ailleurs un bon test d'acceptation de bout en
bout : un par phase suffit.

### Le corpus d'évaluation s'accumule dès la Phase 1

`turn_log` enregistre l'entrée joueur, les sorties intermédiaires et la narration finale : c'est
déjà le jeu de données d'évaluation. Les evals sont prévus en Phase 11, mais le **corpus** se
constitue dès la Phase 1, en sélectionnant au fil de l'eau les tours intéressants — cas limites,
échecs, comportements aberrants. Sans cette accumulation, la Phase 11 commencerait par plusieurs
jours de collecte.

Cas à verser au corpus dès la Phase 7, que les tests ne peuvent pas trancher : le narrateur
qui donne l'heure sans que le personnage ait de quoi la connaître, qui révèle un passage caché
sans fouille ni raison, ou qui invente un itinéraire au lieu de suivre le chemin transmis.

Même logique pour le coût : faire tourner ce corpus donne le nombre de jetons par tour, qui est
la mesure de l'étape 1 de la démarche de monétisation. Ce n'est pas un test qui passe ou échoue,
c'est un chiffre à suivre — et une alerte si une modification de prompt le fait doubler.

### Sécurité : tester le confinement, évaluer la détection

Sur le prompt injection, la distinction est essentielle. La **détection**
(`alert.prompt_injection_suspected`) est probabiliste : elle s'évalue. Le **confinement** est
déterministe et se teste durement, avec un corpus d'entrées adversariales : *même quand la
détection échoue, aucun état ne doit avoir été modifié*. La sécurité ne repose pas sur le fait
que le modèle repère l'attaque, mais sur le fait que le backend ne lui fait pas confiance.

### Ce qu'on ne teste pas, délibérément

Le comportement du framework (routes AdonisJS, génération d'uuid, middleware
d'authentification), et **aucun appel à l'API LLM réelle dans la suite** — une commande dédiée
couvre cela à la demande. Un appel facturé et instable dans une suite lancée à chaque commit
finit toujours par être ignoré.

---

## Décisions déjà actées (rappel)

- **Multi-joueur** : explicitement hors scope, à traiter dans un projet distinct avec ses propres réflexions d'architecture (concurrence d'accès au state, infrastructure temps réel, visibilité narrative différenciée par joueur).
- **Retry/fallback LLM** : pas de retry automatique des erreurs de transport. Depuis la Phase 3, une sortie structurée rejetée par la validation backend a droit à **une** nouvelle tentative avec message correctif, puis le tour échoue (voir Phase 3). Chaque erreur est renvoyée au front avec un message spécifique selon le type détecté. Un système de log d'erreurs API structuré est prévu en todolist, à traiter en Phase 11.
- **Modificateurs contextuels vs modificateurs d'objets** : séparation stricte actée — le LLM ne propose que des modificateurs contextuels, en labels qualitatifs convertis par le backend (3 au plus), les modificateurs d'objets sont toujours calculés par le backend à partir des objets du détenteur.
- **Un compte = un rôle unique** pour l'instant (`player` / `game_master` / `superadmin`), pas de cumul multi-rôle. À réévaluer si le besoin se présente concrètement.
- **Budget de développement** : hébergement léger (ex. Vercel, Supabase, Railway) et LLM économique (ex. Gemini) pour la phase de test, budget cadré à 15-20€ mensuels — voir Phase 0.
- **Démarche de monétisation** : aucun modèle choisi à ce stade, mais une démarche en deux temps est actée — mesure du coût réel par tour/partie dès la Phase 3, puis validation de l'appétence des joueurs lors du beta test fermé prévu en Phase 11 — avant toute sélection de modèle économique.
- **Convention de nommage** : tables, colonnes, enums et code exclusivement en anglais ; langue par défaut de l'application en anglais, support multi-langue en complément.
- **Architecture multi-langue** : « tout en anglais en interne, traduction au dernier moment ». Le lore, le scénario, le state, les system prompts et le résumé narratif restent en anglais et ne sont jamais dupliqués par langue ; seule l'étape de narration produit du texte dans la langue du joueur. Pas de second appel de traduction, pas de détection si le joueur écrit dans une autre langue. Un glossaire compact de noms propres assure la cohérence des noms. Voir document d'architecture, section 4bis.
- **Objets** : définitions et instances ; séparation entre référence stable anglaise et nom d'affichage ; trois détenteurs possibles (personnage, PNJ, lieu) ; catalogue fermé ; l'étape d'extraction ne peut faire apparaître qu'un objet figurant dans la liste transmise, ni déplacer un objet hors scène. Voir document d'architecture, section 6bis.
- **Exécution asynchrone et contrat d'API front/backend** : pipeline exécuté en tâche de fond via une file de jobs derrière un port — pg-boss (PostgreSQL) en instance unique, BullMQ (Redis) au passage à plusieurs instances —, retour progressif au front via AdonisJS Transmit (SSE) — introduit dès la Phase 2, pas différé à la Phase 11. Voir document d'architecture, section 8bis, pour le détail des événements.
- **Environnement technique** : dev et tests locaux sous Docker (PostgreSQL ; Redis provisionné pour la bascule vers BullMQ), repo structuré en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend` et `frontend` dès la Phase 0, et `back-office` ajouté en Phase 5.
- **Authentification** : le scaffolding register/login inclus par défaut dans un projet AdonisJS est réutilisé comme base pour l'authentification joueur (Phase 2), plutôt que de construire ce système from scratch — seul le champ `role` (enum `player`/`game_master`/`superadmin`) est une extension propre au projet. Le front s'authentifie par **cookie de session**, seul mode compatible sans contournement avec `EventSource`.
- **Front** : Vite + React, Tailwind CSS, TanStack Router (TanStack Query envisagé pour les lectures).
- **Soumission d'un tour** : clé d'idempotence fournie par le client, enregistrée avant la mise en file ; tours exécutés par un worker unique en `concurrency: 1`, dans le process HTTP, pour la Phase 2 (voir Phase 2, décisions de cadrage).

---

## Points ouverts pour les phases avancées

- Modalités précises de l'inscription self-service (Phase 11) : validation d'email, gestion des mots de passe oubliés, éventuelle authentification via fournisseur tiers.
- Décision sur la nécessité future d'un cumul de rôles (un MJ qui voudrait aussi jouer).
- Carte des lieux visités dans le front joueur, si le besoin se confirme après la Phase 7 (qui n'affiche pas les sorties).
- Choix définitif entre pgvector intégré et vector store externe si la Phase 8 est activée (dépend du volume de lore réellement atteint).
- Réintroduction éventuelle d'un retry automatique limité (Phase 11), une fois le comportement réel des erreurs observé en usage — restreint aux erreurs transitoires (timeout, 5xx). Les sorties rejetées ont leur nouvelle tentative unique depuis la Phase 3 ; un taux de rejet élevé reste le signe d'un prompt à corriger plutôt qu'à retenter.
- Support multi-langue : l'architecture est actée et répercutée dans les phases ci-dessus (paramètre `language` et colonne `turn_log.language` en Phase 1, séparation référence/affichage en Phase 4, catalogue et glossaire en Phase 5, résumé anglais en Phase 9). L'i18n du front est posée dès la Phase 2, avec l'anglais seul. **Restent ouverts** : la liste des langues cibles, et la phase à laquelle une seconde langue est effectivement activée — probablement pas avant que la Phase 5 rende le contenu paramétrable.
- Événements SSE : la granularité et le rattrapage par lecture du tour sont tranchés pour la Phase 2 (architecture, section 8bis). Le streaming de la narration est tranché pour la Phase 3 (voir ses décisions de cadrage). **Reste ouvert** le rejeu des événements manqués, jugé inutile tant que la lecture du tour suffit.
- Passage à plusieurs instances : bascule de la file de pg-boss vers BullMQ, worker séparé (transport Redis de Transmit) et sérialisation par verrou PostgreSQL sur `session_id` plutôt que par `concurrency: 1` — à trancher avant le beta test de la Phase 11.
