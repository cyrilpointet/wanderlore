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
| Étapes du pipeline, ce qui est injecté à chaque étape | `doc/architecture-mj-virtuel-llm.md` | 3, 4 |
| Multi-langue : quelle étape voit quelle langue, glossaire, résumé | `doc/architecture-mj-virtuel-llm.md` | 4bis |
| Inventaire dans le pipeline, références vs noms affichés | `doc/architecture-mj-virtuel-llm.md` | 6bis |
| Exemple complet de tour avec system prompts réels | `doc/architecture-mj-virtuel-llm.md` | 6 |
| Sécurité des prompts, anti prompt-injection | `doc/architecture-mj-virtuel-llm.md` | 7 |
| Découpage applicatif AdonisJS (services, jobs) | `doc/architecture-mj-virtuel-llm.md` | 8 |
| Contrat d'API front/backend, événements SSE | `doc/architecture-mj-virtuel-llm.md` | 8bis |
| Tables, colonnes, exemples de contenu JSONB | `doc/base-de-donnees-mj-virtuel-postgresql.md` | 2, 3, 4, 5 |
| Index, pgvector, partitionnement, profils d'accès | `doc/base-de-donnees-mj-virtuel-postgresql.md` | 7 |
| Formule de jet, difficulté, marge, dégâts, combat | `doc/systeme-regles-jeu-mj-virtuel.md` | 2, 4, 6, 7, 8 |
| Modificateurs contextuels vs objets | `doc/systeme-regles-jeu-mj-virtuel.md` | 5 |
| Contraintes à inscrire dans le prompt d'arbitrage | `doc/systeme-regles-jeu-mj-virtuel.md` | 10 |
| Contenu et critère de sortie d'une phase | `doc/roadmap-mj-virtuel-llm.md` | Phase concernée |
| Stratégie de test, tests vs evals, corpus d'évaluation | `doc/roadmap-mj-virtuel-llm.md` | Stratégie de test |

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

```
Résultat = 2d6 + valeur de compétence + modificateurs contextuels + modificateurs d'objets
```

- Seuils par défaut : `easy` 7 · `medium` 9 · `hard` 11 · `very_hard` 13.
- Marge : `≥+5 critical_success` · `+1..+4 comfortable` · `0 narrow` ·
  `-1..-3 minor_failure` · `≤-4 critical_failure`.
- Dégâts = dégâts de base de l'arme + (marge ÷ 2, arrondi au supérieur). Pas de second jet.
- Combat = répétition du pipeline standard, même moteur pour joueur et PNJ. Pas de
  sous-système dédié.

**Fixe dans le code** : la formule, l'échelle de difficulté, la logique de marge, la
formule de dégâts.
**Variable en base, par univers** : liste des attributs, liste des compétences et leur
rattachement, barème alternatif éventuel, modificateurs possibles, conditions spécifiques.

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

Contraintes à inscrire dans le prompt d'arbitrage : la liste des compétences valides de
l'univers courant est transmise dynamiquement (jamais supposée connue) ; `skill_used` doit
en provenir ; maximum 2-3 modificateurs contextuels ; jamais de modificateur d'objet chiffré ;
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
| 6 | `lore_fragments`, filtrage par tags | — |
| 7 | `narrative_summaries`, mémoire long terme | — |
| 8 | Combat étendu, cycle de vie complet de la partie | — |
| 9 | Production-ready : observabilité, versionning de prompts, modération, beta test | — |

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
