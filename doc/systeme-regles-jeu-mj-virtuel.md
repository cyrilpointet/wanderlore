# Système de règles de jeu — Logiciel de jeu de rôle piloté par LLM

## Document de référence technique

**Objectif** : définir un système de résolution générique, simple à arbitrer par un LLM et facile à paramétrer par univers, sans jamais coder de règles propres à un univers dans le moteur applicatif.

**Source** : depuis la Phase 6, le système est le *Basic Roleplaying: Universal Game Engine* de Chaosium (édition 2023, « ORC Content Document »), sous licence ORC — **un seul système pour tous les univers**. Ce document en reformule les mécaniques retenues et leur adaptation à un MJ virtuel ; il n'en recopie pas le texte. Le livre lui-même reste hors du dépôt. Crédit et notice : section 12.

> **⚠️ Convention de nommage** : conformément à la convention actée pour le projet, **tout le nommage technique est en anglais** — clés JSON, références de compétences, valeurs d'enum. Le texte explicatif de ce document reste en français.

---

## 1. Principe directeur

Un seul mécanisme de résolution pour tout type d'action, quel que soit l'univers. Ce choix simplifie radicalement le pipeline :
- une seule formule, que le LLM d'arbitrage n'a même pas besoin de connaître,
- un seul point de calcul déterministe côté backend,
- aucune branche de code spécifique par type d'action ou par univers.

Le BRP s'y prête naturellement : il ne confie au maître du jeu que trois jugements — faut-il un jet, quelle difficulté, quelles circonstances. Ce sont exactement les sorties de l'étape d'arbitrage. Tout le reste est du calcul, donc du backend.

**Ce qui est fixe (code, jamais en base)** : la formule de résolution, l'échelle de difficulté, les degrés de réussite, le barème des modificateurs contextuels, les sept caractéristiques et les formules qui en dérivent, la formule de dégâts.

**Ce qui est variable (donnée, stockée en base, paramétrable par univers)** : la liste des compétences, leur catégorie et leur chance de base, les catégories d'action et ce qui les résout (compétence ou caractéristique), les objets et leurs modificateurs, les profils de combat des PNJ.

Cette séparation garantit qu'ajouter un nouvel univers ne nécessite jamais de modifier le moteur de règles — uniquement d'insérer de nouvelles données.

---

## 2. Formule de résolution

```
d100 ≤ chance
chance = base × multiplicateur de difficulté + modificateurs contextuels + modificateurs d'objets
```

Dans l'ordre, et uniquement côté backend :

1. **Base** : la valeur de la compétence associée à l'`action_type` (section 3) — celle de la fiche, ou sa chance de base si la fiche ne l'a pas —, ou une **caractéristique × 5** pour un jet de caractéristique.
2. **Difficulté** (section 4) : multiplicative, appliquée à la base seule.
3. **Modificateurs** (section 5) : additifs, appliqués *après* la difficulté — ils ne sont jamais doublés ni divisés.

**Bornes** : un jet de **01 à 05 réussit toujours**, un jet de **96 à 00 échoue toujours**, quelle que soit la chance. *Écart au livre* : il réserve le plancher aux compétences dont la base atteint 5 %, et son texte se contredit sur le plafond ; la règle simple est retenue.

**Pourquoi le d100 sous la chance** : la chance de réussite se lit directement (55 % à l'épée, c'est 55 chances sur 100), tant pour le `game_master` qui écrit un prétiré que pour le joueur qui voit le détail de son jet (section 6). Les degrés de réussite en découlent sans table (section 6).

---

## 3. Caractéristiques et compétences

### Sept caractéristiques, fixes dans le système

| Référence | Caractéristique | Jet à × 5 | Rôle |
|---|---|---|---|
| `STR` | Force | Effort | soulever, forcer ; modificateur de dégâts |
| `CON` | Constitution | Endurance | résister à l'épuisement, au poison ; points de vie |
| `SIZ` | Taille | — | corpulence ; points de vie, modificateur de dégâts |
| `INT` | Intelligence | Idée | déduire, se souvenir |
| `POW` | Pouvoir | Chance | volonté, coïncidences heureuses |
| `DEX` | Dextérité | Agilité | équilibre, vivacité |
| `CHA` | Charisme | Charme | première impression, présence |

- Valeurs de **3 à 21** pour un humain ; `INT` et `SIZ` au moins 8.
- Elles sont **les mêmes dans tous les univers** : les formules du moteur en dépendent. Ce sont un **enum fermé du système**, libellé par le front et le back-office comme les autres enums fermés — pas une donnée d'univers. Les « attributs par univers » des phases précédentes disparaissent.
- L'Éducation (`EDU`), optionnelle dans le livre, est écartée.

### Compétences, propres à chaque univers

- Une compétence est un **pourcentage**, de 0 à 100 et au-delà.
- Chaque compétence d'univers porte une **catégorie** (enum fermé du système : `combat`, `communication`, `manipulation`, `mental`, `perception`, `physical`) et une **chance de base** : un nombre fixe (Grimper 40, Premiers soins 30, Écouter 25, Persuasion 15…), ou une caractéristique et un multiplicateur (Esquive = `DEX` × 2, langue maternelle = `INT` × 5).
- **Une compétence absente de la fiche vaut sa chance de base** — tout personnage sait un peu grimper ou écouter. La règle « une compétence absente vaut 0 » des phases précédentes disparaît.
- **Une spécialité est une compétence à part entière** : l'arme de mêlée (épée) et l'arme de mêlée (lance) du livre deviennent deux compétences d'univers (`sword`, `spear`). Pas de repli d'une spécialité sur une voisine.
- Les **bonus de catégorie** (règle optionnelle du livre) sont écartés : un prétiré porte directement les valeurs finales.
- La liste n'est jamais transmise au LLM : sa longueur ne coûte aucun jeton.

**Exemple de compétences d'univers :**
```json
[
  { "reference": "sword", "category": "combat", "baseChance": 15 },
  { "reference": "dodge", "category": "physical", "baseChance": { "characteristic": "DEX", "multiplier": 2 } },
  { "reference": "persuade", "category": "communication", "baseChance": 15 }
]
```

### Ce qui résout une catégorie d'action

Chaque `action_type` de l'univers (`resolution_rules`) se résout vers **une seule** cible : une compétence d'univers, ou une caractéristique jetée à × 5. Le jet de caractéristique est le recours du livre quand aucune compétence ne convient (Effort pour forcer une porte, Chance pour une coïncidence). Chaque univers décide d'en exposer ou non comme `action_type` : rien ne s'ajoute de soi-même à la liste lue par l'arbitrage à chaque tour.

**Simplification connue** : un `action_type` désigne toujours la même compétence. `melee_combat` vaut `sword` pour tout personnage des Trois Mousquetaires, même armé d'une dague ; dans le BRP, c'est l'arme qui désigne la compétence, ce qui vient avec la boucle de combat (Phase 9).

### Conséquence sur la validation

Un personnage ne peut posséder que des compétences existant dans la définition de son univers, et ses caractéristiques restent dans leurs bornes. Toute règle de résolution doit désigner une compétence de l'univers ou une caractéristique. C'est une validation applicative (au lancement d'une partie, à la publication d'un scénario), pas une contrainte de schéma rigide — puisque la liste des compétences est une donnée variable.

---

## 4. Difficulté

L'arbitrage choisit d'abord un **mode de résolution** : succès automatique, échec automatique (`narrative_automatic_failure`) ou jet. Ces deux issues sans jet correspondent à l'« automatique » et à l'« impossible » du livre. Pour un jet, il qualifie la difficulté par un label :

| Difficulté (`difficulty`) | Effet sur la base | Interprétation |
|---|---|---|
| `easy` | × 2 | Les circonstances aident nettement |
| `average` | × 1 | Une tâche ordinaire sous pression |
| `difficult` | ÷ 2, arrondi au supérieur | Une tâche ardue, même pour un expert |

Le jet de caractéristique suit la même échelle : × 10 si facile, × 5 en moyenne, × 2,5 (arrondi au supérieur) si difficile.

La difficulté est le levier fort ; les modificateurs contextuels (section 5) affinent. Trois labels au lieu de quatre auparavant : un choix de moins pour le LLM, la finesse perdue étant rendue par les modificateurs.

---

## 5. Modificateurs

Le système distingue deux catégories de modificateurs, avec deux origines et deux mécanismes de calcul différents. Cette séparation est un point de robustesse important : elle évite qu'une même source de bonus produise un effet mécanique différent d'un tour à l'autre selon l'interprétation du LLM.

```
Total modifiers = contextual modifiers (proposés par le LLM, plafonnés)
                 + item modifiers (calculés par le backend, déterministes)
```

Les deux s'additionnent à la chance **après** la difficulté (section 2), et s'expriment en points de pourcentage.

### 5.1 Modificateurs contextuels (`contextual_modifiers`)

Situationnels, propres au tour joué : position avantageuse, réputation du PNJ, tenue inadaptée, obscurité. Ce sont les **seuls** modificateurs que le LLM d'arbitrage a le droit de proposer.

**Le LLM propose un label, le backend le chiffre.** Le modèle ne manipule aucune valeur numérique : il qualifie l'ampleur de la circonstance, et le backend la convertit selon un barème fixe, dans le code.

| Label (`effect`) | Valeur |
|---|---|
| `major_bonus` | +20 |
| `minor_bonus` | +10 |
| `minor_penalty` | -10 |
| `major_penalty` | -20 |

Une même circonstance vaut ainsi toujours la même chose d'un tour à l'autre.

*Écart au livre* : sa table de circonstances va par paliers de ±20 et ±50. Les cas extrêmes (±50) relèvent ici de la difficulté (× 2 ou ÷ 2) ; le barème réduit borne l'influence de l'arbitrage, qui ne peut déplacer la chance que de 60 points au plus.

**Règle de gouvernance impérative** : au plus **3** modificateurs contextuels par jet. La contrainte est inscrite dans le system prompt de l'arbitrage et vérifiée par le backend : une sortie qui la dépasse est rejetée (nouvelle tentative unique, puis échec du tour). Un modificateur dont la source est un objet en scène est rejeté de la même façon : un objet ne compte qu'à travers ses modificateurs d'objet.

**Exemple de structure de modificateurs contextuels (sortie du LLM) :**
```json
[
  { "source": "favorable_reputation", "effect": "major_bonus" },
  { "source": "unsuitable_attire", "effect": "minor_penalty" }
]
```

### 5.2 Modificateurs d'objets (`item_modifiers`)

Fixes, attachés à un objet possédé ou équipé (outil, document, armure). Ce sont des données factuelles et déterministes, portées par la **définition** de l'objet, **jamais proposées ou chiffrées par le LLM** — le modèle ne fait que juger la plausibilité factuelle de l'usage de l'objet (le joueur le possède-t-il, est-ce cohérent de l'utiliser dans ce contexte), sans jamais connaître ni produire la valeur du bonus/malus associé.

Un modificateur d'objet cible une **compétence**. Le backend le calcule lui-même, en lisant les objets **du détenteur** du jet — le personnage ; un objet tenu par un PNJ ou rangé dans un lieu ne compte jamais pour lui. Il sélectionne les modificateurs qui ciblent la compétence jouée (déduite de l'`action_type` choisi par l'arbitrage) et dont la condition d'activation est satisfaite, puis additionne leurs valeurs. Les modificateurs d'une même définition ne comptent **qu'une fois**, quel que soit le nombre d'exemplaires détenus. Un jet de caractéristique ne lit aucun modificateur d'objet.

Le livre donne l'ordre de grandeur : un équipement de qualité supérieure vaut +20, un équipement médiocre -20, une armure lourde pénalise les compétences physiques de -10 à -25.

**Conditions d'activation possibles (`condition`) :**
- `owned` — le bonus s'applique dès que l'objet est en inventaire, sans besoin d'être activement porté (ex : une lettre, un document).
- `equipped` — le bonus ne s'applique que si l'objet est dans l'état « équipé » de l'inventaire (ex : un outil en main, une armure).

**Exemple de structure de modificateurs d'objets (portés par les définitions d'objets, calculés par le backend) :**
```json
[
  { "target": "skill", "skill": "persuade", "value": 20, "condition": "owned", "description": "Recognised official seal" },
  { "target": "skill", "skill": "fine_manipulation", "value": 20, "condition": "equipped", "description": "Locksmith's picks" },
  { "target": "skill", "skill": "stealth", "value": -20, "condition": "equipped", "description": "Heavy, noisy armour" }
]
```

Le bonus d'une arme n'est plus un modificateur d'objet : il est remplacé par le **profil d'arme** (section 7).

**Pas de plafond arbitraire** sur les modificateurs d'objets : ils sont naturellement bornés par ce que le personnage possède et peut équiper simultanément, contrairement aux modificateurs contextuels qui doivent être explicitement limités. La règle « une fois par définition » suffit à empêcher le cumul de deux exemplaires du même objet.

**Identification des objets.** Le backend fait le rapprochement entre la compétence utilisée et les objets du personnage via la **référence stable** de leur définition (`definition_reference`, en anglais, invariable), jamais via son nom d'affichage — qui varie selon la langue de la partie. Le champ `description` d'un modificateur reste lui aussi en anglais : il sert l'audit (« pourquoi ce bonus s'applique-t-il ? »), pas l'affichage joueur. Voir le document de base de données pour la structure, et le document d'architecture (section 6bis) pour ce que chaque étape du pipeline voit de l'inventaire.

### 5.3 Traçabilité

Le résultat du jet conserve l'origine de chaque modificateur appliqué, pour permettre l'audit (« pourquoi ce jet a-t-il obtenu cette chance ? ») sans ambiguïté entre ce qui vient du jugement du LLM et ce qui vient d'une donnée fixe :

```json
{
  "applied_modifiers": [
    { "source": "contextual", "origin": "favorable_reputation", "value": 20 },
    { "source": "item", "origin": "recommendation_letter", "value": 20 }
  ]
}
```

---

## 6. Degrés de réussite

Le d100 donne directement cinq degrés, calculés par le backend sur la chance finale `T` :

| Degré (`degree`) | Condition | Résultat (`result`) |
|---|---|---|
| `critical` | jet ≤ T ÷ 20, arrondi au supérieur | `success` |
| `special` | jet ≤ T ÷ 5, arrondi au supérieur | `success` |
| `success` | jet ≤ T | `success` |
| `failure` | jet > T | `failure` |
| `fumble` | jet dans les 5 % supérieurs de la plage d'échec, arrondis au supérieur ; 00 en est toujours une | `failure` |

- Le critique l'emporte sur le spécial ; une maladresse est toujours un échec.
- La plage d'échec se lit sur la chance bornée (section 2) : avec une chance de 95 ou plus, seul 00 est une maladresse.
- Les degrés **remplacent la marge** des phases précédentes : un d100 sous la chance ne donne pas de marge numérique pertinente. Le champ `margin` devient `degree`.

**Lecture de chaque degré** (guide du livre, repris dans le prompt de narration) : une maladresse produit l'inverse du but recherché ou un revers ; un échec, le but non atteint ; une réussite, un résultat raisonnable ; un spécial, un effet doublé ou une information de plus ; un critique, un effet triplé ou une information considérable.

**Usage dans le pipeline** :
- **Le narrateur ne reçoit que `result` et `degree`** — jamais le jet, la chance ni la compétence, pour garder la mécanique hors du texte diégétique : il tenterait de justifier ou de contredire les chiffres.
- **Le joueur, lui, voit le détail de chaque jet** (tranché à l'ouverture de la Phase 6) : la compétence ou la caractéristique jouée et sa valeur, les modificateurs appliqués avec leur valeur (une circonstance par son label d'effet, un objet par son nom), la chance finale, le résultat du d100 et le degré. Le backend les transmet à l'événement `roll_resolved` et à la lecture du tour ; le front les affiche sans rien calculer. La référence d'une circonstance (`source`) est un texte libre du LLM, sans libellé : elle n'est jamais affichée.
- L'étape d'extraction ne reçoit pas le degré : elle lit ce que la narration en a fait — l'effet bonus d'un critique, la complication d'une maladresse —, et rien de plus.

---

## 7. Points de vie et dégâts

### Points de vie

Un seul pool de ressource (`hit_points`) représente la santé du personnage.

- **Personnage** : `hit_points_max = (CON + SIZ) ÷ 2`, arrondi au supérieur — une douzaine pour un adulte ordinaire. **Dérivé par le backend** de la fiche, jamais saisi. La variante « points de vie totaux » du livre (`CON + SIZ`) sera réexaminée en Phase 9, avec les dégâts réels.
- **PNJ** : comme dans les fiches de créatures du livre, les points de vie sont saisis dans le profil de combat. Les PNJ n'ont pas de caractéristiques tant qu'aucun jet de PNJ n'existe (Phase 9).

### Dégâts : la formule du BRP

La formule de la marge des phases précédentes (marge ÷ 2 + bonus d'arme) disparaît avec la marge. Elle est remplacée par celle du BRP, avec un jet de dés de dégâts — la décision « pas de second jet » est abandonnée : un jet de dés côté backend ne coûte aucun appel LLM.

```
Dégâts = dés de l'arme + modificateur de dégâts − armure de la cible   (au moins 0)
```

- **Dés de l'arme** : lus dans le **profil d'arme** de sa définition (rapière `1D6+1`, mousquet `1D10+4`, revolver moyen `1D8`). À mains nues, `1D3`.
- **Modificateur de dégâts** : déduit de `STR + SIZ` de l'attaquant, selon la table du livre (de `-1D6` à `+1D4` et au-delà ; aucun entre 17 et 24). Le profil d'arme dit s'il s'applique en entier (mêlée), à moitié (armes de jet) ou pas du tout (armes à feu).
- **Critique** : maximum des dés de l'arme, plus le modificateur jeté normalement, armure ignorée.
- **Armure** : valeur fixe, retranchée à chaque coup.
- **Effet spécial** : le profil d'arme note le type d'effet d'une réussite spéciale (empalement, saignement, écrasement…), sans effet mécanique avant la Phase 9.

**Profil d'arme** (sur une définition d'objet, lu par le backend seul) : compétence de l'arme, dés de dégâts, usage du modificateur (`full`, `half`, `none`), type d'effet spécial. Il est posé dès la Phase 6 pour que le contenu s'écrive une seule fois.

**Séquencement** (tranché à l'ouverture de la Phase 6) : la formule est posée et testée en Phase 6, dés simulés. Son branchement dans le tour — désigner l'attaquant et la cible, lire la défense — arrive avec la boucle de combat de la Phase 9. D'ici là, l'extraction chiffre les blessures du personnage sur l'échelle fixe de la section 10.

---

## 8. Combat

Pas de sous-système de combat séparé. Un combat est modélisé comme une **séquence de jets d'action** entre le joueur et le ou les adversaires, chaque action du joueur étant traitée comme une action normale du pipeline standard :
- l'étape d'arbitrage classe l'intention en `melee_combat` ou `ranged_combat`,
- le moteur de règles calcule le résultat selon la formule générique,
- l'étape de narration met en scène l'échange.

Cette approche évite de coder un moteur de combat distinct : le combat n'est qu'un enchaînement d'appels au même pipeline. Les rounds de 12 secondes, les rangs de `DEX` et les actions multiples du livre sont écartés : un tour de Wanderlore est une action du joueur.

**Résolution des PNJ adverses** : leurs compétences sont stockées au même format que celles d'un personnage joueur — profil de combat sur la définition (compétences en pourcentage, points de vie maximum, arme ordinaire), points de vie courants sur l'instance (`npc_instances`). Le moteur leur applique la même formule, sans distinction de traitement entre joueur et PNJ — un seul moteur de résolution pour tous les participants.

**Arme ordinaire et objet spécial** (tranché à l'ouverture de la Phase 4). L'arme ordinaire d'un PNJ est une simple référence de définition dans son profil : elle ne se vole pas et ne se transfère pas. Un objet spécial (arme de quête, épée de famille) est **détenu** par le PNJ comme tout objet (architecture, section 6bis) : c'est en le prenant que le joueur peut l'obtenir, et une arme détenue l'emporte sur l'arme ordinaire du profil.

**Ce que la Phase 9 reprendra du livre** : la matrice attaque / défense (le degré de la parade ou de l'esquive annule ou dégrade celui de l'attaque), les jets opposés et la table de résistance, l'armure branchée, la blessure grave (un coup d'au moins la moitié des points de vie) et la blessure mortelle (points de vie à 0, une fenêtre d'un tour pour être soigné), les effets spéciaux, une table réduite de maladresses. Le livre conseille aussi, en jeu à un seul joueur, que l'adversaire capture plutôt qu'il ne tue.

---

## 9. Ce que ce système apporte au pipeline global

- **Le LLM d'arbitrage n'a besoin de connaître ni chiffres ni formules** : il propose uniquement un `action_type` (parmi la liste fermée de l'univers courant), une `difficulty` qualitative et au plus trois circonstances qualifiées. La compétence ou la caractéristique jouée s'en déduit côté backend, via `resolution_rules`. Toute la résolution numérique reste dans le moteur déterministe du backend.
- **Un seul point de calcul déterministe**, réutilisable pour toute action (jet simple, attaque, dégâts) sans branchement conditionnel selon le type d'action.
- **La paramétrisation par univers reste limitée aux données** (compétences, catégories d'action, objets, PNJ), sans jamais nécessiter de modification du moteur de règles lui-même.
- **Un système éprouvé** plutôt que des règles maison : ses équilibres (chances de base, valeurs d'armes et d'armures, profils de PNJ) sont tirés du livre plutôt qu'inventés.

---

## 10. Contraintes à respecter dans le system prompt de l'étape d'arbitrage

Pour que ce système fonctionne de façon fiable avec le LLM :

- La liste des catégories d'action (`action_type`, avec leur description) de l'univers courant doit être transmise dans le contexte dynamique de chaque appel, jamais supposée connue à l'avance par le modèle. Ce qui les résout (compétence ou caractéristique) n'est pas transmis : c'est le backend qui le déduit.
- Le LLM ne doit proposer `action_type` que parmi cette liste. Une proposition hors liste est rejetée par le backend et déclenche la nouvelle tentative unique avec message correctif, puis l'échec du tour (architecture, section 7).
- Le LLM ne doit jamais proposer plus de 3 modificateurs **contextuels** pour une même action, chacun qualifié par un label (`minor_bonus`, `major_bonus`, `minor_penalty`, `major_penalty`) et jamais par un chiffre (section 5.1).
- Le LLM ne doit **jamais** chiffrer ou proposer de modificateur lié à un objet possédé ou équipé par le joueur — ces valeurs sont calculées séparément par le backend à partir de l'inventaire (voir section 5.2). Le rôle du LLM se limite à juger la plausibilité factuelle de l'usage de l'objet, jamais son effet mécanique.
- Le LLM ne manipule que des labels qualitatifs (`easy` / `average` / `difficult`, références anglaises) — jamais de valeurs numériques de règles, qui restent entièrement du ressort du backend.
- Les objets sont désignés par leur **référence stable anglaise**, transmise au modèle dans le contexte avec les seuls objets en scène — ceux du personnage, des PNJ présents et du lieu. Un objet tenu par un PNJ ou rangé dans le lieu peut être pris, demandé ou volé : c'est une action comme une autre, résolue normalement. Le joueur peut parfaitement écrire « je montre ma lettre » dans sa langue : le rapprochement inter-langue entre son texte libre et la référence anglaise est fait nativement par le modèle, sans traitement préalable.
- **Le joueur n'est jamais bridé dans ses choix.** Une action imprudente, déshonorante, illégale ou vouée à mal finir n'est ni refusée ni requalifiée en échec : elle est résolue normalement (jet si l'issue est incertaine, succès automatique sinon), et ses conséquences sont mises en scène. La plausibilité ne juge que la possibilité matérielle dans l'univers, jamais la sagesse ou la morale de l'action. Une règle d'univers qui interdit quelque chose (l'édit contre les duels) décrit la réaction du monde, pas une limite imposée au joueur. Un échec automatique signifie que le personnage tente et échoue — jamais qu'il renonce.
- **Le monde réagit, sans trancher contre le joueur.** Chaque personnage touché par une action y réagit dans la même narration (réplique, menace, hostilité, fuite). Une réaction peut ouvrir une menace — un PNJ attaque — mais ne la résout jamais de sa propre initiative : savoir si l'attaque porte revient à l'action suivante du joueur, et donc à un jet calculé par le backend. Aucune perte de points de vie n'est infligée par la seule initiative d'un PNJ. C'est la forme tour par tour des jets alternés joueur/PNJ (section 8), en attendant la boucle de combat de la Phase 9.
- **Une attaque ouverte est toujours tranchée par l'action suivante** (tranché en Phase 3, après les premiers tests manuels : une menace pouvait rester suspendue indéfiniment). Tant qu'une attaque contre le personnage reste ouverte, l'action suivante du joueur la tranche, quelle qu'elle soit — une question au MJ, une attente ou une fuite comprises — et c'est **toujours un jet** : l'attaque ouverte suffit à rendre l'issue incertaine. Si le personnage ne fait rien contre elle, l'arbitrage retient la catégorie qui couvre l'esquive ou la parade. Sur une **réussite** (quel qu'en soit le degré), le personnage l'évite ; sur un **échec**, elle porte et il est **blessé** — légèrement sur un `failure` ou un échec automatique, gravement sur un `fumble` —, la narration le disant explicitement. Perdre son arme ou du terrain peut s'y ajouter, jamais le remplacer. En attendant le branchement de la formule de dégâts (section 7, Phase 9), l'extraction chiffre la blessure sur une échelle fixe : 1 ou 2 points pour une blessure légère, 3 à 5 pour une blessure grave. La règle précédente tient : la perte de points de vie vient toujours d'un jet raté du joueur, jamais de la seule initiative du PNJ.

---

## 11. Points ouverts / prochaines décisions

- **Ce qui est différé, et où** :

  | Sous-système du BRP | Phase |
  |---|---|
  | Matrice attaque / défense, parade, esquive, jets opposés, table de résistance, dégâts branchés, armure, blessures grave et mortelle, effets spéciaux, maladresses ; points de vie totaux du personnage | Phase 9 |
  | Création guidée (niveau de puissance, professions, réserves de points), expérience et progression | Phase 9 |
  | Règles optionnelles par univers : Santé mentale (Mythe), Passions et Réputation (Mousquetaires), jets cachés | Phase 9bis |
  | Dangers (chute, feu, noyade, poison), soins, guérison dans le temps, poursuites | Au cas par cas, quand un scénario le demande |
  | Pouvoirs (magie, sorcellerie, psychisme) | Hors roadmap actuelle |

- **Écartés** : points de fatigue, localisation des coups (incompatible avec la blessure grave), encombrement, vieillissement, points de destin, rounds et rangs de `DEX`, actions multiples.
- **Jets cachés et détail du jet** : un jet caché (Phase 9bis) ne pourra pas montrer son détail au joueur ; la règle de la section 6 aura alors une exception.
- Modélisation précise des adversaires multiples en combat (plusieurs PNJ hostiles dans un même échange) — Phase 9.
- Statuts temporaires (blessé, étourdi, à terre) traduits en modificateurs automatiques plutôt que proposés au cas par cas par le LLM — Phase 9, avec les effets spéciaux.
- Gestion des objets à usage limité (usure, charges) — **différée à l'ouverture de la Phase 4** : les consommables passent par la quantité (une balle tirée est détruite), et le mécanisme de modificateurs d'objets (section 5.2) suppose un effet stable tant que l'objet est possédé/équipé. Le modèle définition / instance (architecture, section 6bis) permettra d'ajouter usure et charges sur l'instance le moment venu. Les points de vie des armes et la parade qui les abîme, dans le livre, attendent la même décision.

---

## 12. Licence et crédit

Les mécaniques de ce document viennent du *Basic Roleplaying: Universal Game Engine* (Chaosium, 2023), publié sous **licence ORC** ; « Basic Roleplaying » et le logo Chaosium sont des marques de Chaosium Inc., non couvertes par la licence.

- Le produit porte la **notice de licence ORC** et crédite Chaosium, qui demande la mention « Powered by BRP » : un fichier de notice à la racine du dépôt, et une mention dans le front joueur (pied de page ou page « à propos »).
- **Le texte du livre n'est jamais recopié** dans le code, les prompts ou le contenu : seules les mécaniques sont reformulées.
- Les règles propres à *L'Appel de Cthulhu* (santé mentale à la Chaosium, sorts et créatures chiffrés) ne sont pas sous licence ORC : l'univers du Mythe s'appuie sur le BRP et sur l'œuvre de Lovecraft, dans le domaine public en Europe.
- **À vérifier avant la beta** : le texte exact de la notice exigée par la licence ORC et les conditions d'emploi du logo « Powered by BRP ».
