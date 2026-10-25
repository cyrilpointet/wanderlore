---
name: wanderlore-design
description: Référence de conception Wanderlore (JDR piloté par LLM). À charger avant de concevoir, implémenter ou modifier quoi que ce soit touchant au pipeline LLM du tour de jeu, aux prompts et à leur sécurité, au moteur de règles (jets, modificateurs, dégâts, combat), au schéma PostgreSQL, au contrat SSE front/backend, ou au séquencement des phases de la roadmap. À charger aussi avant de répondre à une question de conception sur le projet — la réponse est probablement déjà tranchée dans doc/.
---

# Wanderlore — référence de conception

Les invariants non négociables sont dans `CLAUDE.md` (déjà chargé). Ce skill sert à
**router vers le bon document** et à rappeler les arbitrages de détail.

> Les documents de `doc/` sont la **source de vérité**. En cas de divergence avec ce
> skill, le document gagne — et signale la divergence à l'utilisateur.

---

## Où chercher quoi

| Question | Document | Section |
|---|---|---|
| Vue d'ensemble, décisions actées, points ouverts, budget, cible | `doc/synthese-passation-mj-virtuel-llm.md` | 7 (actées), 8 (ouverts) |
| Organigramme complet d'un tour, de la soumission à la réponse (état cible) | `doc/flux-backend-tour-de-jeu-mj-virtuel.md` | tout |
| Étapes du pipeline, ce qui est injecté à chaque étape | `doc/architecture-mj-virtuel-llm.md` | 3, 4 |
| Multi-langue : quelle étape voit quelle langue, glossaire, résumé | `doc/architecture-mj-virtuel-llm.md` | 4bis |
| Inventaire dans le pipeline, détenteurs (personnage, PNJ, lieu), références vs noms affichés | `doc/architecture-mj-virtuel-llm.md` | 6bis |
| PNJ uniques, archétypes, improvisés : définitions et instances | `doc/architecture-mj-virtuel-llm.md` | 6ter |
| Lieux : définitions, instances, parent, affichage | `doc/architecture-mj-virtuel-llm.md` | 6quater |
| Exemple complet de tour avec system prompts réels | `doc/architecture-mj-virtuel-llm.md` | 6 |
| Sécurité des prompts, anti prompt-injection | `doc/architecture-mj-virtuel-llm.md` | 7 |
| Découpage applicatif AdonisJS (services, jobs) | `doc/architecture-mj-virtuel-llm.md` | 8 |
| Contrat d'API front/backend, événements SSE | `doc/architecture-mj-virtuel-llm.md` | 8bis |
| Tables, colonnes, exemples de contenu JSONB | `doc/base-de-donnees-mj-virtuel-postgresql.md` | 2, 3, 4, 5 |
| Index, pgvector, partitionnement, profils d'accès | `doc/base-de-donnees-mj-virtuel-postgresql.md` | 7 |
| Formule de jet, difficulté, degrés, dégâts, combat (BRP) | `doc/systeme-regles-jeu-mj-virtuel.md` | 2, 4, 6, 7, 8 |
| Modificateurs contextuels vs objets | `doc/systeme-regles-jeu-mj-virtuel.md` | 5 |
| Contraintes à inscrire dans le prompt d'arbitrage | `doc/systeme-regles-jeu-mj-virtuel.md` | 10 |
| Contenu et critère de sortie d'une phase | `doc/roadmap-mj-virtuel-llm.md` | Phase concernée |
| Stratégie de test, tests vs evals, corpus d'évaluation | `doc/roadmap-mj-virtuel-llm.md` | Stratégie de test |
| Écrans, parcours, états et erreurs du front joueur | `doc/cahier-des-charges-front-mj-virtuel.md` | 4, 5 |
| Ce que le front attend de l'API (libellés, vue d'une partie) | `doc/cahier-des-charges-front-mj-virtuel.md` | 6 |
| Direction visuelle, prompts Stitch pour les maquettes | `doc/cahier-des-charges-front-mj-virtuel.md` | 8, 10 |

**Une question de conception qui ressurgit est probablement déjà tranchée.** Consulter
avant de rouvrir un arbitrage déjà motivé.

---

## Le pipeline d'un tour — forme canonique

```
POST action joueur → accusé de réception + job BullMQ en file
Front s'abonne au flux SSE (Transmit) pour ce tour

0. Backend    : state (SQL déterministe) + lore filtré par tags + résumé + buffer récent
1. LLM A+B+C  : intent / validity / resolution / alert          → JSON strict
2. Backend    : calcul du jet si requis                          → result + margin
3. LLM D      : narration                                        → texte libre
4. LLM E      : extraction des effets                            → JSON strict
5. Backend    : validation du delta, application au state, écriture turn_log
6. Job async  : régénération périodique du résumé narratif (hors chemin critique)
```

**Trois natures de contexte, trois mécanismes de sélection** — ne jamais les confondre :
lore = filtrage par tags (RAG plus tard, seulement si le volume le justifie) ;
state = requête SQL déterministe ; mémoire = dernier résumé + N derniers tours.

Le lore n'est jamais injecté en bloc : **règles** pour l'arbitrage (A+B+C), **ambiance**
pour la narration (D), **rien** pour l'extraction (E).

---

## Moteur de règles — l'essentiel

Le **BRP de Chaosium** (édition 2023, licence ORC), pour tous les univers, depuis la Phase 6.

```
d100 ≤ chance
chance = base × difficulté + modificateurs contextuels + modificateurs d'objets
```

- Base : la compétence associée à l'`action_type` (absente de la fiche = sa chance de base),
  ou une caractéristique × 5.
- Difficulté : `easy` × 2 · `average` × 1 · `difficult` ÷ 2 (arrondi au supérieur), appliquée
  à la base seule ; les modificateurs s'ajoutent après. 01–05 réussit, 96–00 échoue toujours.
- Degrés (`degree`, ex-`margin`) : `critical` ≤ chance/20 · `special` ≤ chance/5 · `success` ·
  `failure` · `fumble` (5 % supérieurs de la plage d'échec, 00 toujours).
- Modificateurs contextuels : labels convertis par le backend (`minor_bonus` +10,
  `major_bonus` +20, `minor_penalty` -10, `major_penalty` -20), 3 au plus.
- Sept caractéristiques fixes (`STR`, `CON`, `SIZ`, `INT`, `POW`, `DEX`, `CHA`) ; points de vie
  du personnage = (CON + SIZ) ÷ 2.
- Dégâts = dés de l'arme (profil d'arme) + modificateur de dégâts (STR + SIZ) − armure ;
  critique au maximum, armure ignorée. Posée en Phase 6, branchée en Phase 10.
- Le narrateur ne reçoit que `result` + `degree` ; le joueur voit le détail du jet.
- Combat = répétition du pipeline standard, même moteur pour joueur et PNJ. Pas de
  sous-système dédié ; matrice attaque / défense et jets opposés en Phase 10.

**Fixe dans le code** : la formule, l'échelle de difficulté, les degrés, le barème
contextuel, les caractéristiques et leurs dérivés, la formule de dégâts.
**Variable en base, par univers** : compétences (catégorie, chance de base), catégories
d'action et ce qui les résout, objets et leurs modificateurs, profils de PNJ.

Ajouter un univers ne doit **jamais** exiger de toucher au moteur de règles.

---

## Écrire un system prompt d'étape

Chaque system prompt est **statique**, **en anglais**, stocké une fois par étape, et porte :
1. Le rôle de l'étape, en une phrase.
2. Ce que l'étape ne doit **PAS** faire (l'arbitre ne raconte rien, le narrateur n'arbitre
   rien, l'extracteur n'invente rien) — c'est la protection contre l'incohérence inter-étapes.
3. Le schéma JSON de sortie exact, sans texte hors schéma.

Le user message porte uniquement les données du tour, **introduites explicitement comme
données de jeu et non comme instructions**. Cette phrase de cadrage se répète à chaque
appel où du texte libre joueur transite.

L'étape A+B+C, premier point de contact avec le texte du joueur, porte la responsabilité de
signaler toute tentative de manipulation (`alert.prompt_injection_suspected`).

Contraintes à inscrire dans le prompt d'arbitrage : la liste des catégories d'action
(`action_type` + description) de l'univers courant est transmise dynamiquement (jamais
supposée connue) ; `action_type` doit en provenir, et le backend en déduit la compétence ; maximum 3 modificateurs contextuels, en labels et jamais en chiffres ; jamais de modificateur d'objet chiffré ;
jamais de valeur numérique de règle — uniquement des labels qualitatifs.

---

## Roadmap — séquencement

| Phase | Objet | Rôle activé |
|---|---|---|
| 0 | Socle technique, table `users` posée | — |
| 1 | Boucle minimale, **un seul appel LLM fusionné A+B+C+D**, univers connu du LLM, règles en dur | — |
| 2 | Front minimal, auth joueur, **BullMQ + SSE dès ici** | `player` |
| 3 | Pipeline complet séparé en 5 étapes, table `resolution_rules` | — |
| 4 | `inventory_items` et modificateurs d'objets | — |
| 5 | Multi-univers (`worlds`, `scenarios`), package `back-office` | `game_master` |
| 5bis | Gestion des comptes | `superadmin` |
| 6 | Bascule sur le système BRP (Chaosium, licence ORC) | — |
| 7 | Gestion du temps et des lieux : horloge de jeu, jour/nuit, sorties entre lieux | — |
| 8 | `lore_fragments`, filtrage par tags | — |
| 9 | `narrative_summaries`, mémoire long terme | — |
| 10 | Combat étendu, cycle de vie complet de la partie | — |
| 10bis | Règles optionnelles par univers (santé mentale, passions, réputation) | — |
| 11 | Production-ready : observabilité, versionning de prompts, modération, beta test | — |

Les simplifications d'une phase sont **volontaires** — ne pas implémenter le pipeline
complet en Phase 1, ni les modificateurs avant la Phase 4. Chaque phase a un critère de
sortie explicite dans le document de roadmap : le vérifier avant de déclarer une phase close.

---

## Pièges déjà identifiés

- **Ne pas fusionner D et E.** Leur nature de sortie diffère (texte créatif vs JSON de
  contrôle) et leurs erreurs n'ont pas les mêmes conséquences : une narration bancale se
  corrige, un effet de state mal extrait corrompt la partie.
- **Ne pas laisser le LLM chiffrer un bonus d'objet** — le même objet produirait un effet
  différent d'un tour à l'autre, ce qui casse la cohérence de jeu.
- **Ne pas passer les chiffres du jet au narrateur** — il tenterait de les justifier ou de
  les contredire.
- **Ne pas recalculer le résumé narratif en synchrone** dans le chemin de réponse au joueur.
- **Ne pas alourdir les tables d'état courant avec l'historique** : `turn_log` et
  `narrative_summaries` sont isolés dès la conception (profils d'accès différents).
- **Ne pas faire passer une règle mécanique par une recherche sémantique.** Barèmes, seuils
  et formules se récupèrent en SQL déterministe ; seul le lore narratif relève du RAG.
- **Ne pas traduire le lore, le state ni le résumé narratif.** Tout reste en anglais en
  interne ; seule l'étape de narration produit du texte dans la langue du joueur. Dupliquer
  le lore par langue coûte cher en contenu pour un gain runtime nul — le glossaire de noms
  propres règle le vrai problème (cohérence des noms) pour quelques dizaines de jetons.
- **Ne pas ajouter un appel de traduction après la narration.** Coût doublé, qualité moindre.
- **Ne pas laisser le LLM désigner un objet par son nom.** Références stables uniquement, et
  liste fermée à l'étape d'extraction — sinon le même objet devient « the letter » puis
  « sealed letter », et un objet inventé arrive sans effets mécaniques ni traduction.
