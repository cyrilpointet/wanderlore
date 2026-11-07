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
- Gestion d'erreur conforme à la décision prise pour le projet : **pas de retry automatique**. Une erreur est renvoyée avec un message spécifique selon le type détecté (timeout, sortie hors schéma, erreur HTTP de l'API externe, échec de validation backend). Un système de log d'erreurs structuré est explicitement différé (voir Phase 14 / todolist).
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
- **Internationalisation du front dès la Phase 2**, avec une bibliothèque d'i18n, même si elle ne contient au départ que l'anglais. Tous les textes d'interface passent par ses fichiers de traduction, jamais en dur : ajouter une langue ne doit être qu'un travail de traduction, pas une reprise de chaque écran. Bibliothèque retenue : **react-i18next** (motifs : cahier des charges front, section 7). Pas de sélecteur de langue avant la Phase 14.
- **Authentification par cookie de session** (guard `web`, déjà configuré dans le scaffolding) plutôt que par access token. Motif : le flux SSE repose sur `EventSource`, qui ne peut pas porter d'en-tête `Authorization` mais envoie nativement les cookies. En développement, le serveur Vite proxifie l'API : front et backend partagent la même origine, sans configuration CORS avec credentials. Contrepartie : l'authentification par cookie expose au CSRF — la protection de `@adonisjs/shield`, aujourd'hui désactivée, est à activer.
- **File de jobs derrière un port, servie par pg-boss.** La file est un service substituable (port, adaptateur choisi dans la configuration), comme le LLM Gateway. **pg-boss** stocke ses jobs dans PostgreSQL : aucun Redis à héberger tant qu'il n'y a qu'une instance, et l'hébergement léger de la phase de test n'a qu'une base à fournir. **BullMQ reste la cible** du passage à plusieurs instances, qui ramène de toute façon Redis pour le transport de Transmit : la bascule se fera en écrivant l'adaptateur BullMQ et en changeant la configuration, file vidée. Contrepartie acceptée : pg-boss interroge la base à intervalle régulier au lieu d'être notifié ; l'intervalle est réglé explicitement pour ne pas retarder visiblement le début du tour.
- **Rien de ce qui garantit l'intégrité d'un tour ne dépend de la file** — c'est la condition d'une bascule simple :
  - le job ne transporte que l'identifiant du tour, tout l'état est lu en base ;
  - l'idempotence vit dans `turn_log`, jamais dans la déduplication propre à l'outil ;
  - la sérialisation des tours relève de `concurrency: 1`, puis d'un verrou PostgreSQL par `session_id` — jamais d'une fonctionnalité de file ;
  - les événements SSE sont émis par le code du tour via Transmit, jamais dérivés des événements de la file ;
  - aucune logique ne repose sur la mise en file dans la même transaction que l'écriture du tour (pg-boss le permet, BullMQ non). Un tour resté `pending` au-delà d'un délai — process arrêté en cours de tour, mise en file échouée — est passé en échec.
  - **Tranché (KAN-18)** : délai de 5 minutes, balayage au démarrage du worker puis chaque minute ; échec immédiat si la mise en file échoue. Détail : architecture, section 8bis.
- **Worker dans le process HTTP**, démarré au boot du serveur web (pas en environnement de test ni de console). C'est l'option la plus simple : un seul process à lancer, et Transmit diffuse en mémoire sans transport Redis — l'événement émis par le job atteint directement les connexions SSE du même process. **Limite assumée** : ne passe pas à plusieurs instances. Un worker séparé imposera le transport Redis de Transmit ; à reprendre au plus tard en Phase 14.
- **Pas de retry de la file** (`retryLimit: 0` avec pg-boss, `attempts: 1` avec BullMQ), conformément à la décision projet sur les erreurs LLM.
- **Clé d'idempotence fournie par le client** pour la protection contre les doubles soumissions (voir ci-dessous).
- **Événements SSE limités aux jalons**, sans streaming de la narration (voir document d'architecture, section 8bis).

### Contenu

- Interface de chat : historique de messages + champ de saisie.
- Affichage en lecture seule des statistiques du personnage (points de vie, compétences). Pas d'inventaire à ce stade (aucun objet n'existe encore dans le système).
- **Routes de lecture** nécessaires au front : liste des parties du joueur, détail d'une partie (personnage, historique des tours pour le chat), lecture d'un tour. Cette dernière sert aussi de rattrapage quand le flux SSE a été manqué ou coupé.
- **Exécution asynchrone du pipeline via la file de jobs (pg-boss), avec retour progressif via AdonisJS Transmit (SSE)** : le front soumet l'action du joueur, reçoit un accusé de réception (`202`), puis affiche des messages d'attente contextuels au fil des événements reçus (étape en cours, jet résolu) jusqu'au résultat final du tour. Voir document d'architecture, section 8bis, pour le contrat d'événements. Ce choix remplace l'hypothèse initiale d'une réponse synchrone simple, dès cette phase plutôt qu'en Phase 14.
- **Sérialisation des tours par partie** — point non négociable, découvert en Phase 1 : un tour passe plusieurs secondes en attente du LLM entre la lecture du dernier numéro de tour et son écriture. Deux soumissions rapprochées calculent donc le même numéro. **Un seul joueur qui envoie deux fois suffit** : ce n'est pas un problème de multi-joueur. La contrainte d'unicité `(session_id, turn_number)` le rattrape et doit être conservée comme dernier filet, mais elle n'est pas une solution.
  - La file **ne règle pas ce point par sa seule présence** : sa concurrence se paramètre par worker, pas par clé (BullMQ ne sérialise par clé qu'avec les *groups* de sa version Pro, payante). Les pistes générales sont un verrou par `session_id` autour du job — en PostgreSQL, pour rester indépendant de la file — ou une file par partie (ingérable).
  - **Retenu pour cette phase : un worker unique en `concurrency: 1`.** Les tours s'exécutent strictement l'un après l'autre, chacun lisant l'état laissé par le précédent : la course sur le numéro de tour disparaît. Le prix — un débit plafonné toutes parties confondues — est sans effet tant qu'un seul joueur teste. **À reprendre avant le beta test** (Phase 14), avec un verrou PostgreSQL par `session_id`.
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
- **Un seul modèle pour toutes les étapes** (`gemini-2.5-flash`, remplacé en octobre 2026 par `gemini-3.8-flash`, le premier n'étant plus ouvert aux nouvelles clés API) pendant les phases de test. La séparation des étapes rend la différenciation possible, mais elle attend les mesures de coût réelles (Phase 14).

### Contenu

- Séparation effective des étapes :
  - Appel A+B+C (interprétation, validation, résolution) — sortie structurée.
  - Calcul du jet en étape backend déterministe isolée, avec traçabilité complète (`applied_modifiers`) enregistrée dans `turn_log`.
  - Appel D (narration) — texte libre.
  - Appel E (extraction des effets) — sortie structurée, validée avant application au state.
- Cette séparation permettra d'utiliser un modèle LLM différent (potentiellement moins coûteux) pour l'extraction que pour la narration — pas avant la Phase 14 (voir décisions de cadrage).
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
- **L'univers est chargé une fois par tour, sans cache.** Une fonction de chargement reconstruit, à partir des tables de contenu et de la surcharge scénario sur univers, la même forme `WorldDefinition` que la constante de la Phase 4. Le worker l'appelle à la prise en charge du tour et passe cette photo à toutes les étapes : un contenu modifié pendant un tour ne peut pas faire diverger l'arbitrage, l'extraction et l'application. Les libellés (`ContentLabels`) se construisent par requête ou par tour, d'après l'univers de la partie, et non plus au chargement du module. Pas de cache : son gain (quelques millisecondes face à trois appels LLM) ne justifie pas une invalidation à partager entre instances ; à réexaminer en Phase 14 sur mesures réelles.
- **Un personnage prétiré et un état initial par scénario.** Le scénario porte le personnage (nom, attributs, compétences, points de vie, ressources, objets de départ, équipés ou non) et l'état de départ (lieu, quêtes actives, chapitre initial). Lancer une partie les copie dans une partie neuve — ce que fait aujourd'hui le seeder de démo, à partir de la base. Aucune personnalisation avant la création guidée de la Phase 12 ; plusieurs prétirés au choix par scénario, plus tard.
- **Le back-office couvre tout ce dont un tour a besoin**, faute de quoi un univers créé ne serait pas jouable : en plus des formulaires listés plus bas, les catégories d'action (`resolution_rules`), les archétypes génériques, les profils de combat des PNJ et les ressources. Formulaires pour les champs simples (références, libellés, descriptions, rattachements) ; **champ JSON brut validé par le backend** pour les structures imbriquées (profil de combat, modificateurs d'objet), une saisie invalide étant refusée avec un message précis.
- **Scénario en brouillon (`draft`) ou publié (`published`), cohérence vérifiée à la publication.** Le backend contrôle les références croisées (compétence → attribut, `action_type` → compétence, lieu → parent, objet → détenteur initial), la présence des archétypes génériques dont l'improvisation a besoin, et la validité du personnage prétiré et de l'état initial. Un joueur ne voit que les scénarios publiés.
- **Un `game_master` peut lancer une partie** sur n'importe quel scénario, brouillons compris, depuis le front joueur : c'est ainsi qu'il teste un scénario avant de le publier, sans outillage dédié. La restriction initialement prévue (« un compte `game_master` ne peut pas créer de partie ») est levée.
- **Trois catalogues de même forme** : `npc_definitions`, `location_definitions` et **`item_definitions`** (table dédiée plutôt que `scenarios.item_catalog`), chacun avec univers obligatoire et scénario facultatif. **La surcharge vaut pour les trois** : une définition de scénario remplace celle de l'univers de même référence. Compétences, attributs, ressources et catégories d'action restent propres à l'univers, sans surcharge.
- **Contenu déjà joué** : une référence est **immuable après création** (saisie une fois, verrouillée ensuite) ; une définition ne se supprime que si **aucune instance** ne l'emploie, toutes parties confondues ; libellés, descriptions et mécanique restent modifiables et valent pour les parties en cours dès le tour suivant. Le versionnement complet du contenu reste ouvert (Phase 14).
- **Noms d'affichage par langue sur chaque définition**, et sur chaque compétence, attribut, ressource, chapitre et quête : anglais obligatoire, autres langues facultatives avec repli sur l'anglais. Ces noms forment déjà le glossaire des PNJ et des lieux ; **le glossaire ne porte plus que les noms propres qui ne sont pas des entités** (factions, figures historiques hors scène), saisi au niveau de l'univers et complété par le scénario. Le modèle accepte tout code de langue : la liste des langues cibles reste ouverte, le joueur ne choisissant sa langue qu'en Phase 14.
- **Ce qui sort de la définition en dur** :
  - `worlds` : `reference` stable (cible de la clé étrangère de `resolution_rules`, qui remplace `world_reference`), noms d'affichage, `narrative_tone`, `rules` et `ambiance` en listes de phrases (même rôle qu'aujourd'hui pour l'arbitrage et la narration, jusqu'au lore de la Phase 8), `attributes`, `skills` et `resources` chacun dans sa colonne `jsonb` plutôt que regroupés dans `general_rules` ;
  - `scenarios` : synopsis, chapitres et quêtes en listes `{ reference, labels }`, personnage prétiré, état initial, statut ;
  - **différés** : `content_boundaries` (modération, Phase 14), `branch_points` et conditions de progression des chapitres (tant qu'aucun tour ne sait les exploiter).
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
- **Création d'un compte** : nom, email, rôle et mot de passe initial, transmis par le superadmin hors de l'application. Ni envoi d'email ni changement de mot de passe imposé avant la Phase 14.
- **Hors périmètre** : changement de rôle d'un compte existant, modification d'email, suppression ; l'inscription libre (`/auth/signup`) reste en l'état, et crée toujours un `player`, jusqu'aux modalités d'inscription de la Phase 14.

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
- **Aucune règle optionnelle** : pas de jet opposé, de table de résistance, de progression ni de drapeau de règle par univers. Santé mentale, Passions, Réputation et jets cachés attendent la Phase 13.
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
- **Calendrier grégorien seul**, sans clé par univers (un calendrier propre attend la Phase 11 au plus tôt). Sans date de départ, l'horloge reste un compteur de jours.
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

- Échéances de scénario, événements déclenchés par le temps et emplois du temps des PNJ : Phase 11.
- Horaires d'ouverture des lieux, météo, calendrier propre à un univers : après la Phase 11 au plus tôt.
- Retour dans un lieu improvisé : écarté de la Phase 9 (état structuré, pas résumé) — lot à part, à cadrer.
- Effets du temps sur le personnage : récupération des points de vie avec le combat (Phase 10), vivres avec le cycle de vie (Phase 12).

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

## Complément de la Phase 7 — Placement initial des PNJ

**Objectif** : qu'un scénario puisse poster ses personnages dans leurs pièces — le garde de son corps de garde, le prisonnier de son caveau — au lieu de laisser le modèle les faire surgir où bon lui semble. Révélé par le scénario « The Stolen Seal », un hôtel particulier joué comme un donjon, un garde au plus par pièce. Tranché le 2026-10-30, **sur le modèle du détenteur initial d'un objet** (Phase 4).

### Décisions de cadrage

- **`initialLocation` sur la définition d'un PNJ unique** : la référence du lieu unique où il attend au début de la partie, ou null. Un archétype n'en a pas (CHECK en base, refus `kind_mismatch` au back-office). `checkScenario` vérifie que le lieu existe.
- **Instancié par le backend à la première visite du lieu**, `absent`, dans ce lieu — seule exception au principe « l'extraction crée les PNJ », comme le détenteur initial pour les objets. L'arrivée du joueur le rend présent, comme quiconque attend dans un lieu (Phase 7) ; si le lieu est celui du départ, il est présent dès le lancement. Un unique déjà rencontré ailleurs n'est jamais recréé.
- **La narration du tour d'arrivée le reçoit** dans `npcs_at_destination`, avant même qu'il existe (handle = référence), quand l'arbitrage a nommé la destination.
- **Liste fermée de l'extraction** : tant qu'il n'est pas rencontré, un PNJ placé ne peut entrer en scène que depuis son lieu ou un lieu d'où l'on peut s'y rendre. Rencontré, il va où l'histoire le mène.
- **Hors périmètre** : les archétypes postés (« un garde dans chaque pièce » sans les nommer) et les emplois du temps, qui déplaceront ces instances au fil des heures (Phase 11).

### Critère de sortie

- Dans « The Stolen Seal », chaque garde attend dans sa pièce : on le trouve en y entrant, et nulle part ailleurs avant.

---

## Entre les Phases 7 et 8 — Ce que le personnage sait

**Objectif** : que la narration ne donne pas au joueur ce que son personnage ignore — le nom de Martha Pike avant qu'elle se soit présentée, « la porte du salon » avant qu'il sache qu'un salon se trouve derrière. Relevé en test manuel le 2026-10-31. Epic Jira `KAN-113`.

### Décisions de cadrage

- **Ce que le personnage sait est tenu par le backend**, comme tout l'état : jamais deviné par le LLM.
- **Noms des PNJ uniques** : `world_states.known_npcs`, rempli au lancement par `initialState.knownNpcs` du scénario (vérifié par `checkScenario`, code `unknown_npc`), puis par l'extraction quand un unique se présente (`npc_names`, dont la chaîne est alors ignorée : le nom reste celui de la définition). Les parties déjà lancées reçoivent les uniques qu'elles ont rencontrés.
- **La narration reçoit le nom, marqué** `known` : un unique inconnu est désigné par son apparence ou son rôle jusqu'à ce qu'il se présente. Un archétype est toujours connu, son libellé ne trahissant rien.
- **Sorties** : la narration ne reçoit le lieu où mène une sortie que si la partie l'a visité ; sinon, le seul passage, avec la consigne de ne rien nommer ni deviner au-delà.
- **Contenu** : `passage` et `backPassage` ne nomment jamais ce qu'il y a derrière, **ni d'un côté ni de l'autre** — un lieu ayant parfois plusieurs entrées, on peut arriver par l'une sans connaître l'autre. La description d'un lieu ne nomme ni une pièce voisine ni un unique pas encore rencontré. Le back-office rappelle la consigne sous les sorties ; un test vérifie les réseaux du contenu en code.
- Ce qu'on sait des prétirés : Tréville dans *A Gascon in Paris* ; Tréville et Jussac dans *The Stolen Seal* ; Silas Ward et Ephraim Crane dans *The Ward Inheritance* ; McRae, Reyes et Whitcombe dans *The Wreck of the Sovereign*, où Voss reste à découvrir.
- **Hors périmètre** : un objet unique nommé avant d'être identifié (« The office key » trouvé dans le corps de garde, le Necronomicon avant qu'on l'ait ouvert), noté pour plus tard.

### Critère de sortie

- Un PNJ unique que le personnage n'a jamais rencontré est désigné par son apparence ou son rôle jusqu'à ce qu'il se présente, puis par son nom.
- Une porte vers une pièce jamais visitée est décrite sans que le récit dise ce qu'il y a derrière.

---

## Phase 8 — Lore étendu et RAG

**Objectif** : dépasser les limites de la connaissance native du LLM sur un univers, ou construire un lore original détaillé.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (2026-11-01, epic `KAN-120`) :

- **Démonstration : un lore inventé dans les Trois Mousquetaires.** Un village des environs de La Rochelle, avec son histoire et ses factions, sur fond de guerre de religion (le siège de 1627-1628). Ce que le modèle ne peut pas savoir, il ne peut le tenir que des fragments : c'est ce qui rend le critère de sortie vérifiable. Le village est un **scénario de test**, écrit en JSON dans `test-worlds/` (hors dépôt) et importé par le back-office : *The Grain Road* (`saint_aubin_des_sauniers.json`), complété par *The Drowned Anchor* (`the_drowned_anchor.json`), une auberge bretonne où un aubergiste disert sert de banc d'essai aux tags. `database/content/` ne reçoit que la reprise de `rules` et `ambiance` ; les tests automatisés ont leurs propres fixtures, au plus juste.
- **Sélection par la scène, jamais par le texte du joueur.** Le backend détermine les tags du moment : le lieu courant (sa définition, unique ou archétype) et ses parents, les PNJ présents, les objets en scène. Un fragment part s'il porte au moins un de ces tags ; un fragment sans tag part toujours. Pas de repérage de mots-clés dans l'entrée du joueur, contrairement à ce qu'envisageait l'architecture : il faudrait des synonymes par langue (contraire à « ni détection, ni traduction »), il raterait toute formulation imprévue, et il laisserait le joueur choisir ce qui entre dans le contexte.
- **Les tags sont des références de contenu** — un lieu, un PNJ ou un objet de l'univers ou du scénario — et rien d'autre : aucun vocabulaire thématique libre à entretenir. La cohérence (`checkScenario`) vérifie que chaque tag désigne une définition. Un fragment qui vaut pour tout le village est tagué du village ; un fragment qui vaut pour tout l'univers n'a pas de tag. Règle le point ouvert de l'architecture (§10) sur la tenue du taggage.
- **`worlds.rules` et `worlds.ambiance` deviennent des fragments sans tag**, et les deux colonnes disparaissent : une seule source de lore, une seule édition, une seule sélection — et le scénario gagne du lore propre, ce qu'il n'avait pas. Migration de données réversible, univers créés au back-office compris. `narrative_tone` reste sur `worlds` : une ligne de cadrage, pas du lore.
- **Table `lore_fragments`**, sur la forme des trois catalogues : au niveau de l'univers ou d'un scénario, qui remplace le fragment de l'univers de même référence.

  | colonne | contenu |
  |---|---|
  | `reference` | référence anglaise, immuable, unique par univers ou par scénario |
  | `kind` | enum natif : `rule` → arbitrage seul (ce qui est plausible) ; `ambiance` → narration seule (ce qui se voit, s'entend, se sent) ; `fact` → les deux (« les huguenots tiennent le moulin et se méfient des gens de Paris ») |
  | `content` | une ou quelques phrases en anglais, jamais traduites ni affichées |
  | `tags` | `text[]` de références, index GIN |
  | `secret` | booléen : ne part qu'à l'arbitrage (« le bailli renseigne le Cardinal ») ; jamais vrai pour une `ambiance` |

  Ni `labels` (un fragment ne s'affiche pas), ni `embedding_id` (pas d'embeddings), ni les quatre `fragment_type` du document de base de données, qui mêlaient le sujet et l'usage : `kind` dit à quelle étape le fragment part. Suppression toujours permise : aucune partie ne référence un fragment.
- **Ce que reçoit chaque étape** : l'arbitrage, les `rule` et `fact`, secrets compris ; la narration, les `ambiance` et `fact` non secrets ; l'extraction, rien, comme avant. Dans le message d'arbitrage, les secrets arrivent à part (`world_context.secret_lore`, le reste dans `world_context.lore`) : ils pèsent sur le jugement, mais l'arbitre ne les énonce ni ne les laisse deviner dans `validity.justification` ni dans `intent.summary`, que la narration lit.
- **Ce que le personnage sait** : un fragment qui part à la narration ne nomme aucun PNJ unique — il le désigne par son rôle, le nom arrivant par `names`, marqué `known` — ni ce qui est derrière un passage, comme une description de lieu. Vérifié par `giveaways` sur le contenu en code et les fixtures ; à la charge de l'auteur pour le contenu importé.
- **Priorité et plafond** : les fragments sans tag d'abord, toujours ; puis ceux du lieu exact, de ses parents du plus proche au plus lointain, des PNJ présents, des objets en scène (ceux du personnage, des PNJ présents, puis du lieu). Un fragment prend le rang de son tag le plus spécifique ; à rang égal, l'ordre du catalogue. Au-delà d'un plafond par étape (`TAGGED_LORE_CAP`, 12 fragments tagués, à ajuster d'après `llm:cost`), les moins spécifiques sont écartés. Plafond fixé dans le code, pas par univers.
- **Arrivée** : quand l'arbitrage désigne une destination, la narration, qui met l'arrivée en scène, reçoit aussi le lore de la destination et des PNJ qui y attendent — la destination juste après le lieu de départ, ses parents après ceux du départ. L'arbitrage, lui, ne voit que la scène du début du tour.
- **Traçabilité** : `turn_log.lore_sent` (jsonb) enregistre, par étape, les références des fragments envoyés — `{ arbitration, narration }`, une étape que le tour n'a pas atteinte valant `null` — pour expliquer après coup d'où la narration tient le moulin.
- **Reprise** : chaque phrase de `rules` et d'`ambiance` devient un fragment sans tag, de référence `rule_01`, `ambiance_01`… dans l'ordre d'écriture ; le retour arrière reconstitue les deux listes à partir des fragments sans tag de l'univers. Le contenu en code donne à ses fragments des références parlantes (`no_supernatural`, `firearms`…).
- **Chargement et sélection** : les fragments font partie de la `WorldDefinition` lue par `loadWorld`, une fois par tour ; la sélection est un service pur, sur le modèle de `travel`.
- **Back-office** : fragments gérés au niveau de l'univers et du scénario ; les listes `rules` et `ambiance` quittent le formulaire d'univers. **L'import JSON d'un univers ou d'un scénario crée aussi ses catalogues** — lieux, PNJ, objets, fragments — en une seule requête et une seule transaction : tout ou rien, chaque entrée validée comme aujourd'hui. Sans quoi un univers importé perdrait ses règles et son ambiance, devenues des fragments. **Un univers s'importe clé en main** : ses catégories d'action viennent avec lui, seuls ses scénarios s'importent à part, un par un. Forme du fichier : celle du contenu en code — les champs du formulaire, plus `npcs`, `locations`, `items`, `lore` (et `actionTypes` pour un univers), chacun facultatif ; un tag peut nommer une définition du même fichier. La première entrée fautive refuse tout le fichier, sur le chemin du champ (`lore.2.tags`, `npcs.1.generic`, `actionTypes.1`). Un tag qui ne désigne rien est refusé (`unknown_tag`), comme une ambiance secrète (`secret_ambiance`), au formulaire comme à l'import.
- **Front joueur : rien.** Le lore ne s'affiche pas.
- **Pas d'embeddings** : la bascule vers une recherche par similarité reste conditionnée au volume réel de lore.

### Contenu

- Pertinent uniquement dans deux cas : un univers original créé pour le produit, ou l'approfondissement d'un univers connu au-delà de ce que le LLM sait déjà nativement.
- Introduction de la table `lore_fragments`, reprise de `worlds.rules` et `worlds.ambiance`.
- Mécanisme de filtrage : **approche par tags**, tirés de la scène (voir les décisions de cadrage). Le passage à une recherche par similarité (embeddings, pgvector ou vector store externe) n'est envisagé que si le volume de lore le justifie réellement.
- Gestion des fragments au back-office, import JSON complet d'un univers (clé en main, scénarios mis à part) ou d'un scénario.

### Critère de sortie de phase

- Le contexte transmis aux étapes LLM concernées (arbitrage, narration) inclut des fragments de lore correctement filtrés par tags, pour un univers dont le contenu dépasse la connaissance native du modèle : dans le scénario du village de La Rochelle, importé par le back-office, l'arbitrage juge et la narration raconte d'après une histoire et des factions que le modèle ne peut pas connaître, et `turn_log` dit quels fragments ont été envoyés.

---

## Phase 9 — Mémoire long terme

**Objectif** : permettre à une partie de durer au-delà de ce qu'un buffer de tours bruts peut raisonnablement couvrir.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (2026-11-02, epic `KAN-128`) :

- **Point de départ** : l'arbitrage recevait les 2 derniers tours, la narration les 4 derniers — tout ce qui précédait était oublié. La phase est donc utile dès maintenant, sans attendre que les parties s'allongent.
- **Déclenchement par nombre de tours** : un résumé de scène est dû dès qu'au moins 8 tours `completed` (`SCENE_SUMMARY_THRESHOLD`) ne sont couverts par aucun résumé et sont plus anciens que les 4 derniers (`TURNS_KEPT_VERBATIM`, jamais résumés). Il condense **tous** ces tours, pas seulement 8 : un job en retard rattrape en un appel. Pas de déclenchement par changement de lieu : le code n'a pas de notion de scène. Règle le point ouvert de l'architecture (§10) sur les seuils.
- **Pas de trou de mémoire** : une étape reçoit les résumés, puis **tous les tours qui suivent le dernier résumé** — et non un nombre fixe. Un tour n'est jamais absent à la fois des résumés et des tours envoyés, aussi tard que tourne le job ; il y en a au moins 4, puisqu'un résumé ne les prend jamais, et au plus 4 + 8 tant que le job suit. L'arbitrage n'en garde que les 2 derniers ; l'extraction ne reçoit rien.
- **Deux niveaux, pas trois** : un résumé `scene` condense un bloc de tours ; un résumé `global`, glissant, absorbe les `scene` les plus anciens au-delà de 4 (`SCENES_BEFORE_FOLD`), en reprenant le `global` précédent. Une étape reçoit le dernier `global` puis les `scene` qu'il n'a pas absorbés (`story_so_far`). Le niveau `chapter` attend que le chapitre change en cours de partie — il est aujourd'hui copié du scénario au lancement, et n'est jamais modifié.
- **Résumé en anglais**, quelle que soit la langue de la partie, en prose courte (120 mots au plus pour une scène, 300 pour le global).
- **Une file à part** (`narrative-summary`), avec son worker (`SummaryWorker`, `concurrency: 1`) : le worker des tours tourne en `concurrency: 1`, et un résumé dans sa file retarderait le tour suivant de tous les joueurs. Le tour met le job en file après sa réussite, si le seuil est atteint ; le job ne porte que l'identifiant de la partie et recalcule ce qui est dû quand il tourne, si bien que deux jobs pour la même partie n'écrivent qu'une fois. Une partie supprimée par le joueur est ignorée.
- **Sécurité** : le résumé est construit **uniquement** depuis l'entrée du joueur et la narration — jamais depuis la sortie d'arbitrage, que le `secret_lore` influence. Son prompt condense des faits (personnes rencontrées, promesses, dettes, objets, ce qui reste ouvert), écarte les apartés au MJ et ne reprend aucune consigne trouvée dans les tours : une injection recopiée persisterait sur toute la partie. Il est réinjecté comme donnée de jeu, jamais comme instruction.
- **Coût** : les jetons de chaque résumé sont enregistrés dans `narrative_summaries.llm_usage`, sous la forme des lignes de `turn_log.llm_usage` (étape `summary`) ; `llm:cost` les compte dans le total, par tour, par partie et par étape, avec un tableau par niveau. Le découpage par langue reste celui des tours.
- **Échec** : ni nouvelle tentative ni événement SSE — c'est du texte libre, pas une sortie structurée. Une erreur ou une réponse vide n'écrit rien ; le seuil, toujours atteint, redéclenche le job au tour suivant. Le joueur ne voit rien.
- **Journal paginé** : `GET /sessions/:id/turns` lit l'histoire par pages de 20 tours (`TURNS_PAGE_SIZE`), les dernières d'abord ou celles qui précèdent un numéro de tour (`?before=`), et dit dans `metadata.hasEarlier` s'il en reste. Le front ouvre une partie sur ses derniers tours ; un bouton *Load earlier* remonte page par page sans déplacer la lecture.

### Hors périmètre

- Rappel des PNJ absents d'un lieu et retour dans un lieu improvisé : de l'état structuré, pas du résumé — lot à part, à cadrer.
- Recherche dans l'historique (embeddings) : le résumé suffit tant que le volume ne l'exige pas.
- Affichage du résumé au joueur.
- Niveau `chapter`, déclenchement par changement de lieu.
- Plafond des tours envoyés quand le job échoue durablement : sans résumé, la narration reçoit tous les tours non couverts. À surveiller en usage.

### Contenu

- Table `narrative_summaries` (`scene` / `global`, plage de tours, `llm_usage`), voir le document de base de données.
- Calcul de la mémoire, pur (`#services/game/narrative_memory`) : ce qu'un tour lit, quand une scène est due, quelles scènes replier.
- Service et prompts de résumé (`#services/game/summary_service`, `prompts/summary`), job dans sa propre file.
- `story_so_far` et tours non couverts dans l'arbitrage et la narration ; prompts système relus.
- Coût du résumé dans `llm:cost` ; pagination du journal.

### Critère de sortie de phase

- Une partie longue (plus de 30 tours) reste cohérente narrativement sans dépendre uniquement du buffer de tours récents : arbitrage et narration se souviennent de faits sortis des derniers tours.
- Aucun tour n'est absent à la fois des résumés et des tours envoyés.
- Le job de résumé ne retarde aucun tour, et son coût se lit dans `llm:cost`.

---

## Phase 10 — Combat

**Objectif** : jouer un combat du BRP de bout en bout, round par round, les dégâts calculés par le backend.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (2026-11-02) :

- **La compétence d'attaque vient de la catégorie d'action, pas de l'arme** : l'arbitrage classe l'attaque en `melee_combat` ou `ranged_combat`, et le backend en déduit la compétence via `resolution_rules`, comme pour toute action — à distance comme au contact. L'arme ne fournit que ses dégâts (dés, usage du modificateur, effet spécial) ; une arme détenue l'emporte toujours sur l'arme ordinaire du profil d'un PNJ. Le moteur garde ainsi un seul chemin de résolution pour toutes les actions.
- **Le round ne mesure que le temps** : un tour de combat avance l'horloge de 12 secondes, imposées par le backend. Ni rangs de `DEX` ni actions multiples : en solo, l'ordre d'action n'a guère d'intérêt, et un tour de Wanderlore reste une action du joueur.
- **L'avantage est toujours au joueur** : dans un round, le personnage agit toujours le premier, quel que soit l'ordre que proposerait le BRP. C'est un jeu solo, où le joueur doit bénéficier d'avantages.
- **Seuls les jets du personnage sont montrés** : le joueur lance à la main, dans le front, les jets de son personnage, et eux seuls. Les jets des PNJ sont tirés par le backend et restent **invisibles au joueur** — ni `roll_resolved`, ni détail dans la lecture du tour ; ils sont tracés dans `turn_log`. Le joueur n'en connaît que ce que la narration en raconte. Restreint la règle de la Phase 6 (« le joueur voit le détail de chaque jet ») aux jets du personnage.
- **Un round complet en un tour, jusqu'à deux jets du personnage** : son attaque (le PNJ se défend en caché), puis, si l'adversaire tient encore debout, sa riposte cachée ; si elle porte, le personnage se défend — parade ou esquive — par un second jet, dans le même tour. Le joueur les lance l'un après l'autre, et la narration couvre le round entier. Un adversaire mis hors de combat par l'attaque ne riposte pas. La perte de points de vie vient toujours d'un jet raté du personnage, jamais de la seule initiative du PNJ. Plusieurs `roll_resolved` par tour : le contrat SSE et la révélation du front (`revealReducer`) les enchaînent.
- **Un tour de combat se déduit à chaque tour, sans état en base** : l'arbitrage dit si l'action engage un combat — une attaque du personnage, désignant sa cible, ou une attaque ouverte contre lui, désignant l'attaquant — et le backend le vérifie (adversaire présent, en liste fermée) avant d'appliquer le round : 12 secondes, riposte, dégâts calculés. Ni `in_combat` dans `world_states` ni fermeture à décider : fuite, reddition ou adversaire à terre font du tour suivant un tour ordinaire.
- **Plusieurs adversaires : un riposteur tiré au hasard** (révisé hors phase, novembre 2026 ; à l'ouverture de la Phase 10, seule la cible ripostait) — une riposte par round au plus, donc deux jets du personnage par tour au plus, mais **tirée au hasard, à chances égales, parmi ceux qui peuvent frapper** : la cible si elle tient debout, n'a pas été arrêtée et peut atteindre le personnage (`riposte_possible`), et chaque autre PNJ présent de disposition `hostile` encore debout (ni `down`, ni mourant). Les jugements de l'arbitrage portent sur la cible seule, sauf la surprise : une attaque que la cible ne voit pas venir (`opponent_aware: false`) prive tout le round de riposte. Un seul candidat, pas de tirage. Le riposteur frappe avec son arme, ses compétences et son modificateur de dégâts ; sa maladresse le blesse ou le désarme, lui. Les autres hostiles pèsent toujours sur les jets du personnage comme une circonstance proposée par l'arbitrage (être en infériorité numérique, `minor_penalty` ou `major_penalty`, dans la limite des 3 modificateurs contextuels), et la narration fait vivre ceux qui ne frappent pas. Le narrateur reçoit qui a frappé (`opponent_blow_by`), le joueur voit sa défense nommer le riposteur.
- **Deux défenses, connues du système** : la **parade**, avec la compétence de `melee_combat` (lue via `resolution_rules`, comme l'attaque), et l'**esquive**, avec une compétence `dodge` que chaque univers déclare (chance de base `DEX` × 2). Les profils de PNJ les lisent de la même façon.
- **La meilleure défense, choisie par le backend** : le joueur a déclaré une attaque, pas une défense — le second jet se fait sur la meilleure chance du personnage parmi les défenses possibles, avantage au joueur appliqué mécaniquement. L'arbitrage dit seulement si la parade est possible ; le PNJ suit la même règle pour sa défense cachée. D'après le livre (chapitre 6, *Dodge* et *Parry*) : contre une arme de mêlée ou de jet, parade ou esquive ; contre un projectile rapide (arme à feu, flèche), pas de parade sans bouclier, et une esquive `difficult`, seulement si l'attaquant est visible — la seule riposte du round étant toujours la première. La variante héroïque du livre (*Dodging Missile Weapons*, esquive pleine contre les tirs) est une règle optionnelle, écartée avant la Phase 13.
- **Surprise, portée et défense adverse, jugées par l'arbitrage** (tranché pendant la recette) : trois champs de plus dans `combat`, à côté de `parry_possible` et `dodge_possible`, qui ne valaient que pour la défense du personnage. `opponent_aware` — l'adversaire voit-il venir le coup du personnage ? Faux (tir depuis une cachette, coup dans le dos, adversaire endormi), il ne se défend pas et ne riposte pas ce round : l'attaque surprise du livre, qui ne se contre pas, sans le jet opposé de Discrétion qui la précède, l'arbitrage la jugeant d'après le récit, pour le premier coup seulement. `riposte_possible` — l'adversaire peut-il atteindre le personnage ce round ? Faux (une rapière contre un tireur de l'autre côté de la rue, pas de ligne de tir), il ne riposte pas. `opponent_defense_modifiers` — jusqu'à trois circonstances de sa défense cachée (acculé, à terre), comme `defense_modifiers` pour le personnage. Le backend garde ses règles par-dessus : un `true` n'ouvre jamais ce que le moteur refuse. Un round où le personnage ne frappe pas est sans surprise (`opponent_aware` exigé à `true`), et un round où personne ne peut frapper n'en est pas un : refusé. La narration reçoit pourquoi l'adversaire n'a ni défense ni riposte (`opponent_caught_unaware`, `opponent_out_of_reach`).
- **Références de combat fixées par le système** : les catégories d'action `melee_combat` et `ranged_combat` et la compétence `dodge` deviennent, comme les sept caractéristiques, des références que le backend connaît — round, parade, riposte s'en déduisent. Chaque univers doit les déclarer ; la cohérence du contenu (formulaire, import, `checkScenario`) refuse celui qui ne le fait pas. Elles restent du contenu pour tout le reste (description, compétence associée, libellés).
- **Le profil d'arme dit sa nature, plus sa compétence** : le champ `skill`, rendu inutile par la première décision, est remplacé par `kind` — `melee`, `thrown` ou `projectile`. La catégorie d'une riposte de PNJ (`melee` → `melee_combat`, sinon `ranged_combat`) et les défenses possibles (contre un `projectile`, ni parade ni esquive ordinaire) s'en déduisent. `damageModifier` reste un champ à part, fidèle aux tables du livre.
- **Modificateur de dégâts d'un PNJ saisi, pas dérivé** : un champ `damageModifier` du profil de combat (expression de dés, `+1D4`, ou `null`), comme les points de vie et comme les fiches de créatures du livre. Les PNJ restent sans caractéristiques.
- **Armure** : une valeur `armor` sur la définition d'objet, comptée pour son détenteur **seulement s'il l'a équipée** ; une valeur `armor` dans le profil de combat d'un PNJ, son armure ordinaire, qu'une armure détenue et équipée remplace — sur le modèle de l'arme ordinaire. Plusieurs armures équipées : seule la meilleure compte. Simplification volontaire : le livre permet de superposer les armures (chapitre 8, *Layering Armor*), au prix d'un encombrement que Wanderlore écarte — sans lui, le cumul ne coûterait rien.
- **Points de vie totaux pour le personnage** : `CON + SIZ`, sans division — la règle optionnelle *Total Hit Points* du livre, que celui-ci dit « very heroic » quand seuls les personnages joueurs l'emploient. Pour tous les univers, par exception à « aucune règle optionnelle avant la Phase 13 » : en solo, sans compagnon pour le soigner, c'est l'avantage au joueur le plus simple. Les PNJ gardent les points de vie saisis dans leur profil. **Provisoire** : le calcul dépendra du niveau de puissance de l'univers en Phase 13.
- **Blessure grave : le choc, pas les séquelles** : un coup d'au moins la moitié des points de vie totaux est une blessure grave, qualifiée comme telle pour la narration ; à 2 points de vie ou moins après elle, le blessé s'écroule (choc). Ni jet de Chance ni table des séquelles permanentes : perdre des points de caractéristique modifie la fiche, ce qui relève de la Phase 12. Pas non plus de compte à rebours « autant de rounds que de points de vie restants », qu'il faudrait tenir en base faute d'état de combat.
- **Le personnage ne meurt pas en Phase 10** : à 0 point de vie, il est mis hors de combat — capturé, laissé pour mort ou secouru, selon ce que la narration retient (le livre conseille, en solo, la capture plutôt que la mort). Il revient à 1 point de vie, inconscient, et le temps passe. La mort réelle, et la fin de partie qui va avec, attendent le cycle de vie complet de la Phase 12.
- **Le PNJ suit le livre** : à 2 points de vie ou moins après une blessure grave, il est hors de combat et ne riposte plus ; à 0 ou moins, blessure mortelle — il meurt à la fin du tour suivant, fixé par le backend, sauf premiers soins réussis d'ici là qui le ramènent à 1 point de vie au moins. Mort, ses objets passent au lieu.
- **Une cible improvisée existe avant le jet** (règle le point ouvert ci-dessous) : l'arbitrage peut désigner comme cible un archétype, pris dans la liste fermée des archétypes de l'univers ; le backend en crée l'instance (handle, points de vie du profil) avant de résoudre le round, et l'extraction la trouve déjà présente. Seconde exception à « seule l'extraction crée les PNJ », après le placement initial, pour la même raison : le backend en a besoin avant elle.
- **Blessures hors combat : l'extraction garde un palliatif** — `hit_points_delta`, négatif seulement, sur l'échelle fixe actuelle (chute, feu, poison), en attendant que les dangers du livre soient pris au cas par cas (système de règles, section 11). Le backend l'ignore lors d'un tour de combat, où ses propres dégâts font foi. L'extraction ne soigne plus.
- **Premiers soins** : une catégorie d'action `first_aid` fixée par le système, comme `melee_combat`, résolue par une compétence de l'univers. Le backend chiffre l'effet d'après le degré, comme le livre : `fumble` −1 point de vie, `failure` rien et plus de tentative, réussite +1D3, `special` +2D3, `critical` +3+1D3 ; une réussite ranime aussi un inconscient et sauve un mourant. Impossible en plein combat. Une tentative par blessure reçue depuis la dernière tentative — un drapeau plutôt qu'un compte des blessures une à une. Vaut pour le personnage comme pour un PNJ mourant.
- **Guérison naturelle** : 1D3 points de vie par semaine de jeu, appliqués par le backend chaque fois que l'horloge franchit une tranche de 7 jours depuis le dernier palier (heure de jeu retenue). Sans étalement au jour près. Un autre soin (potion, médecin) attend qu'un objet ou un scénario le demande.
- **Effets spéciaux : seulement ce qui se résout dans le round**, sauf le saignement. **Empalement** : dés de l'arme doublés (l'arme fichée dans la plaie reste narrative). **Écrasement** : modificateur de dégâts doublé, et la cible étourdie ne riposte pas ce round. **Enchevêtrement** et **repoussement** : la cible ne riposte pas ce round — sans carte, la distance n'a pas de sens. **Saignement** : un drapeau `bleeding` sur le personnage ou le PNJ, −1 point de vie à chaque tour de combat suivant, arrêté par les premiers soins et de lui-même à la fin du combat. **Avantage au joueur** : la réussite spéciale d'un PNJ n'applique que ses dégâts (empalement, écrasement, saignement) — le personnage n'est jamais étourdi ni immobilisé.
- **Maladresses : une table réduite de cinq issues**, tirée en 1D100 par le backend — rien de plus qu'un échec (aussi quand l'issue tirée ne s'applique pas) ; arme lâchée, qui passe au lieu par le service d'inventaire ; arme brisée, l'objet détenu détruit, jamais un objet unique ; blessure à soi-même, dés de l'arme sans modificateur ; chute, la riposte du round devenant `easy`. L'arme ordinaire d'un PNJ n'est pas un objet : ni lâchée ni brisée, l'issue reste narrative. La narration reçoit l'issue en label, jamais en chiffre.
- **Ni jets opposés hors combat ni table de résistance** : en combat, le jet opposé du livre est la matrice attaque / défense. La table de résistance a perdu ses usages de combat avec les simplifications ci-dessus (repoussement, enchevêtrement) et exigerait des caractéristiques pour les PNJ. Les jets opposés hors combat (Discrétion contre Perception, mensonge contre un garde) toucheraient une large part des actions sociales et de discrétion, que l'arbitrage règle aujourd'hui par la difficulté : un lot à part, à cadrer pour lui-même (système de règles, section 11).
- **États du combat en colonnes typées**, sur les tables existantes — des états du système, pas des structures propres à un univers : `bleeding` et `first_aid_available` sur `characters` et sur `npc_instances` ; `healing_since` (heure de jeu du palier de guérison, `null` à points de vie pleins) sur `characters` ; une valeur `dying` dans l'enum du statut des PNJ, résolue à l'application du tour suivant (aparté excepté) — mort, sauf premiers soins réussis entre-temps. Le PNJ hors de combat se lit à ses points de vie (2 ou moins, comme le livre après une blessure grave ou des blessures légères accumulées), le personnage inconscient dans la narration : ni l'un ni l'autre n'a d'état. Rien dans `world_states`.
- **Parties en cours** : `hit_points_max` reste une colonne, écrite au lancement (et plus tard par la progression). La migration des points de vie totaux la recalcule (`CON + SIZ`) et ajoute la différence à `hit_points`, pour garder les dégâts déjà subis — ni refus ni `game:reset`.
- **Un PNJ ne guérit pas de lui-même en Phase 10** : seuls les premiers soins lui rendent des points de vie ; sa guérison dans le temps pourra venir avec les emplois du temps de la Phase 11.
- **Dégâts montrés, jamais lancés à la main** : ceux que le personnage inflige s'affichent en détail (dés de l'arme, modificateur, armure, total), sans geste de lancer. Ceux qu'il subit viennent d'un jet de PNJ : le joueur n'en voit que la perte de points de vie, pas le détail.

### Contenu

- Combat modélisé comme séquence de jets alternés joueur/PNJ, conformément au modèle générique déjà défini dans le système de règles — cette phase implémente concrètement la boucle round par round, le modèle mécanique sous-jacent existant déjà depuis la Phase 3/4.
- Branchement de la formule de dégâts du BRP posée en Phase 6 (dés de l'arme + modificateur de dégâts − armure) : l'arbitrage désigne attaquant et cible, le backend calcule les dégâts et les applique, et l'extraction cesse de chiffrer les blessures. Une arme détenue par un PNJ l'emporte sur l'arme ordinaire de son profil ; la compétence d'attaque se déduit de la catégorie d'action, jamais de l'arme (voir les décisions de cadrage).
- Reste du combat du BRP (système de règles, sections 8 et 11) : matrice attaque / défense avec parade et esquive, armure, blessures grave et mortelle, effets spéciaux, table réduite de maladresses ; points de vie totaux pour le personnage.
- Temps du combat et du personnage, sur l'horloge de la Phase 7 : un tour de combat vaut un round du BRP (12 secondes), durée imposée par le backend et non proposée par l'arbitrage, sans rangs de `DEX` ni actions multiples ; soins (premiers soins en un round, guérison naturelle de 1D3 PV par semaine) et récupération calés sur le temps écoulé.
- Mise en œuvre : moteur pur dans `#services/rules/engine` (matrice, défense, dégâts, maladresses, soins) ; round pur dans `#services/game/combat`, appliqué par `#services/game/apply_combat` dans la transaction du tour ; références du système dans `#services/game/system_references` ; `turn_log.combat_result` et `turn_log.first_aid` pour la trace ; `rolls` à la place de `roll` dans la lecture d'un tour, et un `roll_resolved` par jet du personnage.
- **Démonstration** : *The Duel at the Carmes*, scénario de test des Trois Mousquetaires en JSON dans `test-worlds/` (hors dépôt) — trois gardes du Cardinal derrière les Carmes-Déchaux, l'un avec un pistolet, l'autre sous une cuirasse, une rue pour fuir, des bandes de lin pour panser.

> **Prérequis** : la boucle de combat s'appuie sur `npc_instances`, posée en Phase 3 (état et disposition) et complétée en Phase 4 (données de combat). Cette phase n'ajoute que la boucle de rounds.
>
> **Point réglé** (voir les décisions de cadrage, « Une cible improvisée existe avant le jet ») : les instances de PNJ ne sont créées que par l'extraction (E), en fin de tour. Un PNJ improvisé que le joueur attaque dès son apparition (« je frappe le passant ») n'existe donc pas encore au moment du jet. Sans incidence tant que le jet n'oppose le joueur qu'à une difficulté ; avec les jets opposés, l'arbitrage devra pouvoir désigner un archétype comme cible et le backend en lire le profil.

### Critère de sortie de phase

- Un combat complet est jouable de bout en bout avec plusieurs rounds.

---

## Phase 11 — Échéances et événements déclenchés par le temps

**Objectif** : que le monde avance de lui-même avec l'horloge de la Phase 7, sans attendre une action du joueur.

### Décisions de cadrage

Tranchées à l'ouverture de la phase (2026-11-03). Trois sortes d'échéances : déclenchées par le temps (le troisième jour, les gobelins attaquent le camp des elfes), par l'état (quand on a volé son œuf, le dragon se réveille et s'envole), et cycliques (tous les matins, le Cardinal passe ses troupes en revue dans la cour ; le vampire est au tombeau le jour, au château la nuit ; l'entrée de la grotte est noyée par la marée).

- **Le monde n'avance qu'avec l'horloge de jeu** : l'horloge ne bouge qu'à chaque tour, et tout s'évalue dans le tour, de façon déterministe, par le backend — ni job différé, ni temps réel, ni appel LLM de plus. Un aparté ne prend aucun temps et ne déclenche donc rien.
- **Deux structures de contenu** :
  - les **cycles**, sans état, dérivés de l'heure comme la période : emploi du temps d'un PNJ unique, passage bloqué par période, note de période sur un lieu ;
  - les **événements**, avec état, déclenchés une seule fois, saisis sur le scénario (`scenarios.events`, jsonb).

  « Tous les matins, le Cardinal passe ses troupes en revue » est un emploi du temps (le lieu et l'activité), pas un événement répété.
- **Forme d'un événement** :

  ```ts
  type ScenarioEvent = {
    reference: string
    when: {
      at?: { day: number; period?: Period; time?: string } // a deadline
      conditions?: EventCondition[]                       // all must hold
      delay?: EventDelay                                  // after the conditions first hold: a fixed span, or days
    }
    unless?: EventCondition[]          // checked when it falls due: if any holds, it never happens
    place: string | null               // where it happens; null = felt everywhere (bells, a storm)
    description: string                // one line of English, for arbitration and narration
    effects: EventEffect[]
    interrupts: boolean                // cuts a long action short when witnessed
    foreseeable: EventCondition[] | null // when the character knows it is coming; null = never
  }
  ```

  Une **échéance** est un événement daté (`at`), éventuellement assorti d'un `unless` (les gobelins attaquent le jour 3, sauf si les elfes ont été prévenus).
- **Conditions en liste fermée, lues dans l'état, jamais dans le texte** : `flag`, `item_held_by` (personnage, PNJ ou lieu), `item_gone`, `npc_dead`, `npc_disposition`, `npc_at` (tel PNJ dans tel lieu), `location_visited`. Une condition d'état vaut mieux qu'un flag quand l'état la porte déjà : pour l'œuf, `item_held_by: character` ne dépend pas de ce que l'extraction aura pensé à noter. Avec `delay`, l'événement est **armé** à l'instant où ses conditions sont réunies (`armed_at`), puis tombe à `armed_at + delay` : il redevient un événement de temps.
- **Effets en liste fermée, appliqués par le backend** à travers les services existants (PNJ, passages, inventaire) — le LLM n'en propose aucun :
  - PNJ : `npc_moved` (vers un lieu), `npc_left` (lieu inconnu), `npc_entered` (un unique ou un archétype, dans un lieu), `npc_disposition`, `schedule_stopped` (l'emploi du temps cesse : le Cardinal arrêté ne retourne pas passer ses troupes en revue) ;
  - lieux : `passage_blocked` / `passage_cleared`, `passage_discovered`, `passage_unlocked`, `place_note_set` / `place_note_cleared` ;
  - objets : `item_placed` (créé dans un lieu ou chez un PNJ : le carrosse du Cardinal dans les écuries), `item_transferred`, `item_gone` ;
  - histoire : `flag_set` ;
  - personnage : `character_harmed` (**ajouté hors phase, novembre 2026**) — un piège, une explosion : une formule de dégâts de l'auteur (dés `12D6`, nombre fixe `6`, ou mixte `2D4+8`), tirée par le backend, moins l'armure portée, infligée au seul personnage témoin de l'événement (dans son lieu, ou partout pour un événement sans lieu). Le tirage et ce que l'armure a arrêté vont dans `events_fired`, jamais au LLM. Voir architecture §6sexies.
- **État par partie** : une table `event_states` (partie, référence de l'événement, `armed_at`, `fired_at`, `cancelled_at`, numéro du tour, `witnessed`, `told`), sur le modèle de `passage_states` ; une colonne `blocked_at` sur `passage_states` ; une table `place_notes`. **Un lieu jamais visité n'a pas d'instance**, et en créer une le marquerait visité : un objet, un PNJ ou une note qu'un effet y pose reste en attente dans une colonne `world_states.pending_place_effects` (lieu, effet, événement), et se matérialise à la première visite, comme le placement initial.
- **Flags déclarés** : le scénario porte un catalogue `flags` (référence et description d'une ligne, en anglais), et l'extraction choisit dans la **liste fermée** des flags du catalogue pas encore posés — conformément à l'invariant 9, que les flags libres de la Phase 1 ne respectaient pas. Un événement pose aussi des flags (`flag_set`), ce qui permet les chaînes. Les flags libres des parties en cours restent lisibles dans `narrative_flags`, mais aucun nouveau ne peut s'écrire hors catalogue. La validation accepte tout le catalogue : reposer un flag déjà posé ne change rien, et ne fait pas rejeter la sortie (tranché pendant l'implémentation).
- **Deux moments d'évaluation** :
  - **avant la narration**, juste après le calcul de la durée : les événements de temps de la fenêtre `(avant, après]` du tour, et les cycles du lieu du personnage. Ce qu'ils font entrer en scène (gobelins, Cardinal) est créé par le backend avant la narration, comme l'adversaire provisoire d'un round : la narration le voit présent, l'extraction le trouve déjà là et ne le recrée pas. Leurs effets s'appliquent dans la transaction du tour ;
  - **après le delta**, sur l'état nouveau : les événements d'état, en chaîne bornée (un événement peut en rendre un autre dû) — par passes, 3 au plus (`EVENT_CHAIN_DEPTH`) ; un dépassement ne fait pas échouer le tour, ce qui reste dû est repris au tour suivant et tracé —, puis les emplois du temps des PNJ qui ne sont pas avec le personnage. Un événement d'état dépend de ce que l'extraction a lu : il se raconte **au tour suivant** (le vol au tour N, le rugissement au tour N + 1).
- **Ordre d'application dans la transaction** : horloge, mourants, round, premiers soins, effets des événements de temps, delta de l'extraction, guérison, événements d'état, emplois du temps.
- **Un événement peut interrompre une action** (`interrupts`) : la fin du tour est le plus tôt de la fin prévue et de l'instant du premier événement interrompant dans la fenêtre. « Je dors jusqu'au matin » et une attaque nocturne de gobelins : le personnage est réveillé, l'horloge est à la nuit. Précisions :
  - seul un événement **dont le personnage est témoin** interrompt — dans son lieu, ou sans `place` ; l'attaque du camp des elfes, à l'autre bout de la carte, ne réveille personne ;
  - à partir de `minutes` seulement : ni `moment` ni un round de combat ne s'interrompent ;
  - l'arrivée d'un PNJ par son emploi du temps interrompt s'il est `hostile` ou si l'entrée de l'emploi du temps porte `interrupts` (le vampire qui rentre au château où dort le personnage) — pas l'aubergiste au matin ;
  - un jet déjà tranché reste acquis, et la narration reçoit `interrupted` avec l'événement, pour raconter l'action écourtée ;
  - un trajet dans un réseau va toujours au bout : seul le temps passé à l'arrivée s'interrompt ;
  - le combat commence au tour suivant : la narration pose l'attaque, le joueur y répond. Avantage au joueur, comme en Phase 10.
- **Le joueur peut attendre un événement** : deux durées de plus dans l'échelle de l'arbitrage. « J'attends l'arrivée du Cardinal » mène à l'heure de son arrivée, le Cardinal présent.
  - `until_event` + référence d'un événement **prévisible** : le backend le mène à l'instant où il tombe. L'arbitrage ne reçoit, en liste fermée, que les événements dont la condition `foreseeable` est remplie (le personnage sait qu'il vient, par exemple par un flag posé quand il l'apprend), avec leur description et **jamais leur heure**, à part, sans les énoncer, comme `secret_lore` ;
  - `until_npc` + référence d'un PNJ unique **connu** (`known_npcs`) : jusqu'au prochain moment où son emploi du temps l'amène dans le lieu du personnage ;
  - **plafond de 7 jours**, comme `days` : si rien ne vient d'ici là (événement annulé par `unless`, emploi du temps qui ne passe jamais par ici), le backend fait attendre `hours` et la narration reçoit `awaited: did_not_happen` — on a attendu, personne n'est venu ;
  - une interruption passe avant ce qu'on attend.
- **Emplois du temps des PNJ uniques** (`npc_definitions.schedule`) : une liste d'entrées `{ periods, location, activity, leavesScene, interrupts }`, dont chaque période relève d'une seule entrée ; une période sans entrée laisse le PNJ où il est. `activity`, une ligne d'anglais (« reviews his guards »), part à la narration quand le PNJ est en scène. Précisions :
  - un PNJ **en scène** avec le personnage ne suit son emploi du temps que si l'entrée porte `leavesScene` (le vampire fuit l'aube, même devant le personnage) ; sinon il reste, et rejoint son emploi du temps une fois la scène quittée ;
  - un PNJ **pas encore rencontré** n'est pas instancié : `npcsPlacedIn` lit le lieu que lui donne son emploi du temps à l'heure courante au lieu de `initialLocation`, qui ne sert plus qu'aux PNJ sans emploi du temps ;
  - un PNJ mort n'a plus d'emploi du temps, et `schedule_stopped` y met fin ;
  - pas d'emploi du temps pour un archétype (les archétypes postés restent hors périmètre, complément de la Phase 7) : « une seule sentinelle la nuit » est une note de période sur le lieu.
- **Seul un passage se bloque, jamais un lieu** : un passage bloqué ne se franchit d'aucune façon — ni clé, ni crochetage — à la différence de `locked`. Cyclique (`blockedDuring: Period[]` et `blockedReason` sur une sortie, « the sea fills the cave mouth ») ou posé par un événement. **Des deux côtés**, comme `requires`. `#services/game/travel` n'en fait ni une destination ni une étape de chemin, évalué au début du tour, comme le reste du parcours. Arbitrage et narration reçoivent la sortie avec l'état `blocked` et sa raison. Si l'entrée d'une grotte se rejoint depuis le monde libre, l'auteur fait de la plage l'entrée du réseau et déclare une sortie « plage → grotte » : pas de seconde notion d'accessibilité d'un lieu.
- **Notes de scène** : une ligne d'anglais ajoutée à la description d'un lieu (« the stables smell of horses not your own »), pour ce qui change l'aspect d'un lieu sans conséquence mécanique — ce sur quoi le joueur peut agir est un objet ou un passage. Cycliques (`periodNotes: { periods, note }[]` sur la définition de lieu) ou posées par un événement. Comme la description, elles partent à l'arbitrage et à la narration, jamais à l'extraction, et ne nomment ni un unique pas encore rencontré ni ce qu'il y a derrière un passage (`giveaways`, étendu aux notes).
- **Ce que voit chaque étape** :
  - la narration : la `description` des événements dont le personnage est témoin dans le tour et de ceux d'état tombés au tour précédent, `interrupted` ou `awaited` s'il y a lieu, l'activité des PNJ en scène, les notes de scène, les passages bloqués. Jamais un événement lointain : le personnage en découvre les suites en y allant, par l'état ;
  - l'arbitrage : les événements tombés, comme faits du monde, à part et sans les énoncer, jusqu'à ce qu'un résumé `scene` couvre leur tour ; les événements prévisibles (pour `until_event`) ; les notes et les passages bloqués. Jamais un événement à venir qui n'est pas prévisible ;
  - l'extraction : la scène déjà modifiée et le catalogue des flags, rien d'autre ;
  - le front : rien. Ce que l'horloge déclenche passe par le récit, comme le temps lui-même (Phase 7).
- **Traçabilité** : `turn_log.events_fired` (les événements tombés, leur instant et leurs effets), et la durée proposée, la durée réelle et la cause d'un écart (interruption, attente atteinte ou manquée).
- **Contenu et outils** : événements, flags, emplois du temps, passages bloqués et notes de période saisis en JSON brut validé au back-office, comme les sorties, et repris par l'import JSON. `checkScenario` vérifie que toute référence existe (lieux, PNJ, objets, flags, événements), que les entrées d'un emploi du temps ne se chevauchent pas, et que les chaînes d'événements ne bouclent pas.

Tranchés pendant l'implémentation et la recette :

- **Un effet sur un unique jamais rencontré attend lui aussi** (`pending_place_effects`, `waitsFor: { npc }`) : l'aubergiste rendu hostile par le vol de la lettre l'est à la première rencontre, sans être instancié d'avance.
- **Placement paresseux** : un unique doté d'un emploi du temps n'est instancié qu'à sa rencontre ; `placeInitialNpcs` l'ignore, et l'emploi du temps arrêté (`schedule_stopped`) se déduit des événements tombés, sans colonne.
- **Une note d'événement par lieu au plus** (`place_notes`, unique par lieu) : une nouvelle remplace l'ancienne, et s'ajoute aux notes de période.
- **Pas d'improvisation dans un réseau, même depuis l'extérieur** : un lieu improvisé n'a pour parent qu'un lieu libre ou un lieu qui contient un réseau (`improvisationParents`). Depuis la Phase 7, l'extraction pouvait rattacher un lieu improvisé à une pièce d'un réseau quand le personnage venait du dehors — un « je retourne à l'auberge » depuis les quais créait une auberge dans la grande salle, et les vraies pièces, avec ce qu'elles contiennent, n'étaient jamais visitées.

### Contenu

- Catalogue de flags et liste fermée à l'extraction.
- Emplois du temps des PNJ uniques : contenu, `#services/game/schedules` (pur), placement paresseux des PNJ non rencontrés, déplacement en fin de tour, `until_npc`.
- Passages bloqués et notes de scène, cycliques et posés par un événement.
- Événements de temps : contenu, `event_states`, `#services/game/events` (pur : contenu, état et fenêtre donnent les événements dus, leurs instants et l'interruption), `#services/game/apply_events`, interruption, `until_event`.
- Événements d'état : conditions, délai, chaînes, narration au tour suivant.
- Back-office, import JSON, `checkScenario`.
- Mise en œuvre : `#services/game/events` et `#services/game/schedules` (purs), `#services/game/game_events` (lecture), `#services/game/apply_events` (écriture), `#services/game/pending_effects` (ce qui attend) ; migration `add_deadlines_and_events` (`scenarios.flags` et `events`, `npc_definitions.schedule`, `location_definitions.period_notes`, `passage_states.blocked_at`, `world_states.pending_place_effects`, `turn_log.events_fired`, tables `event_states` et `place_notes`), sans reprise des parties en cours.
- **Démonstration** : *The Golden Lion*, scénario de test des Trois Mousquetaires en JSON dans `test-worlds/` (hors dépôt), volontairement sans histoire — une nuit dans une auberge de la rue de la Harpe. Un messager prévisible (22 h 30), un incendie aux écuries que le personnage ne voit pas (22 h 15), une rixe qui interrompt le sommeil (23 h), une descente à l'aube annulée si l'aubergiste a été payé (`unless`) et qui bloque la porte de la cour ; le vol de la lettre du Cardinal qui rend l'aubergiste hostile et arme, une heure plus tard, l'arrivée de Rochefort, qui pose en chaîne un carrosse aux écuries jamais visitées et arrête l'emploi du temps d'un moine. L'aubergiste et le moine suivent un emploi du temps (le moine interrompt la nuit, quitte la scène à l'aube), la trappe de la cave est bloquée du crépuscule à l'aube, la grande salle a ses notes de période.
- **Coût mesuré** (novembre 2026, `gemini-3.8-flash` à 0,75 $ / 3,75 $ le million) : **1,04 ¢ par tour** sur *The Golden Lion* (43 tours, environ 10 700 jetons d'entrée et 640 de sortie par tour), contre 0,95 ¢ sur *The Duel at the Carmes* et 0,97 ¢ en moyenne sur toutes les parties. L'écart, de l'ordre de 10 %, reste dans la variation d'un scénario à l'autre (0,87 ¢ à 1,01 ¢ pour les démonstrations précédentes) : événements, notes, activités et listes d'attente ne pèsent que quelques lignes d'anglais à l'arbitrage et à la narration, et l'extraction n'en reçoit que le catalogue des flags.

### Hors périmètre

- Cycles au-delà des périodes : « tous les N jours », jours de la semaine (qui exigeraient une date), calendrier propre à un univers.
- Archétypes à horaires, horaires d'ouverture des lieux, météo.
- Guérison d'un PNJ dans le temps (évoquée en Phase 10).
- Événements répétés porteurs d'effets : un cycle ne fait que placer, bloquer ou décrire.

### Critère de sortie de phase

- Un scénario déclare une échéance, un événement et un emploi du temps de PNJ, et le backend les applique quand l'horloge les atteint.
- Une longue action est interrompue par un événement dont le personnage est témoin, et « attendre » un événement prévisible ou un PNJ connu mène à son arrivée.

---

## Phase 12 — Progression du personnage et cycle de vie complet de la partie

**Objectif** : faire progresser le personnage et mener une partie de sa création à sa fin.

La phase se mène en lots : d'abord la création du personnage et les parties d'un personnage, puis les conditions de fin de partie, puis la progression, puis la pause et la reprise.

### Décisions de cadrage — création du personnage et parties d'un personnage

Tranchées à l'ouverture de la phase (2026-11-04). Le parcours du joueur : il choisit un univers, y crée un personnage, puis choisit un scénario de cet univers pour ce personnage. Le prétiré du scénario disparaît.

- **Le personnage appartient au joueur et à un univers, plus à une partie.** `characters` devient la fiche durable : `user_id`, `world_id`, nom, `gender`, profession, caractéristiques, compétences, `deleted_at` ; `session_id` disparaît, et la partie désigne son personnage (`sessions.character_id`, de même univers, garanti par clé étrangère composite comme pour le scénario). Un personnage reste lié à son univers pour toujours.
- **Le personnage ne garde rien d'une partie à l'autre** (pour l'instant) : points de vie, saignement, premiers soins, guérison et ressources vivent le temps d'une partie, dans une table `character_states` (une par partie) ; l'inventaire reste rattaché à la partie (`inventory_items.session_id`) et au personnage comme détenteur. Chaque lancement repart à neuf : points de vie au maximum, équipement et ressources de départ. Caractéristiques et compétences se lisent sur la fiche durable, sans copie : un personnage n'étant engagé que dans une partie à la fois, rien ne peut diverger, et la progression (lot suivant) écrira sur la fiche.
- **Création en cinq étapes, selon le livre** (*Choosing Characteristic Values*, *Step Seven*), toutes validées par le backend à la soumission :
  1. **Tirage** : sept fois 4D6 dont on garde les trois meilleurs (écart au livre, qui tire 3D6), tirés par le backend (`dice`) et gardés en base (`character_rolls`, une série courante par joueur) — le joueur ne peut placer que ce qui a été tiré. **Relance à volonté** : chaque relance remplace la série. Le front montre les dés comme un jet en direct (préférence d'animation, `prefers-reduced-motion` en plancher) ; il ne calcule rien.
  2. **Placement** : le joueur répartit les sept résultats entre les sept caractéristiques — une permutation exacte de la série. SIZ et INT ne descendent jamais sous 8 : un résultat plus bas placé là est relevé à 8. Pas de redistribution de 3 points.
  3. **Profession**, choisie dans le catalogue de l'univers.
  4. **Compétences** : une réserve professionnelle, sur les seules compétences de la profession, et une réserve personnelle de INT × 10, sur n'importe quelle compétence de l'univers. La valeur d'une compétence = sa chance de base (calculée sur les caractéristiques placées) + les points des deux réserves. Le niveau de puissance de l'univers fixe la réserve professionnelle et le plafond de la valeur à la création : `normal` 250 points et 75 %, `heroic` 325 et 90 %, `epic` 400 et 101 %, `superhuman` 500 sans plafond. Une réserve ne se dépasse pas ; un reliquat est permis (le front le signale).
  5. **Identité** : un nom de 1 à 35 caractères (lettres, espaces, apostrophe, trait d'union, point), et un genre en choix fermé (`female`, `male`, `neutral`). Pas de champ libre.

  Le front tient le brouillon des étapes ; seule la série tirée est en base, consommée par la création (`POST /characters`, une seule soumission). **Le front ne calcule rien, même ici** : un aperçu (`POST /characters/preview`, sans écriture) lui renvoie, à chaque changement, la fiche calculée (caractéristiques relevées, valeurs, restes des réserves) et les refus par champ — le même calcul pur que la création. Les points de vie ne s'enregistrent pas sur la fiche : ils se dérivent au lancement.
- **Niveau de puissance par univers** (`worlds.power_level`, enum natif `normal`, `heroic`, `epic`, `superhuman`), saisi au back-office et repris par l'import JSON. Contenu : `normal` pour le Mythe de Lovecraft, `heroic` pour les Trois Mousquetaires. Les réserves et plafonds par niveau sont fixes dans le code, comme le reste du moteur de règles.
- **Professions en catalogue d'univers** (`professions`), sans surcharge par scénario : référence immuable, libellés par langue, description d'une ligne en anglais, compétences professionnelles (références de compétences de l'univers), équipement de départ (objets, quantité, équipé ou non) et ressources de départ. Une profession employée par un personnage ne se supprime pas (`content_in_use`).
- **Équipement de départ = profession + scénario** : la rapière vient de la profession *musketeer*, la lettre pour Tréville du scénario (`scenarios.starting_kit` : objets et ressources, à la place de `pregenerated_character`). Au lancement, les objets de la profession puis ceux du scénario sont créés par le service d'inventaire, sur l'univers résolu (une définition de scénario surcharge celle de l'univers de même référence, objet de profession compris), et les ressources s'additionnent. Un objet de profession est une définition de l'univers, jamais d'un seul scénario. `checkScenario` vérifie le kit du scénario, et qu'aucune profession de l'univers ne le rend impossible (un objet unique donné deux fois).
- **Ce que voient les étapes** : le nom est désormais un texte du joueur — introduit comme donnée de jeu, comme son entrée, borné par sa longueur et son jeu de caractères. La narration reçoit le nom, le genre (pour les pronoms et les accords) et la profession (libellé et description) ; l'arbitrage, le nom et la profession (la plausibilité d'un médecin qui soigne, d'un mousquetaire reçu chez Tréville). L'extraction ne reçoit rien de plus.
- **Une partie à la fois par personnage** : un personnage est engagé tant qu'une de ses parties est `in_progress` ou `paused` — index unique partiel sur `sessions(character_id)`, refus `character_engaged` au lancement.
- **Statuts d'une partie** : `in_progress`, `paused`, `completed` (réussie), et **`failed`**, avec `sessions.ended_at`. La raison d'une fin (abandon, mort, victoire) arrive avec les conditions de fin de partie.
  - **Abandon** : à la demande du joueur, avec confirmation, la partie passe en `failed` ; refusé pendant un tour en cours. Une partie `failed` est close : son journal se relit, aucun tour ne s'y soumet plus.
  - **Rejouer** un scénario `failed` crée une partie neuve, soit une nouvelle tentative ; la partie échouée reste close. Un scénario **réussi** (`completed`) par ce personnage ne se rejoue pas : il n'apparaît plus dans ses scénarios disponibles.
  - **Suppression douce d'une partie** (`deleted_at`, inchangée) : seulement une partie `failed`.
  - **Suppression douce d'un personnage** (`characters.deleted_at`) : seulement s'il n'est engagé dans aucune partie ; ses parties restent en base, invisibles.
- **Front** :
  - **accueil** : la liste des personnages du joueur, les engagés d'abord (avec leur partie en cours, à reprendre), puis par dernière activité ; la liste des univers jouables, pour y créer un personnage ;
  - **création** : un parcours en cinq étapes, avec retour en arrière possible avant la soumission ;
  - **page d'un personnage** : sa fiche, sa partie en cours (reprendre, abandonner), les scénarios disponibles de son univers (publiés ; brouillons compris pour un `game_master`, qui suit le même parcours pour tester), ses parties passées (échouées, supprimables ; réussies) ; sa suppression.
- **Back-office** : niveau de puissance sur l'univers ; onglet *Professions* (formulaire, JSON brut validé pour l'équipement) ; équipement de départ du scénario à la place du prétiré ; import JSON (un univers clé en main porte ses professions et son niveau, un scénario son équipement de départ). Ce que les validateurs ne voient pas (compétence ou objet qui n'existe pas dans l'univers, objet de scénario dans une profession) se refuse dans `catalogue_checks`.
- **Bascule sans reprise de données**, comme en Phase 6 : les parties existantes sont supprimées avant la migration (`game:reset --no-seed`). Le seeder de démo crée un personnage de test (Trois Mousquetaires) et sa partie.
- **Place réservée pour l'espèce (Phase 13bis)** : une étape *espèce* viendra s'insérer avant le placement, et son ajustement des caractéristiques juste après lui, avant le relèvement de SIZ et INT à 8. Le calcul pur de la fiche (aperçu et création) s'écrit donc comme une suite d'étapes où cet ajustement se glisse sans réécriture. Ni colonne ni étape d'interface avant la Phase 13bis.
- **Hors périmètre de ce lot** : conditions de fin et écrans de fin, progression, pause et reprise ; champs libres (apparence, passé) ; options de création du livre (personnalité, bonus de catégorie, âge et EDU, redistribution, 2D6+6 pour tous) ; limite du nombre de personnages par joueur.

Tranchés pendant l'implémentation du premier lot (epic `KAN-151`) :

- **4D6, les trois meilleurs gardés**, plutôt que les 3D6 du livre : méthode courante en jeu réel. Le backend désigne le dé écarté (le premier des plus faibles, sans effet sur le total) et le renvoie avec les dés (`dice: { faces, dropped }[]`), pour l'affichage seulement : seuls les totaux sont en base. Le front grise le dé écarté une fois posé.
- **Le premier tirage part d'un geste du joueur** (**Roll the dice**), pas de l'arrivée sur la page.
- **Une série relancée entre l'aperçu et la soumission** (un autre onglet) fait refuser la création (`stale_characteristic_roll`) : la création porte la série sur laquelle elle a été bâtie (`rollId`) et la consomme sous verrou. Sans série, `no_characteristic_roll`.
- **La fiche n'enregistre que les compétences qui ont reçu des points** ; les autres valent leur chance de base, calculée sur les caractéristiques à la lecture, comme depuis la Phase 6.
- **Changer de profession efface les points professionnels** du brouillon : ils allaient aux compétences de l'ancienne. Les points personnels restent.
- **Une partie ne se lance plus que depuis son personnage** (`POST /characters/:id/sessions`) : `GET /scenarios`, `GET /sessions` et `POST /sessions` disparaissent, l'accueil lit `GET /characters`.
- **L'abandon prend le verrou de la partie**, comme la soumission d'un tour (`lockOwnGame`) : un tour en attente le fait refuser (`turn_already_in_progress`), une partie close aussi (`game_ended`). Deux lancements simultanés d'un même personnage : l'index unique partiel en laisse passer un, l'autre reçoit `character_engaged`.
- **Les parties d'un personnage supprimé** sont écartées par le scope `listed` de `sessions`, au même titre qu'une partie supprimée.
- **Clés étrangères sans action** (ni cascade ni restrict) de `sessions` et `character_states` vers `characters` : supprimer un joueur emporte parties et personnages dans la même instruction, dans n'importe quel ordre.
- **Le seeder de contenu ne supprime pas une profession qu'un personnage suit** : il réécrit les autres, idempotent par référence comme le reste du contenu.
- **Pas de trace du contexte de chaque étape dans `turn_log`** : le journal n'en garde toujours que les sorties, et nom, genre et profession se relisent sur la fiche.

### Contenu

- Progression du personnage : tests d'expérience et jets d'amélioration du BRP, en fin de scénario.
- Cycle de vie complet de la partie :
  - création de personnage guidée (au-delà d'un simple formulaire technique),
  - conditions de fin de partie (victoire, mort du personnage, abandon volontaire),
  - gestion de la reprise après une pause longue (régénération du résumé avant reprise si nécessaire).

### Critère de sortie de phase

- Le personnage améliore ses compétences d'après l'expérience acquise au cours d'un scénario.
- Une partie peut être créée, mise en pause, reprise et menée jusqu'à une fin définie.

---

## Phase 13 — Règles optionnelles par univers

**Objectif** : activer, univers par univers, les règles optionnelles du BRP qui font le genre — sans toucher au moteur commun. Placée après la Phase 12, dont elle réutilise la progression (une passion s'améliore comme une compétence).

### Contenu

- **Drapeaux de règles par univers** : chaque univers déclare les règles optionnelles qu'il emploie ; un univers sans drapeau joue le BRP de base.
- **Niveau de puissance par univers** (*Normal*, *Heroic*… du livre), qui décide notamment du **calcul des points de vie du personnage** — provisoirement `CON + SIZ` pour tous depuis la Phase 10. Un mousquetaire est un héros courageux, qui encaisse ; un personnage lovecraftien doit être plus prudent et avoir peur, et revenir à `(CON + SIZ) ÷ 2`. Les autres règles optionnelles que le livre dit héroïques s'y rattachent : esquive pleine contre les tirs (*Dodging Missile Weapons*), dernier coup d'un mourant (*Dying Blows*, une fois la mort du personnage possible en Phase 12).
- **Santé mentale** (Mythe) : score de santé mentale, jet sous ce score face à l'horreur, pertes et folie temporaire tirées par le backend. L'arbitrage ou l'extraction ne fournit qu'un déclencheur en label fermé, choisi dans la liste de l'univers ; le narrateur ne reçoit qu'un état qualitatif.
- **Passions et Réputation** (Trois Mousquetaires) : honneur, loyauté, amour, renommée, comme bonus ou malus tirés par le backend, d'après un label fermé.
- **Jets cachés** : une compétence marquée cachée est jetée sans que le joueur en voie le détail, et le narrateur reçoit la consigne de taire ou d'égarer sur un échec — l'exception prévue à la règle « le joueur voit le détail de chaque jet » (Phase 6).

Pouvoirs et espèces non humaines, qui emploient les mêmes drapeaux par univers, sont séparés en Phase 13bis pour garder cette phase à sa taille.

### Critère de sortie de phase

- Le Mythe se joue avec la santé mentale, les Trois Mousquetaires avec les passions et la réputation, chaque univers n'activant que ses propres règles.

---

## Phase 13bis — Pouvoirs et espèces non humaines

**Objectif** : jouer, dans les univers qui le permettent, un personnage doté de pouvoirs ou d'une autre espèce qu'humaine (elfe, nain, orc, vampire…) — sans toucher au moteur commun. Placée après la Phase 13, dont elle réutilise les drapeaux de règles par univers et le niveau de puissance ; les pouvoirs d'abord, dont dépendent les pouvoirs innés d'une espèce.

### Contenu

- **Pouvoirs** (magie, sorcellerie, psychisme ; chapitre *Powers* du livre), chaque type activé par son drapeau d'univers :
  - **points de pouvoir** du personnage, dérivés de `POW` et tenus par le backend (dépense, régénération), jamais par le LLM ;
  - **catalogue de pouvoirs en liste fermée**, au niveau de l'univers ou d'un scénario qui le surcharge, comme les autres catalogues ; le personnage ne connaît que ceux de sa fiche ;
  - l'arbitrage désigne le pouvoir employé et sa cible par leurs références ; le backend vérifie qu'il est connu et payable, jette, dépense et applique l'**effet, choisi dans une liste fermée** et appliqué par les services existants (dégâts, soins, modificateur, passage…) ; le narrateur ne reçoit que le résultat et le degré ;
  - un pouvoir dirigé contre un être qui y résiste passe par la **table de résistance** (points de pouvoir contre points de pouvoir) : posée ici si le lot des jets opposés ne l'a pas fait avant. La magie se joue comme une compétence (un sort = une compétence en pourcentage) ; la sorcellerie, presque sans jet, repose entièrement sur la résistance et tient ses sorts en mémoire ou au grimoire — un état de plus sur la fiche.
  - Mutations et super-pouvoirs, du même chapitre, restent hors périmètre.
- **Espèces jouables** (option *Non-human Characters* du livre ; profils du chapitre *Creatures*) :
  - **catalogue d'espèces** (`species_definitions`) au niveau de l'univers, surchargé par un scénario, comme les autres catalogues : référence immuable, libellés par langue, `playable`, niveau de puissance minimal de l'univers. Un univers sans espèce ne joue que des humains, et la création n'en montre pas l'étape ;
  - **la fiche porte son espèce** (`characters.species`), choisie à la création, pour toujours ;
  - **caractéristiques : un ajustement fixe après le placement** (nain `STR +3`, `CON +6`, `SIZ −4`…), avec plancher et plafond — le tirage et le placement humains de la Phase 12 ne changent pas (le livre applique ses modificateurs culturels *afterwards*). L'espèce peut aussi ajuster quelques compétences (chance de base, compétence offerte comme une langue) ;
  - **traits en liste fermée**, rangés selon ce qui les porte, jamais inventés par le LLM :
    - *modificateur permanent* (bonus d'un nain en Évaluation) : lu et chiffré par le backend, comme un modificateur d'objet ;
    - *fait qui change le possible* (vision dans le noir, pas de reflet, n'entre pas sans invitation, ne franchit pas l'eau courante) : **fragments de lore tagués par la référence de l'espèce** — l'espèce du personnage compte parmi les tags de la scène ; `rule` pour l'arbitrage, `ambiance` pour la narration ;
    - *pouvoir inné* (regard hypnotique, forme de brume) : un pouvoir du catalogue, accordé par l'espèce ;
    - *effet que le monde applique seul* (vampire : dégâts au soleil, régénération par round, pieu) : nouveaux effets et conditions évalués par le backend — exigent un attribut intérieur / extérieur des lieux et un effet par round dans `playRound` ;
  - **ce que voient les étapes** : l'arbitrage, l'espèce et ses traits (en anglais) ; la narration, l'espèce traduite — les PNJ réagissent à un orc ou à un vampire ; l'extraction, rien ; le front, l'espèce et ses traits libellés sur la fiche ;
  - **en deux lots** : d'abord les espèces que portent modificateurs, lore et pouvoirs innés (elfe, nain, orc), puis les effets appliqués par le monde (vampire). D'ici là, les faiblesses d'un vampire passent par le lore : l'arbitrage refuse ou pénalise ;
  - plus tard, une définition de PNJ pourra désigner une espèce pour en hériter les traits — hors périmètre.
- **Front** : points de pouvoir, pouvoirs connus, espèce et traits sur la fiche ; étape *espèce* dans la création. **Back-office** : onglets *Pouvoirs* et *Espèces*, import JSON ; ce que les validateurs ne voient pas (trait, pouvoir ou compétence qui n'existe pas dans l'univers) se refuse dans `catalogue_checks`.

### Critère de sortie de phase

- Un univers à pouvoirs (démonstration à choisir à l'ouverture de la phase) se joue avec ses sorts, et un univers sans drapeau n'en voit aucun.
- Un joueur crée et joue un elfe, un nain et un orc dans un univers qui les permet ; un univers sans espèce ne montre aucun choix.

---

## Phase 14 — Production-ready

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

### À trancher à l'ouverture de la phase

- **Nom affiché d'un objet improvisé.** Le front n'affiche que le libellé de l'archétype (« Outil », « Babiole »), le descripteur anglais restant réservé au narrateur (architecture, section 6bis) : une lampe torche et un trousseau de clés s'affichent tous deux « Outil », alors que le narrateur, qui lit les descripteurs, les nomme précisément. Relevé le 2026-10-31. Trois pistes :
  1. enrichir les archétypes du contenu (lanterne, clé…), sans toucher aux règles — l'improvisé pur reste générique ;
  2. **un nom court par objet, écrit par l'extraction dans la langue de la partie**, sur le modèle de `npc_names`, stocké sur l'instance et envoyé au front à la place du libellé de l'archétype quand il existe ;
  3. afficher le descripteur anglais tel quel — exclu par la section 6bis dans une partie qui n'est pas en anglais.

  **Préférence pour la piste 2**, à confirmer avec le choix de la langue : précise partout, sans appel supplémentaire. Elle crée une exception à la convention « seule la narration produit du texte dans la langue du joueur » (l'extraction ne lit et n'écrit que l'anglais) ; elle demande une colonne sur `inventory_items`, un champ de sortie de l'extraction validé par le backend (longueur, présence de l'objet), et un changement de l'API de l'inventaire.

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
| 7–8 | Jet en direct et préférences (lot d'interface, sans API) ; ce que le personnage sait | — |
| 8 | Lore étendu et RAG | — |
| 9 | Mémoire long terme | — |
| 10 | Combat | — |
| 11 | Échéances et événements déclenchés par le temps | — |
| 12 | Progression du personnage, cycle de vie complet de la partie | — |
| 13 | Règles optionnelles par univers | — |
| 13bis | Pouvoirs et espèces non humaines | — |
| 14 | Production-ready | — |

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
| 5 | Contrôle d'accès par rôle, route par route — rend continu l'audit prévu en Phase 14 |
| 6 | Moteur BRP : bornes 01–05 et 96–00, seuils des degrés, difficulté multiplicative, ordre des modificateurs, jets de caractéristique, formule de dégâts sur dés simulés ; le narrateur ne reçoit jamais le détail du jet |
| 7 | Horloge de jeu : conversion des labels de durée, bornes, attente jusqu'à une période, période dérivée de l'heure, jour et date ; sorties : destinations atteignables, passages cachés et verrouillés, refus d'une destination hors liste, durée d'un chemin, passage trouvé et franchi dans le même tour, porte ouverte par sa clé ; PNJ laissé, suivant, parti, retrouvé ; cohérence d'un réseau (`checkScenario`) ; le joueur ne reçoit que la période |
| 8 | Qualité de récupération du lore : sur un jeu annoté, les bons fragments remontent-ils, et avec quel bruit |
| 9 | Le résumé ne perd pas les faits critiques (eval, pas test) |
| 10 | Moteur de combat sur dés simulés : chaque ligne de la matrice attaque / défense, choix de la meilleure défense, empalement et écrasement, seuils des blessures, maladresses et leurs replis, premiers soins par degré, paliers de guérison. Round dans le tour : attaque et riposte, jets de PNJ jamais envoyés, cible improvisée instanciée sous son handle, mourant mort au tour suivant ou sauvé par les premiers soins, personnage jamais tué, 12 secondes ; validation de l'engagement (adversaire hors liste, attaque sans jet, premiers soins en plein combat) ; l'extraction ne soigne plus ; migration réversible, blessures conservées. Front : révélation de deux jets à la suite |
| 11 | Événements purs : chaque condition, échéance à son moment, délai une fois armé, `unless` qui annule, ordre de l'horloge, événement réglé qui ne retombe pas, témoin, événements prévisibles, instant attendu. Emplois du temps purs : entrée de la période, dernière entrée d'un PNJ pas encore rencontré, arrivées et départs dans une fenêtre. Dans le tour : effets appliqués, chaîne bornée et reportée, interruption par un événement vu ou une arrivée, attente atteinte ou manquée sous le plafond, événement lointain jamais raconté, événement d'état raconté au tour suivant une fois, effet en attente d'une première visite ou rencontre, passage bloqué par période ou par événement ; cohérence (`checkScenario` : flags, chevauchements, cycles) ; flags en liste fermée ; lieu improvisé jamais rattaché à une pièce d'un réseau |
| 14 | Evals automatisés, détection de dérive de prompt, taux d'échec de schéma |

Chaque **critère de sortie de phase** fait par ailleurs un bon test d'acceptation de bout en
bout : un par phase suffit.

### Le corpus d'évaluation s'accumule dès la Phase 1

`turn_log` enregistre l'entrée joueur, les sorties intermédiaires et la narration finale : c'est
déjà le jeu de données d'évaluation. Les evals sont prévus en Phase 14, mais le **corpus** se
constitue dès la Phase 1, en sélectionnant au fil de l'eau les tours intéressants — cas limites,
échecs, comportements aberrants. Sans cette accumulation, la Phase 14 commencerait par plusieurs
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
- **Retry/fallback LLM** : pas de retry automatique des erreurs de transport. Depuis la Phase 3, une sortie structurée rejetée par la validation backend a droit à **une** nouvelle tentative avec message correctif, puis le tour échoue (voir Phase 3). Chaque erreur est renvoyée au front avec un message spécifique selon le type détecté. Un système de log d'erreurs API structuré est prévu en todolist, à traiter en Phase 14.
- **Modificateurs contextuels vs modificateurs d'objets** : séparation stricte actée — le LLM ne propose que des modificateurs contextuels, en labels qualitatifs convertis par le backend (3 au plus), les modificateurs d'objets sont toujours calculés par le backend à partir des objets du détenteur.
- **Un compte = un rôle unique** pour l'instant (`player` / `game_master` / `superadmin`), pas de cumul multi-rôle. À réévaluer si le besoin se présente concrètement.
- **Budget de développement** : hébergement léger (ex. Vercel, Supabase, Railway) et LLM économique (ex. Gemini) pour la phase de test, budget cadré à 15-20€ mensuels — voir Phase 0.
- **Démarche de monétisation** : aucun modèle choisi à ce stade, mais une démarche en deux temps est actée — mesure du coût réel par tour/partie dès la Phase 3, puis validation de l'appétence des joueurs lors du beta test fermé prévu en Phase 14 — avant toute sélection de modèle économique.
- **Convention de nommage** : tables, colonnes, enums et code exclusivement en anglais ; langue par défaut de l'application en anglais, support multi-langue en complément.
- **Architecture multi-langue** : « tout en anglais en interne, traduction au dernier moment ». Le lore, le scénario, le state, les system prompts et le résumé narratif restent en anglais et ne sont jamais dupliqués par langue ; seule l'étape de narration produit du texte dans la langue du joueur. Pas de second appel de traduction, pas de détection si le joueur écrit dans une autre langue. Un glossaire compact de noms propres assure la cohérence des noms. Voir document d'architecture, section 4bis.
- **Objets** : définitions et instances ; séparation entre référence stable anglaise et nom d'affichage ; trois détenteurs possibles (personnage, PNJ, lieu) ; catalogue fermé ; l'étape d'extraction ne peut faire apparaître qu'un objet figurant dans la liste transmise, ni déplacer un objet hors scène. Voir document d'architecture, section 6bis.
- **Exécution asynchrone et contrat d'API front/backend** : pipeline exécuté en tâche de fond via une file de jobs derrière un port — pg-boss (PostgreSQL) en instance unique, BullMQ (Redis) au passage à plusieurs instances —, retour progressif au front via AdonisJS Transmit (SSE) — introduit dès la Phase 2, pas différé à la Phase 14. Voir document d'architecture, section 8bis, pour le détail des événements.
- **Environnement technique** : dev et tests locaux sous Docker (PostgreSQL ; Redis provisionné pour la bascule vers BullMQ), repo structuré en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend` et `frontend` dès la Phase 0, et `back-office` ajouté en Phase 5.
- **Authentification** : le scaffolding register/login inclus par défaut dans un projet AdonisJS est réutilisé comme base pour l'authentification joueur (Phase 2), plutôt que de construire ce système from scratch — seul le champ `role` (enum `player`/`game_master`/`superadmin`) est une extension propre au projet. Le front s'authentifie par **cookie de session**, seul mode compatible sans contournement avec `EventSource`.
- **Front** : Vite + React, Tailwind CSS, TanStack Router (TanStack Query envisagé pour les lectures).
- **Soumission d'un tour** : clé d'idempotence fournie par le client, enregistrée avant la mise en file ; tours exécutés par un worker unique en `concurrency: 1`, dans le process HTTP, pour la Phase 2 (voir Phase 2, décisions de cadrage).

---

## Points ouverts pour les phases avancées

- Modalités précises de l'inscription self-service (Phase 14) : validation d'email, gestion des mots de passe oubliés, éventuelle authentification via fournisseur tiers.
- Décision sur la nécessité future d'un cumul de rôles (un MJ qui voudrait aussi jouer).
- Nom d'un objet unique avant qu'il soit identifié (« The office key », le Necronomicon) : le narrateur et le front le nomment d'emblée, comme un PNJ inconnu avant la connaissance des noms (lot entre les Phases 7 et 8).
- Carte des lieux visités dans le front joueur, si le besoin se confirme après la Phase 7 (qui n'affiche pas les sorties).
- Choix définitif entre pgvector intégré et vector store externe si la Phase 8 est activée (dépend du volume de lore réellement atteint).
- Réintroduction éventuelle d'un retry automatique limité (Phase 14), une fois le comportement réel des erreurs observé en usage — restreint aux erreurs transitoires (timeout, 5xx). Les sorties rejetées ont leur nouvelle tentative unique depuis la Phase 3 ; un taux de rejet élevé reste le signe d'un prompt à corriger plutôt qu'à retenter.
- Support multi-langue : l'architecture est actée et répercutée dans les phases ci-dessus (paramètre `language` et colonne `turn_log.language` en Phase 1, séparation référence/affichage en Phase 4, catalogue et glossaire en Phase 5, résumé anglais en Phase 9). L'i18n du front est posée dès la Phase 2, avec l'anglais seul. Une langue par défaut se fixe par déploiement : `DEFAULT_LANGUAGE` pour la narration (backend), `VITE_DEFAULT_LANGUAGE` pour l'interface, qui retombe sur l'anglais faute de traductions. **Restent ouverts** : la liste des langues cibles, et la phase à laquelle une seconde langue est effectivement activée — probablement pas avant que la Phase 5 rende le contenu paramétrable.
- Événements SSE : la granularité et le rattrapage par lecture du tour sont tranchés pour la Phase 2 (architecture, section 8bis). Le streaming de la narration est tranché pour la Phase 3 (voir ses décisions de cadrage). **Reste ouvert** le rejeu des événements manqués, jugé inutile tant que la lecture du tour suffit.
- Passage à plusieurs instances : bascule de la file de pg-boss vers BullMQ, worker séparé (transport Redis de Transmit) et sérialisation par verrou PostgreSQL sur `session_id` plutôt que par `concurrency: 1` — à trancher avant le beta test de la Phase 14.
