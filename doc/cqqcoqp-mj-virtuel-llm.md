# Analyse CQQCOQP — Logiciel de jeu de rôle piloté par LLM

## Document de référence — cadrage projet

Cette analyse balaie le projet selon les sept axes de la méthode CQQCOQP (Quoi, Qui, Où, Quand, Comment, Combien, Pourquoi), afin de vérifier qu'aucune dimension n'a été laissée de côté avant/pendant le développement. Elle complète les documents techniques existants (architecture, base de données, système de règles, roadmap) en couvrant les aspects produit, organisationnels et budgétaires.

---

## Quoi

Un logiciel de jeu de rôle textuel sous forme de chat, où le joueur incarne un personnage face à un maître du jeu (MJ) virtuel piloté par un LLM. Le backend (AdonisJS + PostgreSQL) fait autorité sur tout calcul et toute mise à jour d'état durable ; le LLM est découpé en appels à responsabilité unique (interprétation, validation, narration, extraction), jamais seul décisionnaire sur l'état du jeu.

Support multi-langue visé pour le joueur (interface et narration) — modalités précises non encore définies.

Développement progressif par fonctionnalités minimales, démarrant sur un univers déjà connu du LLM (licence protégée en test, ou d'emblée domaine public/historique/folklorique) avant d'évoluer vers un système générique multi-univers avec lore dédié et RAG.

**Positionnement concurrentiel** : le concurrent le plus proche est AI Dungeon (et plateformes similaires type Character.AI, NovelAI). Différenciation sur trois axes — gestion visible et structurée du personnage (PV, compétences, inventaire affichés visuellement, non natif chez AI Dungeon où ce type d'affichage ne passe que par des extensions tierces non officielles), un vrai moteur de JDR "comme sur papier" avec scénarios structurés et jets de compétence déterministes (plutôt qu'une génération narrative libre sans mécanique sous-jacente), et un support multi-langue (avantage non vérifié face à la concurrence, mais axe d'ouverture identifié).

---

## Qui

**Cible utilisateur (joueur)** : joueurs de JDR papier/table cherchant une alternative jouable en solo, n'importe où et n'importe quand. Cible déjà familière des codes du JDR (compétences, jets, narration), ce qui impose un niveau d'exigence de cohérence plus élevé qu'un public non initié.

**Rôle maître du jeu** : exclusivement technique et interne dans un premier temps (back-office pour créer/administrer univers et scénarios). Ouverture à des créateurs de contenu tiers envisageable à long terme, non planifiée à ce stade.

**Équipe** : projet solo aujourd'hui (une seule personne cumule product management et développement), avec renfort ponctuel et non structuré possible d'un ou deux amis développeurs. Professionnalisation non prévue mais pas écartée par principe.

---

## Où

**Infrastructure technique** : application web (client + backend AdonisJS), base de données PostgreSQL, appel à une API LLM externe.

**Hébergement (phase de test)** : solution légère à tier gratuit/quasi-gratuit (ex. Vercel, Supabase, Railway).

**Non tranché** : hébergement définitif en cas de montée en charge, canal de distribution au-delà du web (mobile, plateforme tierce), zone géographique de déploiement (pertinent pour la latence et la conformité réglementaire en cas d'ouverture publique).

---

## Quand

Pas de deadline formelle — projet mené sur le temps libre du porteur, sans contrainte de delivery externe.

**Risque identifié** : un projet sans échéance peut dériver indéfiniment. Un rythme indicatif (ex. un jalon de roadmap par mois, ou un volume d'heures hebdomadaire) est recommandé comme repère, sans devenir une contrainte qui nuirait au plaisir de développement (objectif premier du projet, voir Pourquoi).

**Séquencement** : phasé en 11 étapes (Phase 0 à 9, plus 5bis) selon la roadmap dédiée, chaque phase restant jouable de bout en bout avant de passer à la suivante.

---

## Comment

Axe le plus abouti du projet à date. Voir les documents de référence dédiés pour le détail complet :

- **Architecture et pipeline** : pipeline LLM en étapes à responsabilité unique, séparation stricte front (affichage)/backend (calcul et autorité), sécurité anti prompt-injection, gestion différenciée du lore/state/mémoire. Exécution asynchrone via une file de jobs (pg-boss en instance unique, BullMQ au passage à plusieurs instances), retour progressif au front via AdonisJS Transmit (SSE).
- **Base de données** : schéma PostgreSQL complet, usage de JSONB pour les structures variables par univers.
- **Système de règles** : formule générique `2d6 + compétence + modificateurs`, séparation modificateurs contextuels (LLM) / modificateurs d'objets (backend).
- **Roadmap** : développement incrémental par fonctionnalités minimales, intégrant la gestion de comptes (joueur / maître du jeu / superadmin).

**Gestion des erreurs** : pas de retry automatique dans un premier temps, message différencié par type d'erreur, système de log différé en Phase 9.

**Environnement technique** : dev et tests locaux sous Docker (PostgreSQL ; Redis provisionné pour la bascule vers BullMQ), repo en monorepo AdonisJS (`--kit=api`, Turborepo) avec packages `backend`/`frontend` dès la Phase 0, `back-office` ajouté en Phase 5.

**Convention de langue** : documents et échanges de conception en français ; nommage technique (tables, colonnes, code) et langue par défaut de l'application exclusivement en anglais, appliqué directement dans tous les documents techniques.

---

## Combien

**Budget actuel (phase de test)** :
- Hébergement léger (Vercel/Supabase/Railway) + API LLM économique (ex. Gemini)
- Budget visé : 15-20€ mensuels, cadré comme budget loisir
- Vigilance : ce budget scale avec le volume de tours joués (jusqu'à 3 appels LLM par tour), non stable en cas d'ouverture à plus d'utilisateurs

**Démarche vers un modèle de revenu — en deux temps, avant toute décision** :
1. **Mesurer** — dès la Phase 3 (pipeline complet + tracking de consommation posé en Phase 1), chiffrer le coût réel moyen par tour et par partie.
2. **Valider l'appétence** — lors du beta test fermé (Phase 9), interroger les testeurs sur leur intention de payer pour l'expérience vécue.

**Pistes de modèle économique identifiées** (non tranchées, à évaluer une fois les deux mesures ci-dessus disponibles) :

| Piste | Avantage | Risque |
|---|---|---|
| Abonnement (freemium/payant) | Revenu prévisible | Exposition au coût LLM des gros utilisateurs à prix fixe |
| Crédits/jetons | Coût LLM directement répercuté | Moins naturel pour l'immersion narrative |
| Contenu additionnel payant | Cohérent avec une ouverture future du rôle MJ | Nécessite un catalogue suffisant |
| Don/soutien libre (Ko-fi, Patreon) | Zéro friction, cohérent avec le projet | Revenu faible et imprévisible |
| Modèle mixte | Combine les avantages ci-dessus | Complexité de mise en œuvre |

---

## Pourquoi

Raison d'être du projet, par ordre de motivation :

1. **Le plaisir** — projet mené avant tout pour le plaisir personnel, en tant qu'amateur de JDR.
2. **Curiosité et apprentissage technique** — exploration concrète de l'intégration de LLM dans une application web.
3. **Auto-formation méthodologique** — pratique des aspects gestion de projet/produit, compétences jugées de plus en plus centrales dans le métier de développeur.
4. **Monétisation** — piste non explorée à ce jour, ni objectif ni renoncement, à réévaluer une fois le produit plus concret.

**Conséquence structurante** : en cas d'arbitrage entre deux choix (ex. aller vite vs apprendre en profondeur), les objectifs 1 à 3 priment — il n'y a pas d'enjeu commercial actif qui imposerait l'inverse. Ce principe de priorisation gouverne l'ensemble des décisions du projet, y compris la rigueur documentaire volontairement maintenue malgré la taille modeste du projet.

---

## Synthèse des manques identifiés lors du premier passage CQQCOQP

Au moment où cette analyse a été menée pour la première fois, plusieurs axes n'étaient pas encore traités. Ce tableau retrace l'état de maturité par axe, avant et après le travail de cadrage qui a suivi :

| Axe | État initial | État après cadrage |
|---|---|---|
| Comment | Très mature | Inchangé |
| Où (technique) | Bien avancé | Inchangé |
| Où (hébergement/distribution) | Non traité | Partiellement traité (phase de test) |
| Qui | Rôles applicatifs seulement | Cible, rôle MJ et équipe formalisés |
| Quoi | Technique seulement | Positionnement concurrentiel et différenciation formulés (voir ci-dessus) ; persona, parcours utilisateur et métriques de succès restent à construire |
| Quand | Non traité | Risque identifié, rythme indicatif recommandé (non encore formalisé en heures/jalons précis) |
| Combien | Non traité | Budget de test cadré, démarche de monétisation actée (modèle non encore choisi) |
| Pourquoi | Non traité | Formalisé et priorisé |

---

## Documents associés

Cette synthèse s'articule avec :
- **synthese-passation-mj-virtuel-llm.md** — point d'entrée du projet, reprend et détaille l'ensemble des axes ci-dessus
- **architecture-mj-virtuel-llm.md** — pipeline et architecture technique
- **base-de-donnees-mj-virtuel-postgresql.md** — schéma de base de données
- **systeme-regles-jeu-mj-virtuel.md** — système de règles de jeu
- **roadmap-mj-virtuel-llm.md** — roadmap de développement phasée
