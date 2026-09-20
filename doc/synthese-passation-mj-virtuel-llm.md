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
- Exécution asynchrone : BullMQ (Redis) pour le pipeline en tâche de fond et les jobs différés
- Communication temps réel : AdonisJS Transmit (SSE) pour le retour progressif au front pendant l'exécution d'un tour
- Dev et tests locaux : Docker (PostgreSQL + Redis)
- Recherche de lore : RAG (approche par tags à privilégier avant recherche par similarité)
- Front : application web minimale (chat + affichage d'état de personnage), sans logique métier

**Rôle du backend** : autorité exclusive sur tout calcul et toute mise à jour d'état durable (jets de dés, résolution de combat, gain/perte de points de vie, mise à jour du monde). Le front n'affiche que ce que le backend lui transmet — jamais de calcul côté client.

**Rôle du LLM** : le LLM n'est jamais seul décisionnaire sur l'état du jeu. Il est découpé en plusieurs appels à responsabilité unique (interprétation, validation, narration, extraction), chacun recevant un contexte minimal et produisant une sortie structurée (sauf la narration, en texte libre). Le calcul déterministe (dés, seuils, formules) reste toujours côté backend.

**Support multi-langue** : la langue par défaut de l'application (interface et narration) est l'**anglais**. Un support multi-langue pour le joueur vient s'ajouter par-dessus cette base par défaut. Modalités précises non encore définies (voir points ouverts) — impact notamment sur la langue de sortie demandée au LLM à l'étape de narration, et sur la traduction éventuelle du contenu de lore/scénario.

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

Ce document de synthèse s'appuie sur quatre documents détaillés, à fournir en complément :

| Document | Contenu |
|---|---|
| **architecture-mj-virtuel-llm.md** | Pipeline complet du tour de jeu (5 étapes), modèle de données conceptuel, gestion du contexte (lore/state/mémoire), exemple de flow complet avec prompts LLM détaillés, principes de sécurité anti prompt-injection, architecture applicative AdonisJS |
| **base-de-donnees-mj-virtuel-postgresql.md** | Structure complète des tables PostgreSQL, types de colonnes, exemples de contenu JSONB, schéma relationnel, recommandations spécifiques PostgreSQL (JSONB/GIN, pgvector, partitionnement) |
| **systeme-regles-jeu-mj-virtuel.md** | Système de règles générique (formule 2d6 + compétence + modificateurs), attributs/compétences paramétrables par univers, échelle de difficulté, gestion des modificateurs contextuels (LLM) vs modificateurs d'objets (backend), points de vie et dégâts, modélisation du combat |
| **roadmap-mj-virtuel-llm.md** | Roadmap détaillée en phases (0 à 9 + 5bis), contenu et critères de sortie de chaque phase, intégration de la gestion de comptes (`player` / `game_master` / `superadmin`), synthèse et points ouverts |

**Ordre de lecture conseillé** : ce document de synthèse en premier, puis architecture, puis base de données, puis système de règles, puis roadmap — chaque document référence les précédents sans les répéter intégralement.

---

## 7. Décisions déjà actées

Ces décisions sont considérées comme tranchées et ne doivent pas être rouvertes sans raison explicite.

### Architecture et pipeline
- Pipeline découpé en étapes à responsabilité unique plutôt qu'un appel LLM unique global.
- Séparation systématique : le LLM propose (interprétation, plausibilité, narration, extraction), le backend décide et calcule tout ce qui touche à l'intégrité de la partie.
- Système prompt statique par étape (rôle, contraintes, schéma de sortie) ; le contenu dynamique (contexte de jeu) passe uniquement en message utilisateur, toujours introduit comme donnée et non comme instruction (défense anti prompt-injection).
- Le lore, le state et la mémoire narrative suivent trois mécanismes de sélection distincts : filtrage par tags/RAG pour le lore, requête déterministe pour le state, résumé + buffer récent pour la mémoire.
- **Exécution asynchrone et contrat d'API** : le pipeline d'un tour s'exécute en tâche de fond via BullMQ (Redis) ; le front reçoit un accusé de réception puis un flux d'événements progressifs via AdonisJS Transmit (SSE), introduit dès la Phase 2 de la roadmap.

### Système de règles
- Formule unique : `2d6 + valeur de compétence + modificateurs`, comparée à un seuil de difficulté qualitatif (facile/moyenne/difficile/très difficile).
- Attributs et compétences définis par univers (donnée, pas structure figée dans le code).
- **Modificateurs contextuels** (situationnels, proposés par le LLM, plafonnés à 2-3 par jet) strictement séparés des **modificateurs d'objets** (fixes, calculés par le backend à partir de l'inventaire, jamais chiffrés par le LLM).
- Dégâts dérivés directement de la marge de réussite du jet d'attaque — pas de second jet séparé.
- Combat modélisé comme une simple répétition du pipeline standard (pas de sous-système dédié).

### Base de données et infrastructure
- PostgreSQL choisi comme moteur de base de données.
- RAG choisi pour la recherche de lore, avec pgvector comme option native envisageable.
- JSONB utilisé pour toute structure variable par univers ou par scénario (attributs, compétences, conditions spécifiques, state).
- `turn_log` isolé dès la conception pour ne jamais alourdir les tables d'état courant.
- **Convention de langue** : documentation et échanges de conception en français ; nommage technique (tables, colonnes, enums, clés JSON, code) exclusivement en anglais, appliqué directement dans tous les documents techniques ; langue par défaut de l'application (interface et narration) en anglais, support multi-langue en complément (modalités non tranchées).
- **Environnement technique** : dev et tests locaux sous Docker (PostgreSQL + Redis), repo en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend` et `frontend` dès la Phase 0, `back-office` ajouté en Phase 5.
- **Authentification** : le scaffolding register/login inclus par défaut dans un projet AdonisJS sert de base à l'authentification joueur — pas de système d'authentification construit from scratch. Seul le champ `role` et son enum sont une extension propre au projet.

### Gestion des comptes
- Trois rôles distincts : `player`, `game_master`, `superadmin`.
- Un compte = un rôle unique pour l'instant, pas de cumul.
- Champ `role` posé dès la Phase 0 dans la table `users`, même si un seul rôle est utilisé au départ.

### Gestion des erreurs
- **Pas de retry automatique** dans un premier temps.
- Chaque erreur est renvoyée au front avec un message spécifique selon sa catégorie (timeout/API injoignable, sortie LLM hors schéma, erreur HTTP de l'API externe, échec de validation backend).
- Système de log d'erreurs API structuré explicitement différé (prévu en Phase 9 / todolist).

### Scope
- **Multi-joueur explicitement exclu du projet** — à traiter, le cas échéant, dans un projet distinct avec ses propres réflexions d'architecture (concurrence d'accès au state, infrastructure temps réel, visibilité narrative différenciée).
- Développement en univers déjà connu du LLM pour les premières phases — sous licence protégée en développement/test, ou d'emblée libre de droits (domaine public, historique, folklorique) si une diffusion publique éventuelle est anticipée plus tôt. Vigilance sur les droits de propriété intellectuelle avant toute diffusion publique si un univers sous licence a été utilisé (bascule recommandée à ce moment-là, prévue en Phase 5 de la roadmap).

---

## 8. Points ouverts (non tranchés à date)

- Choix définitif du provider LLM externe et du modèle par étape du pipeline.
- Mécanisme exact de réconciliation si le LLM propose une compétence ou un `action_type` inexistant dans la définition de l'univers.
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
- Modalités précises du support multi-langue : langues cibles, gestion de la langue de sortie du LLM à l'étape de narration, traduction ou non du contenu de lore/scénario selon la langue du joueur, stratégie d'internationalisation de l'interface front.
- Granularité exacte des événements SSE et gestion de la reconnexion en cas de coupure réseau côté client (voir document d'architecture, section 8bis).

---

## 9. État d'avancement

**Phase actuelle** : conception — aucune implémentation n'a encore démarré. Les quatre documents de référence listés en section 6 constituent l'ensemble des spécifications produites à ce jour.

**Prochaine étape envisagée avant reprise du développement** : décomposition détaillée de la Phase 0 de la roadmap en tickets de suivi de projet (specs, règles métier, critères d'acceptation, tests de recette) — non encore réalisée.

---

## 10. Note pour la reprise de contexte

Ce projet a été conçu progressivement, décision par décision, en discutant chaque compromis d'architecture avant de le figer dans les documents de référence. Si des questions de conception se représentent (ex. granularité du découpage LLM, choix relationnel vs documentaire, gestion de la mémoire narrative), la réponse est probablement déjà tranchée dans l'un des quatre documents associés — les consulter avant de rouvrir un point déjà traité évite de revenir sur des arbitrages déjà motivés.
