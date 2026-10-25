# Note d'adaptation — le BRP dans Wanderlore

**Statut : proposition, à valider.** Une fois validée, cette note est reportée dans
`systeme-regles-jeu-mj-virtuel.md` (réécrit), dans la roadmap (section « Phase 6 », avec ses
décisions de cadrage) et dans `CLAUDE.md`, puis supprimée.

**Source** : *Basic Roleplaying: Universal Game Engine*, Chaosium, 2023, « ORC Content
Document ». Hors les marques, tout son texte est sous licence ORC. Les mécaniques sont
reformulées ici, jamais recopiées. Le livre reste hors du dépôt (`tmp/`, ignoré par git).

**Décision déjà prise** (2026-10-25) : le BRP remplace le moteur 2d6, **un seul système pour
tous les univers**. La bascule est la nouvelle **Phase 6** ; les anciennes phases 6 à 9
deviennent 7 à 10.

---

## 1. Ce qui ne change pas

Le BRP est un système de calcul. Chez Wanderlore, c'est le backend qui calcule. Les
invariants tiennent donc tels quels :

- **le LLM propose, le backend décide** : dés, seuils, degrés, dégâts et état restent
  déterministes côté backend ;
- l'arbitrage choisit un `action_type` dans la liste fermée de l'univers, une difficulté
  **en label** et au plus 3 circonstances **en labels** ; il ne voit aucun chiffre ;
- le narrateur ne reçoit que le résultat et un degré qualitatif, jamais le jet, la chance
  ni la compétence ;
- modificateurs contextuels ≠ modificateurs d'objets ;
- le combat reste une répétition du pipeline standard, une action du joueur par tour.

Le livre s'y prête bien. Il confie déjà au MJ trois choix seulement (faut-il un jet, quelle
difficulté, quelles circonstances) : ce sont exactement les sorties de l'arbitrage.

---

## 2. Décisions proposées pour la Phase 6

Chaque décision indique ce que dit le livre, ce que je propose, et l'écart éventuel.
Les points marqués **À trancher** attendent votre choix (récapitulés en section 6).

### D1. Le jet : d100 sous la chance

- **Livre** : d100, réussite si le jet est inférieur ou égal à la chance.
- **Proposition** : la chance `T` se calcule ainsi, et uniquement côté backend :
  1. **Base** : la valeur de la compétence (fiche du personnage, ou chance de base de
     l'univers si la fiche ne l'a pas), ou une caractéristique × 5 pour un jet de
     caractéristique (D4).
  2. **Difficulté** (D2), multiplicative : facile × 2, moyenne × 1, difficile ÷ 2 (arrondi
     au supérieur).
  3. **Modificateurs**, additifs et appliqués *après* la difficulté, comme dans le livre :
     contextuels (D3), puis objets (D5).
- **Bornes** : un jet de 01 à 05 réussit toujours, un jet de 96 à 00 échoue toujours.
  *Écart* : le livre réserve le plancher de 5 % aux compétences de base ≥ 5 %, et son texte
  est lui-même incohérent sur le plafond. Je retiens la règle simple.

### D2. La difficulté : trois labels, plus les deux issues sans jet

- **Livre** : automatique (pas de jet), facile × 2, moyenne × 1, difficile ÷ 2, impossible
  (pas de jet).
- **Proposition** : l'arbitrage garde ses trois modes de résolution actuels
  (`automatic_success`, `narrative_automatic_failure`, `roll_required`), qui couvrent déjà
  « automatique » et « impossible ». Pour un jet, la difficulté passe de quatre labels
  (`easy`, `medium`, `hard`, `very_hard`) à trois : **`easy`, `average`, `difficult`**.
- **Conséquence** : un label de moins à choisir pour le LLM. La finesse perdue est rendue
  par les modificateurs contextuels.

### D3. Les modificateurs contextuels : mêmes labels, nouveau barème

- **Livre** : sa table de circonstances va par paliers de ±20 et ±50 ; ailleurs, il dit que
  les modificateurs restent « en général dans ±20 % ».
- **Proposition** : on garde les quatre labels et le plafond de 3. Seules les valeurs
  changent : `minor_bonus` +10, `major_bonus` +20, `minor_penalty` -10, `major_penalty` -20.
  Les cas extrêmes du livre (±50) relèvent de la difficulté (× 2 ou ÷ 2), pas d'un
  modificateur.
- **Pourquoi pas ±20 / ±50** : avec trois labels, l'arbitrage pourrait déplacer la chance de
  150 points, donc trancher seul l'issue. Des valeurs plus petites bornent l'influence du LLM.
  **À trancher** (Q1).

### D4. Les caractéristiques : les sept du BRP, fixes dans le système

- **Livre** : FOR, CON, TAI, INT, POU, DEX, CHA (en anglais : STR, CON, SIZ, INT, POW, DEX,
  CHA), de 3 à 21 pour un humain (INT et SIZ ≥ 8). L'Éducation (EDU) est optionnelle.
- **Proposition** : les **attributs par univers disparaissent**. Les sept caractéristiques
  deviennent un **enum fermé du système**, puisque les formules du moteur en dépendent
  (points de vie, jets de caractéristique, plus tard modificateur de dégâts). Elles se
  libellent comme tout enum fermé : `src/api/enums.ts` et `locales/en/enums.json`, côté front
  comme côté back-office. EDU est écartée.
- **Écart avec la conception actuelle** : « la liste des attributs est une donnée variable
  par univers » ne tient plus. Ce n'est pas une régression : ajouter un univers ne touche
  toujours pas au moteur, puisque les caractéristiques sont les mêmes partout.
- **Jets de caractéristique** : une règle de résolution (`resolution_rules`) peut désigner
  soit une compétence, soit une caractéristique, jetée à × 5 (facile × 10, difficile × 2,5).
  C'est le recours du livre quand aucune compétence ne convient (Effort = FOR, Endurance =
  CON, Idée = INT, Chance = POU, Agilité = DEX, Charme = CHA). Chaque univers décide d'en
  exposer ou non comme `action_type` : rien ne s'ajoute automatiquement à la liste lue à
  chaque tour.

### D5. Les compétences : en pourcentage, avec chance de base

- **Livre** : compétence de 0 à 100 % et au-delà. Chacune a une **chance de base** que tout
  personnage possède (Grimper 40, Premiers soins 30, Écouter, Trouver objet caché, Nager,
  Lancer 25, Persuasion 15…), fixe ou dérivée d'une caractéristique (Esquive = DEX × 2,
  langue maternelle = INT × 5). Elles se rangent en six catégories.
- **Proposition** :
  - une compétence d'univers perd son `attribute` et gagne une **`category`** (enum fermé
    du système : `combat`, `communication`, `manipulation`, `mental`, `perception`,
    `physical`) et une **`baseChance`** : un nombre, ou une caractéristique et un
    multiplicateur ;
  - **une compétence absente de la fiche vaut sa chance de base**, et plus 0 ;
  - la liste des compétences reste propre à chaque univers. Le LLM ne la voit jamais, donc
    sa longueur ne coûte aucun token.
- **Spécialités** (Arme de mêlée (épée), Arme de mêlée (lance)…) : une spécialité est une
  compétence d'univers à part entière (`sword`, `pistol`…). Pas de mécanisme de repli entre
  spécialités voisines en Phase 6.
- **Bonus de catégorie** (règle optionnelle) : écartés. Les prétirés sont écrits par un
  `game_master`, qui fixe directement les valeurs finales.
- **Simplification connue** : un `action_type` se résout toujours vers une seule
  compétence. `melee_combat` vaut donc `sword` pour tout personnage des Trois Mousquetaires,
  même armé d'une dague. Dans le BRP, c'est l'arme qui désigne la compétence ; cela vient
  avec la boucle de combat (Phase 9).

### D6. Les degrés de réussite : cinq, natifs, qui remplacent la marge

- **Livre** : critique (jet ≤ T/20, arrondi au supérieur), spécial (≤ T/5), réussite (≤ T),
  échec, maladresse (les 5 % supérieurs de la plage d'échec ; 00 en est toujours une). Le
  critique l'emporte sur le spécial.
- **Proposition** : ces cinq degrés **remplacent les cinq paliers de marge**. Il n'y a plus
  de marge numérique : un d100 sous la chance n'en donne pas de pertinente. Le narrateur
  reçoit le résultat (`success` / `failure`) et le degré : `critical`, `special`, `success`,
  `failure`, `fumble`. Les seuils se calculent sur la chance finale ; la maladresse, sur la
  plage d'échec bornée par D1.
- **Renommage** : le champ s'appelle aujourd'hui `margin`, ce qui n'a plus de sens. Je
  propose **`degree`**, dans le code, les prompts, `turn_log`, l'événement `roll_resolved`
  et les libellés du front, qui changent de toute façon puisque les valeurs changent.
  **À trancher** (Q2).
- **Guide de narration** : le livre donne déjà la lecture de chaque degré. Une maladresse
  produit l'inverse du but ou un revers ; un spécial, un effet double ou une information de
  plus ; un critique, un effet triple ou une information considérable. Cela passe dans le
  prompt de narration, et dans celui d'extraction comme signal.
- **Attaque ouverte** (règles §10, tranché en Phase 3) : la règle tient, avec les nouveaux
  labels. Sur une réussite, l'attaque est évitée ; sur un échec, blessure légère ; sur une
  maladresse ou un échec automatique, blessure grave. L'échelle provisoire de l'extraction
  (1-2 et 3-5 points) reste en place jusqu'au branchement des dégâts en Phase 9.

### D7. Les points de vie du personnage

- **Livre** : PV = (CON + SIZ) / 2, arrondi au supérieur. En option, « PV totaux »
  (CON + SIZ), que le livre suggère pour les personnages joueurs et les PNJ importants.
- **Proposition** : en Phase 6, la règle standard. Les PV max du personnage sont **dérivés
  par le backend** de CON et SIZ, et non plus saisis dans le prétiré. Ils restent du même
  ordre qu'aujourd'hui (une douzaine), si bien que l'échelle provisoire des blessures garde
  son sens. Le choix des PV totaux revient avec les dégâts réels, en Phase 9, où il protège
  le joueur solo d'une mort en deux coups. **À trancher** (Q3).
- **PNJ** : comme dans les fiches de créatures du livre, leurs PV restent saisis dans le
  profil de combat. Les PNJ n'ont pas de caractéristiques en Phase 6, puisqu'aucun jet de PNJ
  n'existe avant la Phase 9.

### D8. Les objets : mêmes modificateurs, en pourcentage

- **Livre** : un équipement inférieur vaut -20 %, un supérieur +20 % ; une armure pénalise
  des catégories de compétences (-10 % en Physique pour du cuir dur…).
- **Proposition** : le mécanisme des modificateurs d'objets ne change pas (cible une
  compétence, condition `owned` / `equipped`, une fois par définition). Seules les valeurs
  du contenu passent à l'échelle du pourcentage (+2 devient +20, par exemple).

### D9. Les dégâts : la formule du BRP remplace celle de la marge

- **Livre** : dégâts = dés de l'arme + modificateur de dégâts (déduit de FOR + SIZ : -1D6 à
  +1D4 et au-delà ; moitié pour les armes de jet, rien pour les armes à feu) - armure. Un
  critique donne le maximum des dés de l'arme, plus le modificateur jeté, et ignore
  l'armure.
- **Proposition** : la formule actuelle (marge ÷ 2 + bonus d'arme) **ne peut pas survivre**,
  puisque la marge disparaît. Elle est remplacée dans le moteur par la formule du BRP,
  **posée et testée en Phase 6 sans être branchée dans le tour**, comme la formule actuelle
  l'avait été en Phase 4. Le branchement reste en Phase 9. Pour écrire le contenu une seule
  fois, une définition d'objet-arme reçoit dès maintenant un **profil d'arme** : compétence,
  dés de dégâts, usage du modificateur (`full`, `half`, `none`) et type d'effet spécial,
  noté mais sans effet avant la Phase 9.
- **Décision rouverte** : « dégâts sans second jet ». Elle visait à éviter un calcul de
  plus, mais un jet de dés backend ne coûte rien en tokens. **À trancher** (Q4).
- **Dés** : `DiceService` gagne le d100 et le jet d'une expression (`1D6+1`, `2D6`). Tout
  passe toujours par `#services/dice`.

### D10. Ce que la Phase 6 ne fait pas

Aucune règle optionnelle n'est activée, et aucun univers n'a de drapeau de règle.
Restent comme aujourd'hui : un jet par tour contre une difficulté, sans jet opposé ni table
de résistance, sans progression ni expérience.

### D11. Licence et crédit

- La licence ORC impose une **notice** dans le produit, et Chaosium demande de le créditer
  (« Powered by BRP »).
- **Proposition** : un fichier `NOTICE` (ou `ORC-LICENSE.md`) à la racine du dépôt, et une
  mention dans le front, en pied de page ou sur une page « à propos ».
- **À vérifier par vous** avant la beta : le texte exact exigé par la licence ORC
  (chaosium.com/orclicense) et les conditions d'emploi du logo « Powered by BRP ». Je ne
  peux pas en garantir l'interprétation juridique.

---

## 3. Ce qui est différé, et où

| Sous-système du BRP | Proposition |
|---|---|
| Matrice attaque / défense, parade, esquive, jets opposés, dégâts branchés, armure, blessure grave, blessure mortelle, effets spéciaux (saignement, empalement, étourdissement), maladresses | **Phase 9** (combat étendu) |
| Table de résistance (50 + 5 × écart) : poisons, efforts contre un poids, volonté contre volonté | **Phase 9**, avec les jets opposés |
| Création guidée (niveau de puissance, professions, réserves de points), expérience et progression | **Phase 9** (cycle de vie complet) |
| Santé mentale (Mythe), Passions et Réputation (Mousquetaires), jets cachés | **À placer** (Q5) |
| Dangers (chute, feu, noyade, acide), soins, guérison dans le temps, poursuites | Au cas par cas, quand un scénario le demande |
| Pouvoirs (magie, sorcellerie, psychisme) | Hors roadmap actuelle |
| Points de fatigue, localisation des coups, encombrement, vieillissement, points de destin, rounds et rangs de DEX | **Écartés** : incompatibles avec un tour par action, ou trop lourds en état |

---

## 4. Impact par couche (base du découpage en tickets)

1. **Moteur** (`app/services/rules/`) : formule d100, difficulté multiplicative, degrés,
   bornes, barème contextuel, jets de caractéristique, formule de dégâts BRP ;
   `DiceService` (d100, expressions de dés) ; tests unitaires réécrits.
2. **Tour et prompts** : labels de difficulté et de degré dans l'arbitrage, la narration et
   l'extraction ; `turn_validator` ; trace et `turn_log` (un d100 au lieu de deux d6) ;
   événement `roll_resolved` (`degree`) ; règle de l'attaque ouverte remappée.
3. **Contenu et seeds** : types de contenu (caractéristiques, compétences avec catégorie et
   chance de base, règles de résolution vers compétence ou caractéristique, profil d'arme) ;
   `checkScenario` ; réécriture des Trois Mousquetaires et du Mythe (prétirés, compétences,
   PNJ, objets) ; seeders.
4. **Base** : migrations (colonnes JSONB des univers, compétences, `resolution_rules`, fiches
   de personnage) ; parties existantes incompatibles, donc `game:reset --no-seed` avant la
   migration, puis `db:seed`. **Jamais sans votre feu vert.**
5. **Back-office** : éditeur d'univers sans attributs, compétences avec catégorie et chance
   de base, règles de résolution, prétiré (sept caractéristiques, compétences en %),
   profils de combat et d'arme ; libellés des enums.
6. **Front joueur** : fiche (sept caractéristiques libellées, compétences en %, PV),
   journal (degrés), enums et traductions.
7. **Docs** : `systeme-regles` réécrit ; architecture, base de données, flux, cahier du front,
   synthèse, roadmap (Phase 6 et tableaux), `CLAUDE.md`, skill de conception ; notice ORC.

---

## 5. Coût en tokens

Quasi neutre, de l'ordre de quelques pourcents par tour :

- l'arbitrage voit une difficulté de moins à choisir et la même liste d'`action_type` ;
- le narrateur reçoit un label de degré à la place d'un label de marge ;
- compétences, chances de base, caractéristiques et formules ne vont jamais au LLM ;
- le seul ajout possible est celui des jets de caractéristique, et seulement si un univers
  choisit d'en exposer, à raison d'environ 15 tokens par `action_type` et par tour.

Le vrai risque, le combat en tours séparés pour les PNJ, relève de la Phase 9.

---

## 6. Questions à trancher

| # | Question | Ma recommandation |
|---|---|---|
| Q1 | Barème des modificateurs contextuels | **±10 / ±20** (le livre : ±20 / ±50) |
| Q2 | Renommer `margin` en `degree` | **Oui** |
| Q3 | PV du personnage | **Standard (CON + SIZ) / 2** en Phase 6, PV totaux à revoir en Phase 9 |
| Q4 | Formule de dégâts du BRP (dés de l'arme + modificateur - armure), posée dès la Phase 6 et branchée en Phase 9 | **Oui**, avec le profil d'arme dans les définitions d'objets |
| Q5 | Santé mentale, Passions, Réputation, jets cachés | Une phase dédiée « règles optionnelles par univers », **après la Phase 9** |
| Q6 | Contenu créé à la main dans la base de dev depuis le back-office | **Supprimé** à la bascule plutôt que converti (aucune donnée de production) |

---

## 7. Critère de sortie proposé pour la Phase 6

- Une partie des Trois Mousquetaires et une partie du Mythe se jouent de bout en bout sur le
  moteur BRP : jet d100, difficulté en label, cinq degrés de réussite, compétences en
  pourcentage avec chance de base.
- Un `game_master` édite caractéristiques, compétences et prétirés au format BRP depuis le
  back-office.
- Il ne reste aucune trace du moteur 2d6 (code, contenu, prompts, documentation), et la
  notice ORC est en place.
