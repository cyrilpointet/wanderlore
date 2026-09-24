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

- Squelette applicatif AdonisJS créé avec `--kit=api`, en **monorepo géré par Turborepo (workspaces)**. Structure par défaut : package `backend` (API AdonisJS) et package `frontend` (front joueur). Un troisième package `back-office` sera ajouté en Phase 5bis pour l'interface superadmin — la structure en workspaces permet cet ajout sans réorganisation du repo.
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
- **Résolution simplifiée à un seul type de jet** : `2d6 + valeur de compétence` contre un seuil unique. Pas de distinction combat / social / autre à ce stade — uniquement "jet requis" ou "pas de jet".
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
- Gestion d'erreur conforme à la décision prise pour le projet : **pas de retry automatique**. Une erreur est renvoyée avec un message spécifique selon le type détecté (timeout, sortie hors schéma, erreur HTTP de l'API externe, échec de validation backend). Un système de log d'erreurs structuré est explicitement différé (voir Phase 9 / todolist).
- Pas encore de front : validation du pipeline via des requêtes directes (Postman, curl, ou équivalent).

### Critère de sortie de phase

- Un tour de jeu complet est exécutable de bout en bout dans un univers connu, avec mise à jour effective de `world_states` et retour d'une narration cohérente.
- Les erreurs du pipeline renvoient un message différencié selon leur nature.

---

## Phase 2 — Front minimal

**Objectif** : rendre le pipeline de la Phase 1 accessible via une interface web basique, avec authentification joueur.

### Décisions de cadrage

Tranchées à l'ouverture de la phase, avant toute implémentation :

- **Stack front** : Vite + React, Tailwind CSS, TanStack Router. TanStack Query envisagé pour les lectures (partie, personnage, historique), à confirmer à l'usage. Pas de bibliothèque d'internationalisation à ce stade — l'interface est en anglais — mais les libellés restent regroupés pour ne pas compliquer son introduction.
- **Authentification par cookie de session** (guard `web`, déjà configuré dans le scaffolding) plutôt que par access token. Motif : le flux SSE repose sur `EventSource`, qui ne peut pas porter d'en-tête `Authorization` mais envoie nativement les cookies. En développement, le serveur Vite proxifie l'API : front et backend partagent la même origine, sans configuration CORS avec credentials. Contrepartie : l'authentification par cookie expose au CSRF — la protection de `@adonisjs/shield`, aujourd'hui désactivée, est à activer.
- **File de jobs derrière un port, servie par pg-boss.** La file est un service substituable (port, adaptateur choisi dans la configuration), comme le LLM Gateway. **pg-boss** stocke ses jobs dans PostgreSQL : aucun Redis à héberger tant qu'il n'y a qu'une instance, et l'hébergement léger de la phase de test n'a qu'une base à fournir. **BullMQ reste la cible** du passage à plusieurs instances, qui ramène de toute façon Redis pour le transport de Transmit : la bascule se fera en écrivant l'adaptateur BullMQ et en changeant la configuration, file vidée. Contrepartie acceptée : pg-boss interroge la base à intervalle régulier au lieu d'être notifié ; l'intervalle est réglé explicitement pour ne pas retarder visiblement le début du tour.
- **Rien de ce qui garantit l'intégrité d'un tour ne dépend de la file** — c'est la condition d'une bascule simple :
  - le job ne transporte que l'identifiant du tour, tout l'état est lu en base ;
  - l'idempotence vit dans `turn_log`, jamais dans la déduplication propre à l'outil ;
  - la sérialisation des tours relève de `concurrency: 1`, puis d'un verrou PostgreSQL par `session_id` — jamais d'une fonctionnalité de file ;
  - les événements SSE sont émis par le code du tour via Transmit, jamais dérivés des événements de la file ;
  - aucune logique ne repose sur la mise en file dans la même transaction que l'écriture du tour (pg-boss le permet, BullMQ non). Un tour resté `pending` au-delà d'un délai — process arrêté en cours de tour, mise en file échouée — est passé en échec.
- **Worker dans le process HTTP**, démarré au boot du serveur web (pas en environnement de test ni de console). C'est l'option la plus simple : un seul process à lancer, et Transmit diffuse en mémoire sans transport Redis — l'événement émis par le job atteint directement les connexions SSE du même process. **Limite assumée** : ne passe pas à plusieurs instances. Un worker séparé imposera le transport Redis de Transmit ; à reprendre au plus tard en Phase 9.
- **Pas de retry de la file** (`retryLimit: 0` avec pg-boss, `attempts: 1` avec BullMQ), conformément à la décision projet sur les erreurs LLM.
- **Clé d'idempotence fournie par le client** pour la protection contre les doubles soumissions (voir ci-dessous).
- **Événements SSE limités aux jalons**, sans streaming de la narration (voir document d'architecture, section 8bis).

### Contenu

- Interface de chat : historique de messages + champ de saisie.
- Affichage en lecture seule des statistiques du personnage (points de vie, compétences). Pas d'inventaire à ce stade (aucun objet n'existe encore dans le système).
- **Routes de lecture** nécessaires au front : liste des parties du joueur, détail d'une partie (personnage, historique des tours pour le chat), lecture d'un tour. Cette dernière sert aussi de rattrapage quand le flux SSE a été manqué ou coupé.
- **Exécution asynchrone du pipeline via la file de jobs (pg-boss), avec retour progressif via AdonisJS Transmit (SSE)** : le front soumet l'action du joueur, reçoit un accusé de réception (`202`), puis affiche des messages d'attente contextuels au fil des événements reçus (étape en cours, jet résolu) jusqu'au résultat final du tour. Voir document d'architecture, section 8bis, pour le contrat d'événements. Ce choix remplace l'hypothèse initiale d'une réponse synchrone simple, dès cette phase plutôt qu'en Phase 9.
- **Sérialisation des tours par partie** — point non négociable, découvert en Phase 1 : un tour passe plusieurs secondes en attente du LLM entre la lecture du dernier numéro de tour et son écriture. Deux soumissions rapprochées calculent donc le même numéro. **Un seul joueur qui envoie deux fois suffit** : ce n'est pas un problème de multi-joueur. La contrainte d'unicité `(session_id, turn_number)` le rattrape et doit être conservée comme dernier filet, mais elle n'est pas une solution.
  - La file **ne règle pas ce point par sa seule présence** : sa concurrence se paramètre par worker, pas par clé (BullMQ ne sérialise par clé qu'avec les *groups* de sa version Pro, payante). Les pistes générales sont un verrou par `session_id` autour du job — en PostgreSQL, pour rester indépendant de la file — ou une file par partie (ingérable).
  - **Retenu pour cette phase : un worker unique en `concurrency: 1`.** Les tours s'exécutent strictement l'un après l'autre, chacun lisant l'état laissé par le précédent : la course sur le numéro de tour disparaît. Le prix — un débit plafonné toutes parties confondues — est sans effet tant qu'un seul joueur teste. **À reprendre avant le beta test** (Phase 9), avec un verrou PostgreSQL par `session_id`.
  - **La mise en file ne suffit pas non plus** : deux jobs valides produiraient deux tours de jeu là où le joueur en voulait un, chacun facturé — une erreur bruyante remplacée par un état de jeu faux. **Retenu : une clé d'idempotence fournie par le client** avec chaque soumission.
    - Une clé identifie **une soumission**, pas un texte : le client en génère une par action envoyée, et la réutilise telle quelle s'il renvoie la même requête (double clic, perte réseau avant l'accusé de réception). Le backend qui reçoit une clé déjà connue renvoie l'accusé du tour existant sans remettre de job en file.
    - La clé est enregistrée **au moment de la soumission**, avant la mise en file — un enregistrement en fin de tour laisserait passer le doublon pendant toute la durée des appels LLM. Elle est aussi conservée dans `turn_log`, sous contrainte d'unicité par partie.
    - Le **numéro de tour est attribué quand le tour aboutit**, dans la transaction qui applique ses effets (KAN-17). Un tour `pending` ou `failed` n'en a pas : la numérotation reste celle de l'histoire, sans trou, et la contrainte `(session_id, turn_number)` continue d'attraper deux tours concurrents — le perdant passe `failed`. Un tour se désigne donc par son identifiant, jamais par son numéro.
    - Le bouton de nouvelle tentative après un `turn_failed` est une **nouvelle** soumission, donc une nouvelle clé : réutiliser l'ancienne renverrait le tour échoué.
    - Désactiver le bouton côté front reste une commodité d'ergonomie, pas une protection.
- Gestion d'erreur côté front : affichage du message spécifique renvoyé par le backend (via l'événement `turn_failed` ou en cas d'échec de soumission), avec un bouton de nouvelle tentative qui réutilise l'input déjà saisi (le joueur ne doit jamais avoir à retaper son texte après une erreur).
- **Authentification joueur simple** : connexion par identifiant/mot de passe, par cookie de session (voir décisions de cadrage), en s'appuyant sur le système register/login inclus par défaut dans le scaffolding AdonisJS posé en Phase 0 — pas de système d'authentification à construire from scratch. Un seul rôle actif à ce stade (`player`) — pas de distinction fonctionnelle par rôle côté front.
- `sessions.user_id` est une relation vers un compte authentifié réel — déjà en place depuis la Phase 0 (clé étrangère vers `users`), et la Phase 1 cherche déjà la partie parmi celles du joueur connecté.
- Pas d'inscription libre nécessaire à ce stade : un compte peut encore être créé manuellement en base.

### Critère de sortie de phase

- Un joueur authentifié peut jouer un tour complet depuis l'interface web, avec affichage correct de l'état de son personnage, retour progressif via SSE pendant l'exécution du tour, et gestion visible des erreurs.

---

## Phase 3 — Retour au pipeline complet, séparation des étapes

**Objectif** : remplacer l'appel fusionné de la Phase 1 par le pipeline complet tel que défini dans le document d'architecture, une fois la boucle de base validée en usage réel.

### Contenu

- Séparation effective des étapes :
  - Appel A+B+C (interprétation, validation, résolution) — sortie structurée.
  - Calcul du jet en étape backend déterministe isolée, avec traçabilité complète (`applied_modifiers`) enregistrée dans `turn_log`.
  - Appel D (narration) — texte libre.
  - Appel E (extraction des effets) — sortie structurée, validée avant application au state.
- Cette séparation permet notamment d'utiliser un modèle LLM différent (potentiellement moins coûteux) pour l'extraction que pour la narration.
- Introduction de la table `resolution_rules` en base — encore limitée à un seul univers, mais structurée proprement plutôt qu'écrite en dur dans le prompt. Premier pas vers la généricité multi-univers.

### Critère de sortie de phase

- Le pipeline complet en 5 étapes (A+B+C, calcul de jet, D, E, validation/persistance) fonctionne de bout en bout, avec un `turn_log` détaillé par étape.
- **Étape 1 de la démarche budget/monétisation réalisable** : le tracking de consommation mis en place en Phase 1 permet, à partir de cette phase, de mesurer un coût moyen réel par tour et par partie (voir document de synthèse, section budget) — première donnée chiffrée disponible pour instruire une future réflexion sur un modèle de revenu.

---

## Phase 4 — Inventaire et modificateurs d'objets

**Objectif** : introduire la gestion d'objets et leur impact mécanique sur les jets, conformément au document de référence sur le système de règles.

### Contenu

- Table `inventory_items`, avec le champ `mechanical_effects` structuré tel que défini dans le document de base de données (modificateurs avec `target_skill`, `value`, `condition` — `owned` ou `equipped`).
- **Séparation `item_reference` / `display_names` dès la création de la table.** La référence stable anglaise est l'identité de l'objet pour le code et le LLM ; les noms d'affichage par langue sont ce que voit le joueur. C'est le point à ne pas différer : le rattraper plus tard voudrait dire migrer des données de parties déjà jouées.
- **L'étape d'extraction reçoit une liste fermée de références autorisées** et ne peut pas inventer d'objet. Un objet inventé n'aurait ni effets mécaniques, ni référence, ni traduction.
- Calcul des modificateurs d'objets **exclusivement côté backend**, au moment du calcul du jet — jamais proposés ou chiffrés par le LLM. Le rapprochement se fait via `item_reference`, jamais via un nom d'affichage.
- Distinction effective, dans le résultat de jet et dans `turn_log`, entre modificateurs contextuels (source : LLM) et modificateurs d'objets (source : backend).
- Extension du front pour afficher l'inventaire du personnage (lecture seule), avec les noms d'affichage résolus côté backend dans la langue de la partie.

> **Note de séquencement** : le catalogue d'objets par scénario (`scenarios.item_catalog`) n'arrive qu'en Phase 5, avec la table `scenarios`. En Phase 4, la liste fermée des références autorisées peut rester rudimentaire — l'important est que la séparation référence/affichage et le principe de liste fermée soient posés dès maintenant.

### Critère de sortie de phase

- Un objet possédé ou équipé influence correctement un jet, avec traçabilité claire de l'origine du bonus/malus appliqué.
- L'étape d'extraction ne peut pas faire apparaître un objet absent de la liste transmise.

---

## Phase 5 — Généricité multi-univers et back-office minimal

**Objectif** : sortir du cadre d'un univers unique codé en dur, et permettre la création de nouveaux univers/scénarios via une interface dédiée. Introduction du rôle `game_master`.

### Contenu applicatif

- Tables `worlds` et `scenarios` en base, avec attributs et compétences paramétrables par univers, conformément au document de référence sur le système de règles.
- **`scenarios.item_catalog`** : catalogue fermé des objets acquérables (référence stable, effets mécaniques, noms d'affichage par langue), qui devient la source de vérité alimentant la liste transmise à l'étape d'extraction (posée en Phase 4).
- **`scenarios.glossary`** : noms propres (lieux, PNJ, factions) et leurs traductions, injectés à la seule étape de narration pour figer la cohérence des noms d'un tour à l'autre. Voir document d'architecture, section 4bis.
- **Création du troisième package du monorepo, `back-office`** (aux côtés de `backend` et `frontend` posés en Phase 0) : formulaires CRUD basiques pour créer/éditer un univers (nom, ton narratif, attributs, compétences, règles générales) et un scénario (synopsis, structure de chapitres, catalogue d'objets, glossaire). Pas d'assistance LLM à la création, pas d'import de fichiers à ce stade.
- Possibilité, à partir de cette phase, de basculer vers un univers original si une diffusion plus large est envisagée (voir point de vigilance en introduction).

### Contenu lié à la gestion de comptes

- **Introduction du rôle `game_master`**, actif pour la première fois à cette phase — c'est le rôle qui utilise le back-office.
- Middleware de contrôle d'accès par rôle : un compte `player` ne peut pas accéder aux routes de back-office ; un compte `game_master` ne peut pas créer de partie en tant que joueur (sauf décision contraire ultérieure).
- Ajout d'un champ `created_by` (FK vers `users`) sur `worlds` et `scenarios`, pour tracer la propriété du contenu dès qu'il existe plusieurs comptes MJ — sans encore restreindre l'édition entre MJ à ce stade (tout MJ peut éditer tout contenu).

### Critère de sortie de phase

- Un compte `game_master` peut créer un univers et un scénario complets depuis le back-office, jouables ensuite par un compte `player`.
- Le contrôle d'accès par rôle empêche un `player` d'accéder au back-office.

---

## Phase 5bis — Gestion des comptes (rôle superadmin)

**Objectif** : permettre l'administration des comptes eux-mêmes, une fois qu'il existe réellement plusieurs types de comptes à gérer. Cette phase est volontairement positionnée après la Phase 5 : introduire le rôle `superadmin` plus tôt n'aurait rien de concret à administrer.

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

## Phase 6 — Lore étendu et RAG

**Objectif** : dépasser les limites de la connaissance native du LLM sur un univers, ou construire un lore original détaillé.

### Contenu

- Pertinent uniquement dans deux cas : un univers original créé pour le produit, ou l'approfondissement d'un univers connu au-delà de ce que le LLM sait déjà nativement.
- Introduction de la table `lore_fragments`.
- Mécanisme de filtrage : **approche par tags à privilégier pour démarrer** (simple, prévisible, auditable), conformément à la recommandation du document d'architecture. Le passage à une recherche par similarité (embeddings, pgvector ou vector store externe) n'est envisagé que si le volume de lore le justifie réellement.

### Critère de sortie de phase

- Le contexte transmis aux étapes LLM concernées (arbitrage, narration) inclut des fragments de lore correctement filtrés par tags, pour un univers dont le contenu dépasse la connaissance native du modèle.

---

## Phase 7 — Mémoire long terme

**Objectif** : permettre à une partie de durer au-delà de ce qu'un buffer de tours bruts peut raisonnablement couvrir.

### Contenu

- Table `narrative_summaries`, avec granularité hiérarchique (scene / chapter / global) telle que définie dans le document de base de données.
- Job asynchrone de régénération périodique du résumé, hors du chemin critique de réponse au joueur.
- **Le résumé est rédigé en anglais**, quelle que soit la langue de la partie : le job étant asynchrone, il peut condenser une narration française en résumé anglais sans coût de latence perçu. C'est la principale économie de jetons du dispositif multi-langue, puisque le résumé est réinjecté à chaque tour (voir architecture, section 4bis).
- **Différenciation de l'injection du buffer** : le buffer récent, dans la langue du joueur, n'est transmis qu'à l'étape de narration. L'arbitrage se contente du résumé anglais et du state structuré.
- Utile principalement lorsque les parties commencent à dépasser en pratique la fenêtre de contexte raisonnable en buffer brut — à activer selon l'usage observé, pas nécessairement dès l'ouverture de cette phase.

### Critère de sortie de phase

- Une partie longue reste cohérente narrativement sans dépendre uniquement du buffer de tours récents.

---

## Phase 8 — Combat étendu et cycle de vie complet

**Objectif** : compléter les mécaniques de jeu et le cycle de vie d'une partie.

### Contenu

- Combat modélisé comme séquence de jets alternés joueur/PNJ, conformément au modèle générique déjà défini dans le système de règles — cette phase implémente concrètement la boucle round par round, le modèle mécanique sous-jacent existant déjà depuis la Phase 3/4.
- Cycle de vie complet de la partie :
  - création de personnage guidée (au-delà d'un simple formulaire technique),
  - conditions de fin de partie (victoire, mort du personnage, abandon volontaire),
  - gestion de la reprise après une pause longue (régénération du résumé avant reprise si nécessaire).

### Critère de sortie de phase

- Un combat complet est jouable de bout en bout avec plusieurs rounds.
- Une partie peut être créée, mise en pause, reprise et menée jusqu'à une fin définie.

---

## Phase 9 — Production-ready

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
| 6 | Lore étendu et RAG | — |
| 7 | Mémoire long terme | — |
| 8 | Combat étendu, cycle de vie complet | — |
| 9 | Production-ready | — |

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
| 4 | Séparation des deux familles de modificateurs, conditions `owned`/`equipped`, traçabilité de l'origine, refus d'un identifiant d'objet hors liste |
| 5 | Contrôle d'accès par rôle, route par route — rend continu l'audit prévu en Phase 9 |
| 6 | Qualité de récupération du lore : sur un jeu annoté, les bons fragments remontent-ils, et avec quel bruit |
| 7 | Le résumé ne perd pas les faits critiques (eval, pas test) |
| 9 | Evals automatisés, détection de dérive de prompt, taux d'échec de schéma |

Chaque **critère de sortie de phase** fait par ailleurs un bon test d'acceptation de bout en
bout : un par phase suffit.

### Le corpus d'évaluation s'accumule dès la Phase 1

`turn_log` enregistre l'entrée joueur, les sorties intermédiaires et la narration finale : c'est
déjà le jeu de données d'évaluation. Les evals sont prévus en Phase 9, mais le **corpus** se
constitue dès la Phase 1, en sélectionnant au fil de l'eau les tours intéressants — cas limites,
échecs, comportements aberrants. Sans cette accumulation, la Phase 9 commencerait par plusieurs
jours de collecte.

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
- **Retry/fallback LLM** : pas de retry automatique dans un premier temps. Chaque erreur est renvoyée au front avec un message spécifique selon le type détecté. Un système de log d'erreurs API structuré est prévu en todolist, à traiter en Phase 9.
- **Modificateurs contextuels vs modificateurs d'objets** : séparation stricte actée — le LLM ne propose que des modificateurs contextuels (plafonnés à 2-3), les modificateurs d'objets sont toujours calculés par le backend à partir de l'inventaire.
- **Un compte = un rôle unique** pour l'instant (`player` / `game_master` / `superadmin`), pas de cumul multi-rôle. À réévaluer si le besoin se présente concrètement.
- **Budget de développement** : hébergement léger (ex. Vercel, Supabase, Railway) et LLM économique (ex. Gemini) pour la phase de test, budget cadré à 15-20€ mensuels — voir Phase 0.
- **Démarche de monétisation** : aucun modèle choisi à ce stade, mais une démarche en deux temps est actée — mesure du coût réel par tour/partie dès la Phase 3, puis validation de l'appétence des joueurs lors du beta test fermé prévu en Phase 9 — avant toute sélection de modèle économique.
- **Convention de nommage** : tables, colonnes, enums et code exclusivement en anglais ; langue par défaut de l'application en anglais, support multi-langue en complément.
- **Architecture multi-langue** : « tout en anglais en interne, traduction au dernier moment ». Le lore, le scénario, le state, les system prompts et le résumé narratif restent en anglais et ne sont jamais dupliqués par langue ; seule l'étape de narration produit du texte dans la langue du joueur. Pas de second appel de traduction, pas de détection si le joueur écrit dans une autre langue. Un glossaire compact de noms propres assure la cohérence des noms. Voir document d'architecture, section 4bis.
- **Objets** : séparation entre référence stable anglaise (`item_reference`) et noms d'affichage par langue ; catalogue fermé par scénario ; l'étape d'extraction ne peut accorder qu'un objet figurant dans la liste transmise. Voir document d'architecture, section 6bis.
- **Exécution asynchrone et contrat d'API front/backend** : pipeline exécuté en tâche de fond via une file de jobs derrière un port — pg-boss (PostgreSQL) en instance unique, BullMQ (Redis) au passage à plusieurs instances —, retour progressif au front via AdonisJS Transmit (SSE) — introduit dès la Phase 2, pas différé à la Phase 9. Voir document d'architecture, section 8bis, pour le détail des événements.
- **Environnement technique** : dev et tests locaux sous Docker (PostgreSQL ; Redis provisionné pour la bascule vers BullMQ), repo structuré en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend` et `frontend` dès la Phase 0, et `back-office` ajouté en Phase 5.
- **Authentification** : le scaffolding register/login inclus par défaut dans un projet AdonisJS est réutilisé comme base pour l'authentification joueur (Phase 2), plutôt que de construire ce système from scratch — seul le champ `role` (enum `player`/`game_master`/`superadmin`) est une extension propre au projet. Le front s'authentifie par **cookie de session**, seul mode compatible sans contournement avec `EventSource`.
- **Front** : Vite + React, Tailwind CSS, TanStack Router (TanStack Query envisagé pour les lectures).
- **Soumission d'un tour** : clé d'idempotence fournie par le client, enregistrée avant la mise en file ; tours exécutés par un worker unique en `concurrency: 1`, dans le process HTTP, pour la Phase 2 (voir Phase 2, décisions de cadrage).

---

## Points ouverts pour les phases avancées

- Modalités précises de l'inscription self-service (Phase 9) : validation d'email, gestion des mots de passe oubliés, éventuelle authentification via fournisseur tiers.
- Décision sur la nécessité future d'un cumul de rôles (un MJ qui voudrait aussi jouer).
- Choix définitif entre pgvector intégré et vector store externe si la Phase 6 est activée (dépend du volume de lore réellement atteint).
- Réintroduction éventuelle d'un retry automatique limité (Phase 9), une fois le comportement réel des erreurs observé en usage — probablement restreint aux erreurs transitoires (timeout, 5xx), jamais aux erreurs de schéma qui indiquent un problème de prompt à corriger plutôt qu'à retenter.
- Support multi-langue : l'architecture est actée et répercutée dans les phases ci-dessus (paramètre `language` et colonne `turn_log.language` en Phase 1, séparation référence/affichage en Phase 4, catalogue et glossaire en Phase 5, résumé anglais en Phase 7). **Restent ouverts** : la liste des langues cibles, le choix de la bibliothèque d'internationalisation du front, et la phase à laquelle une seconde langue est effectivement activée — probablement pas avant que la Phase 5 rende le contenu paramétrable.
- Événements SSE : la granularité et le rattrapage par lecture du tour sont tranchés pour la Phase 2 (architecture, section 8bis). **Restent ouverts** : le streaming de la narration, à réexaminer en Phase 3 quand la narration devient du texte libre, et le rejeu des événements manqués, jugé inutile tant que la lecture du tour suffit.
- Passage à plusieurs instances : bascule de la file de pg-boss vers BullMQ, worker séparé (transport Redis de Transmit) et sérialisation par verrou PostgreSQL sur `session_id` plutôt que par `concurrency: 1` — à trancher avant le beta test de la Phase 9.
