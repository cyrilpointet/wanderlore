# Projet — Logiciel de jeu de rôle piloté par LLM

## Document de synthèse et de passation

Ce document sert de point d'entrée unique pour reprendre ce projet dans une nouvelle conversation ou sur un autre compte. Il résume le projet, répertorie les documents de référence déjà produits, et rappelle l'ensemble des décisions actées pour éviter de les remettre en question sans raison.

**Usage recommandé** : fournir ce document en premier, accompagné des quatre autres documents markdown listés en section 6, avec un prompt du type *"Voici la synthèse de mon projet en cours, avec les documents de référence associés — prends-en connaissance avant qu'on continue."*

> **⚠️ Convention de langue — à respecter dans tout le projet**
> Les échanges de conception et le texte explicatif des documents de référence sont rédigés en français pour faciliter la discussion. **Cela ne s'applique pas au code ni au schéma technique.** Tout nommage interne (tables, colonnes, enums, clés JSON, variables, routes, noms de fichiers) est en **anglais** — les documents techniques (architecture, base de données, système de règles, roadmap) utilisent déjà directement les noms anglais (`sessions`, `characters`, `turn_log`, `player`/`game_master`/`superadmin`, etc.), pas de traduction à faire a posteriori. La **langue par défaut de l'application** (interface et narration du MJ virtuel) est également **l'anglais**, le support multi-langue (voir section 1) venant s'ajouter par-dessus cette base.

---

## 1. Présentation du projet

**Nature** : logiciel de jeu de rôle textuel sous forme de chat, où le joueur incarne son personnage et l'application tient le rôle de maître du jeu (MJ) virtuel, piloté par un LLM externe.

**Stack technique** :
- Backend : AdonisJS, créé avec `--kit=api`, en monorepo géré par Turborepo (workspaces `backend` / `frontend`, et `back-office` ajouté en Phase 5)
- Base de données : PostgreSQL
- LLM : API externe (provider non encore arrêté), appelée depuis un service dédié (LLM Gateway)
- Exécution asynchrone : file de jobs derrière un port — pg-boss (PostgreSQL) en instance unique, BullMQ (Redis) au passage à plusieurs instances — pour le pipeline en tâche de fond et les jobs différés
- Communication temps réel : AdonisJS Transmit (SSE) pour le retour progressif au front pendant l'exécution d'un tour
- Dev et tests locaux : Docker (PostgreSQL ; Redis provisionné pour la bascule vers BullMQ)
- Recherche de lore : RAG (approche par tags à privilégier avant recherche par similarité)
- Front : application web minimale (chat + affichage d'état de personnage), sans logique métier

**Rôle du backend** : autorité exclusive sur tout calcul et toute mise à jour d'état durable (jets de dés, résolution de combat, gain/perte de points de vie, mise à jour du monde). Le front n'affiche que ce que le backend lui transmet — jamais de calcul côté client.

**Rôle du LLM** : le LLM n'est jamais seul décisionnaire sur l'état du jeu. Il est découpé en plusieurs appels à responsabilité unique (interprétation, validation, narration, extraction), chacun recevant un contexte minimal et produisant une sortie structurée (sauf la narration, en texte libre). Le calcul déterministe (dés, seuils, formules) reste toujours côté backend.

**Support multi-langue** : la langue par défaut de l'application (interface et narration) est l'**anglais**. Un support multi-langue pour le joueur vient s'ajouter par-dessus cette base par défaut. Le principe d'architecture est acté : **tout reste en anglais en interne, la traduction n'intervient qu'à l'étape de narration** (voir section 7 pour le détail des décisions, et le document d'architecture pour leur mise en œuvre). Ce choix est d'abord un choix de coût : la tokenisation de l'anglais est plus dense que celle des autres langues, et le contexte réinjecté à chaque tour est le poste où cet écart se compose.

### Positionnement concurrentiel

Le concurrent le plus proche identifié est **AI Dungeon** (et les plateformes similaires de type Character.AI, NovelAI) — génération narrative libre pilotée par LLM, sans moteur de règles structuré natif. La différenciation du projet repose sur trois axes :

1. **Gestion visible et structurée du personnage** — points de vie, compétences et inventaire affichés visuellement au joueur, mis à jour automatiquement par le backend. Chez AI Dungeon, ce type d'affichage n'existe que via des extensions tierces non officielles (ex. extensions navigateur ajoutant des barres de vie) — ce n'est pas une fonctionnalité native de la plateforme.
2. **Un vrai moteur de JDR "comme sur papier"** — scénarios structurés, système de règles avec jets de compétence déterministes, plutôt qu'une génération narrative libre sans mécanique de jeu sous-jacente. C'est l'apport du moteur de règles et du pipeline décrits dans les documents de référence techniques.
3. **Support multi-langue** — non confirmé comme un différenciateur validé face à la concurrence (non vérifié), mais identifié comme axe d'ouverture à un public plus large que les plateformes anglophones dominantes du secteur.

**Approche de développement** : construction progressive par fonctionnalités minimales, en partant d'un univers déjà connu du LLM pour prototyper vite, avant d'enrichir vers un système générique multi-univers avec lore dédié. Ces univers de départ peuvent être :
- des œuvres sous licence protégée (ex. Star Wars, Le Seigneur des Anneaux) — utilisables en développement/test, mais à écarter avant toute diffusion publique (voir section 4 et 7) ;
- des œuvres tombées dans le domaine public (ex. Sherlock Holmes, l'Iliade et l'Odyssée, Les Trois Mousquetaires) — sans restriction de droits, réutilisables même en diffusion publique ;
- des contextes historiques (ex. Rome antique) ou folkloriques (contes de fées, légendes) — également libres d'usage, avec l'avantage d'être déjà bien connus du LLM sans nécessiter de lore dédié.

---

## 2. Pourquoi ce projet — objectifs et cadrage

Cette section formalise la raison d'être du projet, établie via une analyse CQQCOQP. Elle sert de référence pour arbitrer les décisions futures : toute question de priorité, de budget ou de délai doit être évaluée à l'aune de ces objectifs.

### Objectifs poursuivis (par ordre de motivation)

1. **Le plaisir** — projet mené avant tout pour le plaisir personnel, en tant qu'amateur de JDR.
2. **Curiosité et apprentissage technique** — exploration concrète de l'intégration de modèles LLM dans une application web (pipeline multi-étapes, structuration de prompts, sécurité, architecture de données adaptée).
3. **Auto-formation méthodologique** — occasion de pratiquer les aspects "gestion de projet" et "produit" (roadmap, cadrage CQQCOQP, documentation de référence), compétences jugées de plus en plus centrales dans le métier de développeur.
4. **Monétisation** — piste non explorée à ce jour, explicitement laissée en suspens. Ni un objectif ni un renoncement : une option à réévaluer une fois le produit plus concret.

### Conséquences de ce cadrage sur le projet

- **Quand** : pas de deadline formelle. Le risque principal d'un projet sans échéance est la dérive indéfinie — un rythme indicatif (ex. un jalon de roadmap par mois, ou un volume d'heures hebdomadaire) est recommandé comme repère, sans devenir une contrainte qui nuirait à l'objectif n°1 (le plaisir).
- **Combien** : voir section 4 pour le détail du budget actuel et de la démarche retenue vers un modèle de revenu.
- **Rigueur documentaire volontaire** : la production de documents de référence détaillés et d'une roadmap phasée n'est pas de la sur-ingénierie pour un projet personnel — c'est une partie assumée de l'objectif d'auto-formation méthodologique (objectif n°3). Cette pratique est donc à maintenir plutôt qu'à alléger.
- **Univers utilisé** : les univers sous licence protégée (Star Wars, LOTR, etc.) restent acceptables tant que la monétisation/diffusion publique n'est pas engagée. Le jour où l'objectif n°4 est activé, il faudra soit basculer vers un univers exempt de droits (domaine public : Sherlock Holmes, l'Iliade et l'Odyssée, Les Trois Mousquetaires ; contextes historiques comme la Rome antique ; contextes folkloriques comme les contes de fées ou légendes), soit obtenir les droits nécessaires (déjà anticipé en Phase 5 de la roadmap). Les univers libres de droits ont l'avantage de rester utilisables sans restriction même en cas de diffusion publique, tout en conservant le bénéfice recherché (univers déjà connu du LLM, sans lore dédié à construire).
- **Priorisation en cas d'arbitrage** : en cas de tension entre deux choix (ex. aller vite vs apprendre en profondeur), les objectifs 1 à 3 priment sur toute contrainte de delivery — il n'y a pas d'enjeu commercial actif qui imposerait l'inverse.

---

## 4. Combien — budget et démarche de monétisation

### Budget actuel (phase de test)

- **Hébergement** : solution légère et peu onéreuse envisagée pour la première phase de test (ex. Vercel, Supabase, Railway) — tiers gratuits ou quasi-gratuits suffisants au volume actuel.
- **LLM** : API économique envisagée pour la phase de beta test fermé (ex. Gemini), cohérente avec un faible volume d'usage.
- **Budget global visé** : de l'ordre de 15-20€ mensuels, cadré comme un budget loisir.
- **Point de vigilance** : ce budget est valable tant que le volume d'usage reste faible. Le coût scale avec le nombre de tours joués (jusqu'à 3 appels LLM par tour dans le pipeline complet une fois la Phase 3 de la roadmap atteinte) — ce n'est pas un budget qui restera stable en cas d'ouverture à davantage d'utilisateurs.

### Démarche vers un modèle de revenu — approche en deux temps

Aucun modèle de monétisation n'est tranché à ce stade (cohérent avec l'objectif n°4 du "pourquoi", section 2). La démarche retenue pour instruire cette décision, plutôt que de choisir un modèle à l'aveugle, se déroule en deux étapes séquentielles :

**Étape 1 — Instrumenter avant de vendre.** Une fois le pipeline complet en place (Phase 3 de la roadmap), mesurer en usage réel : coût moyen en tokens par tour, nombre de tours moyen par partie, latence perçue. Cette mesure donne un coût variable par partie jouée — donnée de base indispensable à tout modèle économique viable, pour éviter de sous-facturer (perte d'argent à l'usage) ou de sur-facturer (découragement des joueurs).

**Étape 2 — Valider l'appétence avant de construire l'infrastructure de paiement.** Le beta test fermé prévu est l'occasion de demander aux testeurs, une fois qu'ils ont joué, s'ils auraient payé pour l'expérience vécue et combien — une intention de payer mesurée sur la cible réelle (joueurs de JDR papier) vaut mieux qu'une intuition à ce stade.

**Conséquence technique à anticiper** : un minimum de tracking de consommation (tokens par tour, par partie) doit être intégré dès les premières phases d'implémentation du pipeline — ajout technique mineur, mais qui conditionne la capacité à chiffrer sérieusement un modèle de prix plus tard (répercuté dans la roadmap, voir Phase 1).

### Pistes de modèles économiques identifiées (non tranchées, à évaluer une fois les données de l'étape 1 et 2 disponibles)

| Piste | Avantage | Risque / inconvénient |
|---|---|---|
| Abonnement (freemium ou payant) | Revenu prévisible | Expose directement au risque coût-LLM sur les gros utilisateurs à prix fixe |
| Système de crédits/jetons | Coût LLM directement répercuté, pas de risque de perte | Moins naturel pour un jeu narratif, expérience à soigner pour ne pas casser l'immersion |
| Contenu additionnel payant (scénarios, univers premium) | Cohérent avec une éventuelle ouverture du rôle MJ à des créateurs tiers (voir section 5) ; piste de marketplace à long terme | Nécessite un catalogue de contenu suffisant pour être attractif |
| Don/soutien libre (Ko-fi, Patreon) | Zéro friction, cohérent avec un projet né du plaisir | Revenu faible et imprévisible |
| Modèle mixte | Combine les avantages ci-dessus selon l'usage | Complexité de mise en œuvre plus élevée |

Aucune de ces pistes n'est priorisée à ce stade : le choix dépendra directement du coût réel par partie (étape 1) et du comportement observé en beta test (étape 2).

---

## 5. Qui — cible et équipe

### Cible utilisateur (rôle joueur)

Joueurs de JDR papier/table cherchant une alternative jouable en solo, n'importe où et n'importe quand — le produit répond à un besoin de disponibilité (pas besoin de réunir un groupe ni un MJ humain) plutôt qu'à une simple curiosité pour l'IA générative. Cette cible connaît déjà les codes du JDR (compétences, jets, narration), ce qui a une conséquence directe sur le ton et l'exigence de cohérence attendus du produit — un public non initié aurait été plus tolérant sur ce point.

### Rôle maître du jeu

Exclusivement un rôle technique de back-office dans un premier temps — utilisé par le porteur du projet lui-même pour créer/administrer univers et scénarios, pas un rôle ouvert à des utilisateurs tiers. Une ouverture à des créateurs de contenu externes reste envisageable plus tard, sans être planifiée à ce stade (voir points ouverts).

### Équipe

- **Aujourd'hui** : projet solo — une seule personne cumule les rôles de product manager et de développeur.
- **Court terme envisageable** : un ou deux amis développeurs pourraient rejoindre ponctuellement, sur une base occasionnelle et non structurée (pas une équipe formelle).
- **Long terme** : une professionnalisation du projet (au-delà de l'aide ponctuelle d'amis) n'est pas prévue aujourd'hui, mais n'est pas non plus écartée par principe — à réévaluer selon l'évolution du projet et, le cas échéant, de la question de la monétisation (voir section 2).

---

## 6. Documents de référence associés

Ce document de synthèse s'appuie sur cinq documents détaillés, à fournir en complément :

| Document | Contenu |
|---|---|
| **architecture-mj-virtuel-llm.md** | Pipeline complet du tour de jeu (5 étapes), modèle de données conceptuel, gestion du contexte (lore/state/mémoire), exemple de flow complet avec prompts LLM détaillés, principes de sécurité anti prompt-injection, architecture applicative AdonisJS |
| **base-de-donnees-mj-virtuel-postgresql.md** | Structure complète des tables PostgreSQL, types de colonnes, exemples de contenu JSONB, schéma relationnel, recommandations spécifiques PostgreSQL (JSONB/GIN, pgvector, partitionnement) |
| **systeme-regles-jeu-mj-virtuel.md** | Système de règles générique (formule 2d6 + compétence + modificateurs), attributs/compétences paramétrables par univers, échelle de difficulté, gestion des modificateurs contextuels (LLM) vs modificateurs d'objets (backend), points de vie et dégâts, modélisation du combat |
| **roadmap-mj-virtuel-llm.md** | Roadmap détaillée en phases (0 à 9 + 5bis), contenu et critères de sortie de chaque phase, intégration de la gestion de comptes (`player` / `game_master` / `superadmin`), **stratégie de test transverse**, synthèse et points ouverts |
| **cahier-des-charges-front-mj-virtuel.md** | Cahier des charges du front joueur : principes, parcours et écrans de la Phase 2, machine d'état d'un tour, gestion des erreurs, besoins d'API, direction visuelle, évolutions par phase, et base de prompts pour générer les maquettes avec Stitch |

**Ordre de lecture conseillé** : ce document de synthèse en premier, puis architecture, puis base de données, puis système de règles, puis roadmap, puis cahier des charges du front — chaque document référence les précédents sans les répéter intégralement.

---

## 7. Décisions déjà actées

Ces décisions sont considérées comme tranchées et ne doivent pas être rouvertes sans raison explicite.

### Architecture et pipeline
- Pipeline découpé en étapes à responsabilité unique plutôt qu'un appel LLM unique global.
- Séparation systématique : le LLM propose (interprétation, plausibilité, narration, extraction), le backend décide et calcule tout ce qui touche à l'intégrité de la partie.
- Système prompt statique par étape (rôle, contraintes, schéma de sortie) ; le contenu dynamique (contexte de jeu) passe uniquement en message utilisateur, toujours introduit comme donnée et non comme instruction (défense anti prompt-injection).
- Le lore, le state et la mémoire narrative suivent trois mécanismes de sélection distincts : filtrage par tags/RAG pour le lore, requête déterministe pour le state, résumé + buffer récent pour la mémoire.
- **Exécution asynchrone et contrat d'API** : le pipeline d'un tour s'exécute en tâche de fond via une file de jobs ; le front reçoit un accusé de réception puis un flux d'événements progressifs via AdonisJS Transmit (SSE), introduit dès la Phase 2 de la roadmap.
- **Contrat SSE de la Phase 2** : un canal par partie, abonné avant toute soumission ; événements limités aux jalons (`step_started`, `roll_resolved`, `turn_completed`, `turn_failed`), sans streaming de la narration tant qu'elle sort en JSON avec les effets (réintroduit en Phase 3) ; rattrapage par lecture du tour. Voir document d'architecture, section 8bis.
- **Soumission d'un tour idempotente** : clé fournie par le client, une par soumission, enregistrée avant la mise en file. En Phase 2, worker unique dans le process HTTP, en `concurrency: 1` et sans retry — simplification à reprendre avant le beta test.
- **File de jobs substituable, pg-boss puis BullMQ** : port + adaptateur, pg-boss (PostgreSQL) tant qu'il n'y a qu'une instance — pas de Redis à héberger —, BullMQ au passage à plusieurs instances, qui ramène Redis pour Transmit. Condition de la bascule : idempotence, sérialisation des tours et événements SSE ne dépendent jamais de la file (voir architecture, section 8bis).

### Système de règles
- Formule unique : `2d6 + valeur de compétence + modificateurs`, comparée à un seuil de difficulté qualitatif (facile/moyenne/difficile/très difficile).
- Attributs et compétences définis par univers (donnée, pas structure figée dans le code).
- **Modificateurs contextuels** (situationnels, proposés par le LLM, plafonnés à 2-3 par jet) strictement séparés des **modificateurs d'objets** (fixes, calculés par le backend à partir de l'inventaire, jamais chiffrés par le LLM).
- Dégâts dérivés directement de la marge de réussite du jet d'attaque — pas de second jet séparé.
- Combat modélisé comme une simple répétition du pipeline standard (pas de sous-système dédié).
- **Liberté du joueur** : le MJ ne refuse jamais une action parce qu'elle est imprudente, immorale ou interdite dans l'univers — il la résout et en fait assumer les conséquences. Seul l'impossible matériel mène à un échec automatique, et le personnage y tente quand même l'action. Voir règles, section 10.
- **Réaction des PNJ** : tout personnage touché par une action réagit dans la même narration. Une réaction peut ouvrir une menace, jamais la trancher contre le joueur — c'est son action suivante, et le jet qui la résout, qui en décide. Voir règles, section 10.

### Multi-langue

Le principe directeur est économique autant qu'architectural : le multi-langue ne coûte pas
là où on l'attend. La narration elle-même est un poste marginal ; le poste dominant est le
**contexte réinjecté à chaque tour**, où la surtaxe de tokenisation des langues non anglaises
(de l'ordre de 15 à 30 % pour le français, davantage pour les écritures non latines) se paie
en boucle sur toute la durée d'une partie.

- **Tout reste en anglais en interne.** Lore, scénario, state, system prompts : jamais
  traduits, jamais dupliqués par langue.
- **La traduction n'intervient qu'à l'étape de narration (D)**, seule étape produisant du
  texte destiné à l'œil humain. L'arbitrage (A+B+C) reçoit du contexte anglais et l'entrée
  brute du joueur, et produit du JSON anglais.
- **Pas de second appel de traduction.** La narration est demandée directement dans la langue
  cible via le paramètre `language`. Générer en anglais puis traduire coûterait environ le
  double pour une qualité moindre — le traducteur perdrait le contexte de scène.
- **Pas de duplication du lore par langue.** Le coût de création et de maintenance du contenu
  serait multiplié par le nombre de langues, pour un gain runtime nul.
- **Le résumé narratif est stocké en anglais**, quelle que soit la langue de la partie. Le job
  de résumé est asynchrone : il peut condenser une narration française en résumé anglais.
  C'est la décision qui produit la plus grosse économie, puisque le résumé est réinjecté à
  chaque tour.
- **Le buffer récent reste dans la langue du joueur**, mais n'est injecté qu'à l'étape de
  narration, où il sert la continuité de ton. L'arbitrage se contente du résumé anglais et
  des faits structurés.
- **Glossaire de noms propres par langue**, compact, limité aux entités présentes dans la
  scène, injecté à la seule étape de narration. Il règle le problème d'incohérence des noms
  d'un tour à l'autre — qui est la vraie raison pour laquelle on serait tenté de traduire
  tout le lore — pour quelques dizaines de jetons.
- **Si le joueur écrit dans une autre langue que celle de la partie** : ni détection, ni
  traduction préalable. L'entrée est transmise telle quelle à l'arbitrage, qui produit du
  JSON anglais de toute façon. Coût supplémentaire nul.
- **La langue de la partie est enregistrée dans `turn_log`**, à côté de la consommation de
  jetons : le coût réel par tour varie selon la langue, et un modèle de prix calibré sur des
  parties anglaises sous-estimerait mécaniquement les autres.
- **L'internationalisation du front ne relève pas du LLM** : fichiers de traduction
  classiques. Deux problèmes distincts, à ne pas confondre.

### Inventaire et objets

L'inventaire se scinde exactement sur la ligne « le LLM propose, le backend décide » :

- **La mécanique n'atteint jamais le LLM.** `target_skill`, `value`, `condition`, `state`,
  `quantity` sont lus par le backend au moment du jet. Aucune question de langue, aucun coût
  en jetons.
- **Identifiant stable ≠ nom affiché.** Chaque objet porte un identifiant anglais invariable
  (ex. `recommendation_letter`), manipulé par le code, la base et le LLM, et des noms
  d'affichage par langue, vus par le joueur et employés par le narrateur. Sans cette
  séparation, rien n'empêche le modèle de renvoyer « the letter » puis « sealed letter », ou
  le nom d'affichage traduit.
- **L'étape d'extraction reçoit une liste fermée d'identifiants autorisés.** Tout ce qui en
  sort est rejeté — même mécanisme de réconciliation que pour `skill_used` et `action_type`.
- **Catalogue fermé d'objets par scénario.** Le LLM ne peut pas créer d'entrée d'inventaire :
  un objet inventé n'aurait ni effets mécaniques, ni identifiant stable, ni traduction. Le
  narrateur reste libre de décrire ce qu'il veut, il ne peut simplement pas faire apparaître
  quelque chose qui a des conséquences mécaniques.
- **Seule la langue de la partie est injectée**, jamais la table complète des traductions :
  le coût reste identique que le produit supporte deux langues ou dix.
- **La `description` interne d'un modificateur d'objet reste en anglais** — elle sert
  l'audit et le debug. Le texte destiné au joueur est la description de l'objet lui-même.

### Base de données et infrastructure
- PostgreSQL choisi comme moteur de base de données.
- RAG choisi pour la recherche de lore, avec pgvector comme option native envisageable.
- JSONB utilisé pour toute structure variable par univers ou par scénario (attributs, compétences, conditions spécifiques, state).
- `turn_log` isolé dès la conception pour ne jamais alourdir les tables d'état courant.
- **Convention de langue** : documentation et échanges de conception en français ; nommage technique (tables, colonnes, enums, clés JSON, code) exclusivement en anglais, appliqué directement dans tous les documents techniques ; langue par défaut de l'application (interface et narration) en anglais, support multi-langue en complément (modalités non tranchées).
- **Environnement technique** : dev et tests locaux sous Docker (PostgreSQL + Redis), repo en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend` et `frontend` dès la Phase 0, `back-office` ajouté en Phase 5.
- **Authentification** : le scaffolding register/login inclus par défaut dans un projet AdonisJS sert de base à l'authentification joueur — pas de système d'authentification construit from scratch. Seul le champ `role` et son enum sont une extension propre au projet. Le front s'authentifie par **cookie de session** : `EventSource` ne peut pas porter d'en-tête `Authorization`.
- **Front joueur** : Vite + React, Tailwind CSS, TanStack Router (TanStack Query envisagé pour les lectures).

### Gestion des comptes
- Trois rôles distincts : `player`, `game_master`, `superadmin`.
- Un compte = un rôle unique pour l'instant, pas de cumul.
- Champ `role` posé dès la Phase 0 dans la table `users`, même si un seul rôle est utilisé au départ.

### Tests

- **Séparation stricte entre tests et evals.** Le déterministe (moteur de règles, validation,
  catégories d'erreur, contraintes de schéma) se teste par assertion binaire à chaque commit.
  Le probabiliste (qualité de narration, détection d'injection) se mesure par un score sur un
  corpus, au changement de prompt ou de modèle. On n'asserte jamais sur le texte narré.
- **Un faux provider LLM est écrit en même temps que le vrai** — il rend tout le pipeline
  testable sans réseau ni coût.
- **Aucun appel à l'API LLM réelle dans la suite de tests** ; une commande dédiée le fait à la
  demande.
- **Le jet de dés et l'horloge sont injectables** dès leur première implémentation : sans cela
  le moteur de règles n'est pas testable.
- **Sur la sécurité, le confinement se teste, la détection s'évalue** : même quand la détection
  d'injection échoue, aucun état ne doit avoir été modifié.
- **Le corpus d'évaluation s'accumule depuis `turn_log` dès la Phase 1**, bien avant que les
  evals eux-mêmes soient outillés en Phase 9.

Voir le document de roadmap, section « Stratégie de test », pour le détail par phase.

### Gestion des erreurs
- **Pas de retry automatique** dans un premier temps.
- Chaque erreur est renvoyée au front avec un `code` spécifique selon sa catégorie (timeout/API injoignable, sortie LLM hors schéma, erreur HTTP de l'API externe, échec de validation backend). Le front en affiche la traduction via son i18n ; le `message` textuel de l'API sert au débogage et de repli pour un code inconnu.
- Système de log d'erreurs API structuré explicitement différé (prévu en Phase 9 / todolist).

### Scope
- **Multi-joueur explicitement exclu du projet** — à traiter, le cas échéant, dans un projet distinct avec ses propres réflexions d'architecture (concurrence d'accès au state, infrastructure temps réel, visibilité narrative différenciée).
- Développement en univers déjà connu du LLM pour les premières phases — sous licence protégée en développement/test, ou d'emblée libre de droits (domaine public, historique, folklorique) si une diffusion publique éventuelle est anticipée plus tôt. Vigilance sur les droits de propriété intellectuelle avant toute diffusion publique si un univers sous licence a été utilisé (bascule recommandée à ce moment-là, prévue en Phase 5 de la roadmap).

---

## 8. Points ouverts (non tranchés à date)

- Choix définitif du provider LLM externe et du modèle par étape du pipeline.
- Mécanisme exact de réconciliation si le LLM propose une compétence, un `action_type` ou un **identifiant d'objet** inexistant (rejet strict, fallback, ou nouvelle tentative). Le principe de la liste fermée est acté, la stratégie de rattrapage ne l'est pas.
- **PNJ improvisés** : un personnage de passage (serveur, passant) ne figure dans aucun catalogue, alors que la liste des PNJ transmise au pipeline est fermée. Piste recommandée : le catalogue porte, à côté des PNJ nommés, des **archétypes** génériques ; le backend instancie un archétype dans `npc_instances` quand l'arbitrage en désigne un présent sur le lieu. Le LLM choisit toujours dans une liste fermée, et plusieurs instances d'un même archétype peuvent coexister. Restent à trancher : le déclencheur exact de l'instanciation, la façon de distinguer deux instances d'un même archétype dans le contexte, et leur durée de vie. À régler avant la Phase 3 (voir roadmap).
- Gestion des objets à usage limité (consommables, dégradation) — non couverte par le mécanisme actuel de modificateurs d'objets.
- Décision entre pgvector intégré et vector store externe pour le RAG, à trancher selon le volume de lore réellement atteint.
- Modalités précises de l'inscription self-service (validation d'email, mot de passe oublié, authentification tierce).
- Réintroduction éventuelle d'un retry automatique limité, une fois le comportement réel des erreurs observé en usage.
- Observabilité et évaluation de la qualité LLM (détection de dérive de prompt, evals automatisés) — non abordée en détail.
- Modération de contenu au-delà du prompt injection (thèmes sensibles, classification d'âge).
- Versionning des prompts et des règles de résolution en cas de modification en cours de vie du produit.
- Outillage de création de contenu au-delà d'un back-office CRUD basique (assistance LLM au tagging, import de fichiers structurés).
- Cycle de vie détaillé du personnage et de la partie (création guidée, conditions de fin, reprise après pause longue).
- Rythme de travail indicatif à se fixer (jalon par mois, volume d'heures hebdomadaire) — évoqué en section 2 mais non encore formalisé concrètement.
- Hébergement et canal de distribution définitifs (au-delà des solutions légères envisagées pour la phase de test — voir section 4) — non abordés pour une éventuelle montée en charge.
- **Choix du modèle de monétisation** — la démarche pour y parvenir est actée (voir section 4 : mesure du coût réel puis validation de l'appétence en beta test), mais aucune piste n'est encore sélectionnée.
- Modalités d'une éventuelle ouverture future du rôle "maître du jeu" à des utilisateurs tiers (aujourd'hui strictement technique/interne) — non planifiée, envisagée comme possibilité à long terme.
- Support multi-langue : l'architecture est actée (voir section 7), mais **la liste des langues cibles** reste ouverte. L'i18n du front est posée dès la Phase 2, avec l'anglais seul ; bibliothèque retenue : react-i18next. Reste également à décider du niveau de granularité du glossaire de noms propres (par scénario, par univers) et de son outillage de saisie dans le back-office.
- Événements SSE : granularité et rattrapage tranchés pour la Phase 2 ; restent ouverts le streaming de la narration (Phase 3) et un éventuel rejeu des événements manqués (voir document d'architecture, section 8bis).
- Passage à plusieurs instances : bascule de la file vers BullMQ, worker séparé (transport Redis de Transmit) et sérialisation des tours par verrou PostgreSQL sur `session_id` — à trancher avant le beta test.

---

## 9. État d'avancement

**Phases 0 et 1 terminées.** Le socle technique est en place, et un tour de jeu complet se joue de bout en bout par requête HTTP directe dans l'univers des *Trois Mousquetaires*, avec mise à jour de `world_states`, écriture de `turn_log` et erreurs différenciées.

**Phase actuelle : Phase 2 (front minimal)**, en préparation. Les décisions de cadrage — stack front, authentification par cookie, worker, idempotence, contrat SSE — sont reportées dans la roadmap (Phase 2) et le document d'architecture (section 8bis). Reste à la découper en tickets.

---

## 10. Note pour la reprise de contexte

Ce projet a été conçu progressivement, décision par décision, en discutant chaque compromis d'architecture avant de le figer dans les documents de référence. Si des questions de conception se représentent (ex. granularité du découpage LLM, choix relationnel vs documentaire, gestion de la mémoire narrative), la réponse est probablement déjà tranchée dans l'un des quatre documents associés — les consulter avant de rouvrir un point déjà traité évite de revenir sur des arbitrages déjà motivés.
