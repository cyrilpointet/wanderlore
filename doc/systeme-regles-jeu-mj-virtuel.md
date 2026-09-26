# Système de règles de jeu — Logiciel de jeu de rôle piloté par LLM

## Document de référence technique

**Objectif** : définir un système de résolution générique, simple à arbitrer par un LLM et facile à paramétrer par univers, sans jamais coder de règles en dur dans le moteur applicatif.

> **⚠️ Convention de nommage** : conformément à la convention actée pour le projet, **tout le nommage technique est en anglais** — clés JSON, noms de compétences/attributs génériques, valeurs d'enum. Le texte explicatif de ce document reste en français.

---

## 1. Principe directeur

Un seul mécanisme de résolution pour tout type d'action, quel que soit l'univers. Ce choix simplifie radicalement le pipeline :
- une seule formule à faire connaître au LLM d'arbitrage,
- un seul point de calcul déterministe côté backend,
- aucune branche de code spécifique par type d'action ou par univers.

**Ce qui est fixe (code, jamais en base)** : la formule de résolution, l'échelle de difficulté standard, la logique de marge de résultat, la formule de dégâts.

**Ce qui est variable (donnée, stockée en base, paramétrable par univers)** : la liste des attributs, la liste des compétences et leur rattachement à un attribut, les barèmes de difficulté si un univers veut s'écarter du standard, les modificateurs possibles, les conditions spécifiques par type d'action.

Cette séparation garantit qu'ajouter un nouvel univers ne nécessite jamais de modifier le moteur de règles — uniquement d'insérer de nouvelles données.

---

## 2. Formule de résolution

```
Résultat = 2d6 + valeur de compétence + somme des modificateurs
```

Comparé à un seuil de difficulté défini pour l'action.

**Pourquoi 2d6 plutôt qu'un d20** : la distribution de 2d6 est en cloche (les résultats se concentrent autour de la moyenne), contrairement à un d20 dont chaque résultat est équiprobable. Conséquences pratiques :
- l'impact du niveau de compétence et des modificateurs est plus prévisible et plus lisible,
- un personnage compétent échoue rarement à une tâche facile, un personnage faible ne réussit que rarement une tâche difficile,
- une seule courbe à calibrer, réutilisable telle quelle pour tous les univers ajoutés au système.

---

## 3. Attributs et compétences

### Structure à deux niveaux

- **Attributs** (`attributes`) : catégories larges (3 à 5 par univers), valeur de 1 à 5. Exemple : `Physical`, `Mental`, `Social`.
- **Compétences** (`skills`) : rattachées à un attribut, valeur de 0 à 5, propres à chaque univers. Exemple : `persuasion` sous `Social`, `melee_combat` sous `Physical`, `stealth` sous `Physical`.

### Ces listes sont définies par univers, pas par le système

Les attributs et compétences ne sont **pas fixes dans le moteur de règles** — ils sont définis dans la configuration de chaque univers, au même titre que le lore. Un univers cyberpunk peut définir des attributs et compétences totalement différents d'un univers médiéval-fantastique, sans toucher au moteur de calcul.

**Exemple de définition par univers :**
```json
{
  "attributes": ["Physical", "Mental", "Social"],
  "skills": [
    { "name": "persuasion", "attribute": "Social" },
    { "name": "melee_combat", "attribute": "Physical" },
    { "name": "stealth", "attribute": "Physical" },
    { "name": "magic", "attribute": "Mental" }
  ]
}
```

### Simplification volontaire

Pas de sous-compétences ni d'arbres de compétences complexes. Chaque `action_type` du pipeline doit toujours se résoudre vers une seule compétence, sans ambiguïté à trancher par le LLM. Plus la liste de compétences est simple et plate, plus l'arbitrage automatique reste fiable.

### Conséquence sur la validation

Un personnage créé dans un univers donné ne peut posséder que des attributs/compétences existant dans la définition de cet univers. C'est une validation applicative (à la création du personnage), pas une contrainte de schéma rigide — puisque la liste elle-même est une donnée variable.

De la même manière, toute règle de résolution (`associated_skill`) doit référencer une compétence existant réellement dans la définition de l'univers auquel elle est rattachée.

---

## 4. Échelle de difficulté standard

Barème par défaut, réutilisable tel quel pour n'importe quel univers (seules les compétences et le contexte narratif changent, pas l'échelle elle-même) :

| Difficulté (`difficulty`) | Seuil | Interprétation |
|---|---|---|
| `easy` | 7 | Réussite quasi automatique pour un personnage compétent |
| `medium` | 9 | Résultat incertain, dépend réellement du personnage |
| `hard` | 11 | Nécessite un bon niveau ou de bons modificateurs |
| `very_hard` | 13 | Exceptionnel, même un expert peut échouer |

Avec un résultat brut de 2d6 compris entre 2 et 12, additionné à une compétence de 0 à 5 et des modificateurs, ces seuils restent atteignables sans être triviaux, tout en offrant une marge de progression lisible.

Un univers peut définir un barème alternatif s'il souhaite un ton plus dur ou plus clément, mais ce barème reste une donnée paramétrable — la logique de comparaison résultat/seuil reste identique dans le moteur.

---

## 5. Modificateurs

Le système distingue deux catégories de modificateurs, avec deux origines et deux mécanismes de calcul différents. Cette séparation est un point de robustesse important : elle évite qu'une même source de bonus produise un effet mécanique différent d'un tour à l'autre selon l'interprétation du LLM.

```
Total modifiers = contextual modifiers (proposés par le LLM, plafonnés)
                 + item modifiers (calculés par le backend, déterministes)
```

### 5.1 Modificateurs contextuels (`contextual_modifiers`)

Situationnels, propres au tour joué : position avantageuse, réputation du PNJ, tenue inadaptée, circonstances particulières. Ce sont les **seuls** modificateurs que le LLM d'arbitrage a le droit de proposer, chaque source valant généralement entre -2 et +3.

**Règle de gouvernance impérative** : maximum 2 à 3 modificateurs contextuels cumulés par jet. Au-delà, le score devient artificiellement gonflé et la difficulté perd son sens. Cette contrainte doit être explicitement inscrite dans le system prompt de l'étape d'arbitrage LLM (« ne propose jamais plus de 3 modificateurs contextuels pour une même action »), puisque rien au niveau du moteur de calcul lui-même ne l'empêcherait autrement.

**Exemple de structure de modificateurs contextuels (sortie du LLM) :**
```json
[
  { "source": "favorable_reputation", "value": 3, "description": "Le PNJ a déjà une opinion positive du joueur" },
  { "source": "unsuitable_attire", "value": -2, "description": "Apparence incohérente avec le rang social revendiqué" }
]
```

### 5.2 Modificateurs d'objets (`item_modifiers`)

Fixes, attachés à un objet possédé ou équipé (arme, outil, document, armure). Ce sont des données factuelles et déterministes, **jamais proposées ou chiffrées par le LLM** — le modèle ne fait que juger la plausibilité factuelle de l'usage de l'objet (le joueur le possède-t-il, est-ce cohérent de l'utiliser dans ce contexte), sans jamais connaître ni produire la valeur du bonus/malus associé.

Le backend calcule ces modificateurs lui-même au moment du jet, en interrogeant l'inventaire du personnage : il sélectionne les objets dont un effet cible la compétence utilisée (déterminée par le LLM à l'étape d'arbitrage) et dont la condition d'activation est satisfaite, puis additionne leurs valeurs.

**Conditions d'activation possibles (`condition`) :**
- `owned` — le bonus s'applique dès que l'objet est en inventaire, sans besoin d'être activement porté (ex: une lettre, un document).
- `equipped` — le bonus ne s'applique que si l'objet est dans l'état "équipé" de l'inventaire (ex: une arme, une armure).

**Exemple de structure de modificateurs d'objets (définis dans l'inventaire, calculés par le backend) :**
```json
[
  { "target_skill": "persuasion", "value": 2, "condition": "owned", "description": "Sceau officiel reconnu" },
  { "target_skill": "melee_combat", "value": 1, "condition": "equipped", "description": "Lame bien équilibrée" },
  { "target_skill": "stealth", "value": -2, "condition": "equipped", "description": "Armure lourde, bruyante" }
]
```

**Pas de plafond arbitraire** sur les modificateurs d'objets : ils sont naturellement bornés par ce que le personnage possède et peut équiper simultanément, contrairement aux modificateurs contextuels qui doivent être explicitement limités côté prompt.

**Identification des objets.** Le backend fait le rapprochement entre la compétence utilisée et les objets de l'inventaire via la **référence stable** de l'objet (`item_reference`, en anglais, invariable), jamais via son nom d'affichage — qui varie selon la langue de la partie. Le champ `description` d'un modificateur reste lui aussi en anglais : il sert l'audit (« pourquoi ce bonus s'applique-t-il ? »), pas l'affichage joueur. Voir le document de base de données pour la structure, et le document d'architecture (section 6bis) pour ce que chaque étape du pipeline voit de l'inventaire.

### 5.3 Traçabilité

Le résultat final du jet doit conserver l'origine de chaque modificateur appliqué, pour permettre l'audit ("pourquoi ce jet a-t-il obtenu ce total ?") sans ambiguïté entre ce qui vient du jugement du LLM et ce qui vient d'une donnée fixe :

```json
{
  "applied_modifiers": [
    { "source": "contextual", "origin": "favorable_reputation", "value": 3 },
    { "source": "item", "origin": "recommendation_letter", "value": 2 }
  ]
}
```

---

## 6. Marge de résultat et résultats spéciaux

Plutôt qu'un résultat binaire réussite/échec, le système conserve une notion de marge (`margin`) — différence entre le résultat obtenu et le seuil de difficulté — qui sert à calibrer l'intensité narrative du résultat.

| Marge (résultat − seuil) | Qualification (`margin`) |
|---|---|
| ≥ +5 | `critical_success` |
| +1 à +4 | `comfortable` |
| 0 | `narrow` |
| -1 à -3 | `minor_failure` |
| ≤ -4 | `critical_failure` |

**Usage dans le pipeline** :
- Seule la qualification abstraite de la marge (ex: `"comfortable"`) est transmise à l'étape de narration — jamais les chiffres bruts du jet, pour garder la mécanique hors du texte diégétique.
- La marge sert aussi de signal à l'étape d'extraction des effets : une réussite critique peut justifier un effet bonus (information supplémentaire, avantage narratif), un échec critique une complication additionnelle.

---

## 7. Points de vie et dégâts

### Modèle unifié

Un seul pool de ressource (`hit_points`) représente la santé/état du personnage, utilisé aussi bien en situation de combat que pour d'autres formes d'épreuve (épuisement, stress), selon les besoins de l'univers.

**Points de vie** : valeur de base dérivée d'un attribut (exemple : `Physical` × 3), décrémentée par les dégâts subis.

### Calcul des dégâts — pas de second jet

Les dégâts ne nécessitent pas un jet séparé : la marge de réussite du jet d'attaque détermine directement les dégâts infligés. Ce choix évite un appel/calcul supplémentaire dans le pipeline pour chaque action offensive.

```
Dégâts = dégâts de base de l'arme + (marge de réussite ÷ 2, arrondi au supérieur)
```

**Exemple** : arme à dégâts de base 3, jet réussi avec une marge de +4 → 3 + 2 = 5 dégâts.

---

## 8. Combat

Pas de sous-système de combat séparé. Un combat est modélisé comme une **séquence de jets d'action alternés** entre le joueur et le ou les adversaires, chaque round étant traité comme une action normale du pipeline standard :
- l'étape d'arbitrage classe l'intention en `melee_combat` ou `ranged_combat`,
- le moteur de règles calcule le résultat selon la formule générique,
- l'étape de narration met en scène le round.

Cette approche évite de coder un moteur de combat distinct : le combat n'est qu'un enchaînement d'appels au même pipeline, avec des tours plus rapprochés dans le temps.

**Résolution des PNJ adverses** : leurs compétences et modificateurs sont stockés au même format que ceux d'un personnage joueur (dans l'instance de PNJ propre à la partie — `npc_instances` —, ou dans sa définition type au niveau du scénario). Le moteur applique la même formule pour eux, sans distinction de traitement entre joueur et PNJ — un seul moteur de résolution pour tous les participants.

---

## 9. Ce que ce système apporte au pipeline global

- **Le LLM d'arbitrage n'a besoin de connaître ni chiffres ni formules** : il propose uniquement un `action_type`, un `skill_used` (parmi la liste définie pour l'univers courant) et une `difficulty` qualitative. Toute la résolution numérique reste dans le moteur déterministe du backend.
- **Un seul point de calcul déterministe**, réutilisable pour toute action (jet simple, attaque, dégâts) sans branchement conditionnel selon le type d'action.
- **La paramétrisation par univers reste limitée aux données** (attributs, compétences, éventuellement barème alternatif) sans jamais nécessiter de modification du moteur de règles lui-même.

---

## 10. Contraintes à respecter dans le system prompt de l'étape d'arbitrage

Pour que ce système fonctionne de façon fiable avec le LLM :

- La liste des compétences valides pour l'univers courant doit être transmise dans le contexte dynamique de chaque appel (extraite de la définition de l'univers), jamais supposée connue à l'avance par le modèle.
- Le LLM ne doit proposer `skill_used` que parmi cette liste — toute proposition hors liste doit être traitée comme une erreur à corriger ou à rejeter par le backend avant résolution.
- Le LLM ne doit jamais proposer plus de 2 à 3 modificateurs **contextuels** cumulés pour une même action.
- Le LLM ne doit **jamais** chiffrer ou proposer de modificateur lié à un objet possédé ou équipé par le joueur — ces valeurs sont calculées séparément par le backend à partir de l'inventaire (voir section 5.2). Le rôle du LLM se limite à juger la plausibilité factuelle de l'usage de l'objet, jamais son effet mécanique.
- Le LLM ne manipule que des labels qualitatifs (`easy`/`medium`/`hard`/`very_hard`, noms de compétences en anglais) — jamais de valeurs numériques de règles, qui restent entièrement du ressort du backend.
- Les objets sont désignés par leur **référence stable anglaise**, transmise au modèle dans le contexte. Le joueur peut parfaitement écrire « je montre ma lettre » dans sa langue : le rapprochement inter-langue entre son texte libre et la référence anglaise est fait nativement par le modèle, sans traitement préalable.
- **Le joueur n'est jamais bridé dans ses choix.** Une action imprudente, déshonorante, illégale ou vouée à mal finir n'est ni refusée ni requalifiée en échec : elle est résolue normalement (jet si l'issue est incertaine, succès automatique sinon), et ses conséquences sont mises en scène. La plausibilité ne juge que la possibilité matérielle dans l'univers, jamais la sagesse ou la morale de l'action. Une règle d'univers qui interdit quelque chose (l'édit contre les duels) décrit la réaction du monde, pas une limite imposée au joueur. Un échec automatique signifie que le personnage tente et échoue — jamais qu'il renonce.
- **Le monde réagit, sans trancher contre le joueur.** Chaque personnage touché par une action y réagit dans la même narration (réplique, menace, hostilité, fuite). Une réaction peut ouvrir une menace — un PNJ attaque — mais ne la résout jamais : savoir si l'attaque porte revient à l'action suivante du joueur, et donc à un jet calculé par le backend. Aucune perte de points de vie n'est infligée par la seule initiative d'un PNJ. C'est la forme tour par tour des jets alternés joueur/PNJ (section 8), en attendant la boucle de combat de la Phase 8.

---

## 11. Points ouverts / prochaines décisions

- Mécanisme exact de réconciliation si le LLM propose une compétence ou un `action_type` qui n'existe pas dans la définition de l'univers (rejet strict, fallback vers une compétence par défaut, ou nouvelle tentative avec message d'erreur).
- Décision sur l'opportunité de barèmes de difficulté alternatifs par univers (garder le standard partout pour la cohérence entre univers, ou permettre une personnalisation).
- Modélisation précise des adversaires multiples en combat (ordre d'initiative, gestion de plusieurs PNJ hostiles simultanés dans un même round).
- Éventuelle notion de statuts temporaires (blessé, effrayé, avantagé) et leur traduction en modificateurs automatiques plutôt que proposés au cas par cas par le LLM.
- Gestion des objets à usage limité (consommables perdant leur effet après utilisation, objets qui se dégradent avec le temps ou l'usage) — actuellement le mécanisme de modificateurs d'objets (section 5.2) suppose un effet stable tant que l'objet est possédé/équipé, sans notion d'épuisement. À noter : le catalogue fermé d'objets par scénario (voir architecture, section 6bis) facilitera ce traitement, puisque chaque objet acquérable est déjà déclaré à l'avance avec ses caractéristiques.
