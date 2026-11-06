# Cahier des charges — Front joueur

## Document de référence technique

**Périmètre** : le package `apps/frontend`, c'est-à-dire l'interface du rôle `player`. Le
back-office (`game_master`, `superadmin`) est un package distinct, introduit en Phase 5, et
n'est pas couvert ici.

**Double usage** :
1. **Référence** pour implémenter le front, phase par phase. La Phase 2 est spécifiée en
   détail ; les phases suivantes sont décrites comme des évolutions, pour que la structure
   des écrans les accueille sans refonte.
2. **Base des maquettes** (section 10), versionnées dans `apps/frontend/design/`, et de la
   direction visuelle (section 8).

**Documents complémentaires** : roadmap (Phase 2, décisions de cadrage), architecture
(section 8bis, contrat SSE), système de règles (section 4, marges). En cas de divergence,
ces documents font foi sur le fond ; celui-ci fait foi sur l'interface.

> **⚠️ Convention de langue** : ce document est en français. Tous les textes d'interface
> qu'il cite sont en **anglais**, langue par défaut de l'application, et les maquettes
> aussi. Les routes, clés JSON et valeurs d'enum restent en anglais.

> **Vocabulaire** : l'interface parle de **game** (partie). Côté backend, une partie est une
> ligne de la table `sessions` — rien à voir avec la session d'authentification (cookie).
> Le mot « session » n'apparaît jamais dans l'interface.

---

## 1. Principes directeurs

Ces principes découlent des invariants du projet. Ils s'appliquent à toutes les phases.

1. **Le front ne calcule rien de ce qui relève du jeu.** Pas de dé, pas de soustraction de
   points de vie, pas de chance, pas de déduction d'état. Il affiche ce que le backend
   transmet. Les dérivations **purement visuelles** restent permises : largeur d'une jauge,
   formatage d'une date relative, compteur de caractères du champ de saisie.

2. **Deux sources de libellés, jamais confondues.**
   - Les **enums fermés du système** (`result`, `degree`, `difficulty`, effets contextuels,
     caractéristiques et catégories de compétences du BRP, `step`, `status`, codes d'erreur)
     sont traduits en texte par le front, via les fichiers de traduction de l'i18n (voir
     section 7). Ils sont finis et connus à la compilation.
   - Les **références de contenu** (compétences, lieux, quêtes, chapitres, puis
     objets en Phase 4) arrivent du backend **avec leur libellé**. Le front n'affiche jamais
     `meung_sur_loire` ni ne le transforme lui-même en « Meung Sur Loire » : ce contenu
     dépend de l'univers, puis de la langue (Phase 5 : `display_names`, `glossary`).

3. **La mécanique est visible, comme à la table** (tranché à l'ouverture de la Phase 6). Le
   joueur de JDR papier voit chaque jet en entier : la compétence ou la caractéristique et sa
   valeur, la difficulté, les modificateurs avec leur valeur, la chance, le d100 et le degré
   de réussite. Le backend calcule tout, le front l'affiche. Seul le narrateur est tenu à
   l'écart des chiffres. Sa fiche de personnage affiche aussi ses valeurs : c'est sa feuille
   de personnage, comme sur table.

4. **La narration est le cœur de l'écran.** Tout le reste — fiche, en-tête, indicateurs —
   est secondaire et doit s'effacer devant le confort de lecture.

5. **Le joueur ne retape jamais son texte.** Une erreur, un rechargement de page ou une
   session expirée ne font jamais perdre une action saisie.

6. **Un habillage neutre vis-à-vis de l'univers.** Le premier univers est *Les Trois
   Mousquetaires*, mais la Phase 5 ouvre le multi-univers (Sherlock Holmes, Rome antique,
   contes…). Aucun élément de l'habillage (fonds, ornements, typographie) ne doit être
   propre au XVIIᵉ siècle.

7. **Mobile d'abord.** La cible joue « n'importe où, n'importe quand » : l'écran de jeu est
   conçu d'abord pour un téléphone, puis élargi.

---

## 2. Cible et contexte d'usage

- **Qui** : des joueurs de JDR papier cherchant une partie en solo, sans groupe ni MJ humain.
  Ils connaissent les codes (compétences, jets, fiche de personnage) et attendent de la
  cohérence — un public exigeant, pas un public de curieux de l'IA.
- **Quand** : des sessions courtes et fréquentes, souvent sur téléphone, avec des reprises
  après interruption. Retrouver immédiatement où on en était est essentiel.
- **Comment** : on lit beaucoup, on écrit peu. Un tour, c'est une phrase ou deux du joueur,
  puis un paragraphe de narration après quelques secondes d'attente.

---

## 3. Périmètre par phase

| Phase | Ce qui change dans le front |
|---|---|
| **2** | **Tout ce document, sections 4 à 8** : connexion, liste des parties, écran de jeu (journal, saisie, fiche en lecture seule), progression SSE, erreurs |
| 3 | La narration s'affiche progressivement (streaming) |
| 4 | Onglet inventaire dans la fiche (lecture seule) |
| 5 | Démarrer une partie à partir d'un scénario ; nom de l'univers et libellés venus de la base |
| 6 | Fiche au format BRP (caractéristiques, compétences en pourcentage) ; détail de chaque jet dans le journal |
| 7 | Heure et période de jeu à côté du lieu ; éventuellement les sorties visibles du lieu courant |
| 9 | Rien de visible (mémoire long terme côté backend) |
| 10 | Combat en rounds : jusqu'à deux jets du personnage par tour, dégâts infligés en détail |
| 11 | Rien de visible en propre : les échéances et les emplois du temps des PNJ passent par le récit |
| 12 | Accueil par personnages, création de personnage guidée, page d'un personnage et ses parties, abandon (5.6) ; puis progression du personnage, pause / reprise, écrans de fin |
| 13 | Santé mentale, passions et réputation sur la fiche, selon l'univers |
| 14 | Inscription, mot de passe oublié, choix de la langue, paramètres du compte |

Les évolutions des phases 3 à 14 sont détaillées en section 9. **Elles ne s'implémentent pas
en Phase 2** ; seule la structure des écrans doit leur laisser la place.

---

## 4. Parcours Phase 2

1. **Connexion.** Le joueur ouvre l'application, n'est pas authentifié → écran de connexion.
   Il saisit email et mot de passe → liste de ses parties.
2. **Choix d'une partie.** Il ouvre une partie → écran de jeu, historique complet affiché,
   défilé jusqu'au dernier tour.
3. **Jouer un tour.** Il écrit son action, l'envoie. Son texte apparaît dans le journal, la
   saisie se verrouille, des messages d'attente se succèdent au fil des événements SSE
   (arbitrage, éventuel jet, narration). La narration s'affiche, la fiche se met à jour, la
   saisie se déverrouille.
4. **Échec d'un tour.** Un message d'erreur apparaît à la place de la narration, avec
   **Retry** (renvoie le même texte) et **Edit** (remet le texte dans le champ de saisie).
5. **Retour en cours de tour.** Il recharge la page ou revient après une coupure pendant
   qu'un tour s'exécute → l'écran reprend l'état d'attente, puis affiche le résultat dès
   qu'il est connu.
6. **Session expirée.** Une requête renvoie `401` → retour à l'écran de connexion, puis
   retour automatique à la partie en cours, brouillon intact.
7. **Déconnexion** depuis le menu du compte → écran de connexion.

Pas d'inscription, pas de mot de passe oublié, pas de création de partie en Phase 2 : les
comptes et parties sont créés en base (seeders). La route `POST /auth/signup` du scaffolding
existe côté backend, mais le front ne l'expose pas avant la Phase 14.

---

## 5. Écrans Phase 2

Routes indicatives, gérées par TanStack Router. Toutes sauf `/login` exigent d'être
authentifié.

### 5.1 Connexion — `/login`

**Objectif** : s'authentifier, rien d'autre.

- Nom de l'application (wordmark **Wanderlore**) et une accroche d'une ligne :
  *« Your solo tabletop adventure, with a game master who never cancels. »* (à affiner).
- Champs **Email** et **Password** sur une carte posée sur la table, bouton **Sign in** ; sur
  desktop, deux d10 posés à côté, pour le décor.
- Aucun lien d'inscription ni de mot de passe oublié.

**États** : envoi en cours (bouton désactivé, indicateur) ; identifiants refusés
(*« Invalid email or password. »*, sous le formulaire, champs conservés) ; erreur réseau.

**Après connexion** : redirection vers la page demandée avant l'authentification si elle
existe, sinon `/games`.

### 5.2 Mes parties — `/games`

> **Remplacé en Phase 12** par l'accueil par personnages et la page d'un personnage (5.6). La
> suppression d'une partie n'y vaut plus que pour une partie échouée.

**Objectif** : retrouver et reprendre une partie.

Une carte par partie, triées par dernière activité :
- nom du personnage (titre de la carte) ;
- univers (*The Three Musketeers*) et chapitre en cours (*The Road to Paris*) — libellés
  fournis par le backend ;
- statut (`in_progress` → *In progress*, `paused` → *Paused*, `completed` → *Completed*) ;
- dernière activité en relatif (*« 2 hours ago »*) ;
- points de vie actuels, en petit (repère visuel rapide).

Toute la carte est cliquable → `/games/:gameId`, sauf son bouton de suppression (icône de
corbeille, à droite de la dernière activité). Celui-ci ouvre une **modale de confirmation**
(*« Delete this game? »*, nom du personnage, partie impossible à reprendre) : **Keep it**, qui
reçoit le focus, ou **Delete** (`DELETE /sessions/:id`). Pendant la requête, les boutons et
Échap attendent ; en cas d'échec, l'erreur s'affiche dans la modale ; en cas de succès, la
carte quitte la liste. La suppression est douce côté backend, mais définitive pour le joueur.

**États** : chargement (squelettes de cartes) ; aucune partie (*« No game yet. »* — pas de
bouton de création en Phase 2) ; erreur de chargement avec **Try again**.

En tête de page, posés sur la table, le wordmark et le jeton du compte (initiales), qui déplie
une petite carte : email, **Preferences**, **Sign out**.

### 5.3 Partie — `/games/:gameId`

L'écran principal, une table de jeu (section 8) : la **carte du personnage** (en-tête), la
**feuille du récit** (journal) avec l'**étiquette du lieu**, le **plateau de dés** qui porte la
**zone de saisie**, et la **pile de fiches** du personnage.

**Disposition**
- **Desktop (≥ 1024 px)** : une barre en haut ; la feuille au centre-gauche, colonne de lecture
  limitée à ~70 caractères par ligne, le plateau sous elle ; la pile de fiches à droite
  (~400 px), toujours visible.
- **Tablette et mobile** : la carte du personnage en haut de l'écran, la feuille au milieu, le
  plateau ferme l'écran. Sous la carte pendent les trois onglets de la fiche (*Character*,
  *Inventory*, *Quests*) : chacun lève la pile au-dessus de la table assombrie, ouverte sur sa
  fiche. Les points de vie restent visibles en
  permanence sur la carte.
- Le plateau et la saisie restent collés en bas de l'écran ; sur mobile, ils restent visibles
  au-dessus du clavier virtuel.

#### 5.3.1 Carte du personnage (en-tête)

- Retour à la page du personnage.
- Nom du personnage (sur desktop, porté par le lien de retour).
- Pastilles de points de vie (`11 / 14`) — visibles sur toutes les tailles d'écran ; sur desktop
  dans la barre du haut, quel que soit l'onglet ouvert de la pile.
- Les trois onglets de la fiche, accrochés sous la carte, qui lèvent la pile ouverte sur la fiche
  choisie (mobile et tablette uniquement).
- Bouton de lecture à voix haute (icône, toutes tailles d'écran), si le navigateur sait lire :
  il reste sur l'écran de jeu pour couper ou rétablir la voix d'un geste, et double le réglage
  des préférences (5.5) — un seul réglage, deux accès, toujours d'accord.
- Jeton du compte (initiales), qui ouvre le menu du compte.

**Étiquette du lieu**, épinglée sur le bord haut de la feuille, à toutes les tailles d'écran :
le lieu courant et la période de la journée (*Hôtel de Laffemas · Paris — Dusk*), puis l'univers
et le scénario. Fixe, elle ne défile pas avec le journal, qui passe sous elle sans jamais la
traverser : le joueur sait toujours où et quand se passe la scène sans ouvrir la fiche. Comme la
fiche, elle ne suit un tour qu'à sa révélation (5.3.7). Jamais l'heure, la date ni les sorties
(5.3.4).

#### 5.3.2 Journal

Le récit, du plus ancien au plus récent, défilé automatiquement vers le bas à l'arrivée d'un
nouvel élément — sauf si le joueur est remonté lire l'historique (il voit alors un bouton
**New message ↓**).

Le journal se lit comme un livre, pas comme une messagerie. Types d'éléments :

| Élément | Contenu | Rendu |
|---|---|---|
| **Action du joueur** | Texte saisi, tel quel | Bloc compact, discret, marqué « You » ; typographie d'interface ; retrait ou teinte légère pour le distinguer du récit |
| **Jet** | Le jet en entier : *« Persuasion 60% · Difficult · Advantage +10 · → 40% · rolled 12 · Special success »* | **Carte de jet** posée droite sur la feuille entre l'action et la narration, décalée vers la droite, bord gauche à la couleur de l'issue : la ligne du jet en entier, puis le degré **tamponné** (à droite sur desktop, sous la ligne sur mobile) ; la chance n'est montrée que quand elle diffère de la valeur, la difficulté que quand elle n'est pas `average`. Pendant le tour en cours, le jet se joue dans le plateau de dés (5.3.7) et rejoint la feuille une fois révélé. **Une carte par jet** du personnage, dans l'ordre où ils ont été faits (jusqu'à deux en combat). En combat, le tampon dit aussi ce que le jet a fait : une attaque son issue (*Hit*, *Blocked*, *Missed*) et, si elle porte, ses dégâts sur une seconde ligne (*« Damage 6 · Damage modifier +2 · Armor −1 · → 7 dealt · Impaling »*) ; une défense, laquelle (*Parry*, *Dodge*, en tête) et si elle a tenu (*Blow avoided*, *Blow taken*) |
| **Narration** | Texte du MJ, un ou plusieurs paragraphes | Pleine largeur de la colonne, **typographie serif de lecture**, sans bulle, interligne généreux |
| **Effets** | Conséquences appliquées : *« −2 HP »*, *« You arrive at Paris »* | Ligne discrète sous la narration, icônes ; absente si aucun effet visible |
| **Attente** | Message d'étape (voir 5.3.5) | Ligne animée sous l'action en cours |
| **Échec** | Message traduit d'après le `code` d'erreur + **Retry** / **Edit** | Encadré d'alerte sobre à la place de la narration |

Libellés des degrés de jet (table du front, à partir de `result` + `degree`) :

| `degree` | Libellé | Ton visuel |
|---|---|---|
| `critical` | Critical success | réussite, accentué |
| `special` | Special success | réussite |
| `success` | Success | réussite |
| `failure` | Failure | échec |
| `fumble` | Fumble | échec, accentué |

Une circonstance s'affiche par son effet (*Advantage*, *Strong hindrance*…), jamais par les
mots que l'arbitrage lui a donnés ; un objet par son nom.

Les effets affichés sont ceux que le backend transmet sous une forme lisible : variation de
points de vie et déplacement (lieu, avec libellé). **Les flags de scénario ne sont jamais
affichés** : ce sont des marqueurs internes, pas des informations pour le joueur.

**Tours échoués et historique.** Un tour échoué est journalisé côté backend, mais il ne fait
pas partie de l'histoire : le journal rechargé n'affiche que les tours aboutis. L'encadré
d'échec n'existe que pendant la visite où l'échec s'est produit.

**Partie neuve** (aucun tour) : un état d'accueil occupe le journal — nom du personnage,
lieu de départ, quête en cours s'il y en a une, et l'invitation *« Your story begins. What do
you do? »*.

**Historique long** (Phase 9, KAN-133) : une partie s'ouvre sur ses 20 derniers tours. Tant
qu'il en reste de plus anciens, un bouton **Load earlier** en tête du journal charge la page
précédente et la place devant, sans déplacer la lecture ; une page ajoutée devant n'est pas
une nouveauté (pas de bouton *New message*). Un échec de chargement s'affiche sous le bouton,
d'après son `code`.

#### 5.3.3 Zone de saisie

Un bordereau de papier posé dans le plateau de dés (section 8) : le champ, la dictée, le bouton
d'envoi bleu encre ; verrouillé, un cadenas.

- Champ multiligne, hauteur auto de 1 à ~6 lignes, placeholder *« What do you do? »*.
- **Entrée** envoie, **Maj+Entrée** passe à la ligne. Sur mobile, bouton d'envoi explicite.
- Limite de **1000 caractères** (bornée par le backend). Un compteur n'apparaît qu'à
  l'approche de la limite (au-delà de 900).
- Envoi impossible si le champ est vide ou ne contient que des espaces.
- **Verrouillée pendant un tour en cours**, avec un indice (*« The game master is
  answering… »*), et tant qu'un jet en direct n'est pas révélé (5.3.7), même si le tour est
  déjà terminé côté backend. C'est une commodité : la protection réelle est la clé
  d'idempotence.
- **Brouillon conservé** par partie (stockage local du navigateur) : rechargement, session
  expirée et navigation ne le perdent pas. Il est effacé quand le tour est accepté.

#### 5.3.4 Fiche du personnage (lecture seule)

Contenu Phase 2, tout fourni par le backend avec les libellés :

- **Identité** : nom du personnage, univers.
- **Points de vie** : une pastille par point, pleines pour les points restants, cerclées pour
  les points perdus, et la valeur `11 / 14`. Quand la valeur change à la fin d'un tour, gain ou
  perte, les pastilles rebondissent et pulsent brièvement.
- **Caractéristiques** : les sept du BRP en tuiles, *STR 13 · CON 14 · SIZ 12…* — l'abréviation
  libellée par l'i18n, le nom complet en infobulle (Phase 6 ; elles remplacent les attributs).
- **Compétences**, groupées sous leur catégorie du BRP, en pourcentage. Seules les
  compétences que le personnage a entraînées.
- **Ressources** : *Purse 15*.
- **Quêtes** : les quêtes en cours avec leur résumé, ou un message quand il n'y en a aucune.
  Le lieu et la période de la journée, longtemps dans un onglet *Situation* avec les quêtes,
  vivent depuis sur l'**étiquette du lieu** (5.3.1), toujours visible.
- **Lieu et période** (étiquette du lieu) : retenus en Phase 2 (KAN-15), l'état d'accueil d'une
  partie neuve exigeant déjà ces données et la reprise après interruption s'en servant. Depuis
  la Phase 7, la **période de la journée** (*Dusk*) à côté du lieu — jamais l'heure, la date
  ni le numéro de jour, et jamais les sorties du lieu : le joueur les apprend par le récit, par
  les moyens de son personnage (une montre pour l'heure). Une pièce d'un réseau s'affiche
  suivie du lieu qui la contient (*The kitchen · Ward House*), libellé construit par le
  backend.

Pas d'inventaire (Phase 4), pas d'action possible depuis la fiche.

#### 5.3.5 Déroulé d'un tour — machine d'état

Un tour côté front suit une machine d'état explicite, testable isolément :

```
idle ──submit──▶ submitting ──202──▶ in_progress ──turn_completed──▶ idle
                    │                   │   ▲
                    │                   │   └─ step_started / roll_resolved
                    │                   └──turn_failed──▶ failed ──retry──▶ submitting
                    └──network / 4xx / 5xx──▶ submit_failed ──retry──▶ submitting
```

| État | Déclencheur | Affichage |
|---|---|---|
| `submitting` | Envoi du POST | L'action du joueur apparaît dans le journal, marquée *Sending…* |
| `in_progress` | Accusé `202` reçu | *« The game master considers your action… »* |
| — | `step_started { step: "arbitration" }` | *« The game master weighs your action… »* |
| — | `roll_resolved` | Carte de jet en direct (5.3.7) ; la narration qui suit est retenue jusqu'à la révélation. Deux au plus par tour, l'attaque puis la défense, lancés l'un après l'autre |
| — | `step_started { step: "narration" }` | *« The game master tells what happens… »* |
| `idle` | `turn_completed` | Narration, effets, fiche mise à jour ; saisie déverrouillée |
| `failed` | `turn_failed` | Encadré d'échec, **Retry** / **Edit** |
| `submit_failed` | Échec du POST | Selon le cas (voir 5.3.6) |

**Clé d'idempotence** (décision de la roadmap, Phase 2) :
- générée par le front (`crypto.randomUUID()`) **à chaque soumission voulue par le joueur**,
  et transmise dans l'en-tête `Idempotency-Key` (obligatoire, au format uuid) ;
- **réutilisée** quand le front renvoie la même soumission après une erreur réseau survenue
  avant l'accusé de réception (le backend renverra l'accusé du tour déjà créé, s'il existe) ;
- **renouvelée** pour **Retry** après un `turn_failed` : c'est une nouvelle tentative.

**Abonnement SSE** : le front s'abonne au canal de la partie à l'ouverture de l'écran,
**avant** toute soumission, et s'en désabonne en le quittant. Les événements d'un tour sont
rattachés à la soumission par sa clé d'idempotence, car ils peuvent arriver avant la réponse
`202`.

Tout tour commence par `step_started { step: "arbitration" }`, jet ou non : sans jet, il est
directement suivi de `turn_completed`. Le canal est `sessions/:id` ; l'abonnement Transmit
(`POST /__transmit/subscribe`) porte l'en-tête CSRF, à ajouter via le hook `beforeSubscribe`
du client Transmit. Format des messages : architecture, section 8bis.

**Rattrapage** : à l'ouverture de l'écran, si la partie a un tour en cours, le front entre
directement en `in_progress`. Si le flux SSE se reconnecte, ou si aucun événement n'arrive
pendant **30 s** (tranché en KAN-25, `SILENCE_BEFORE_READ_MS`), le front relit l'état du tour
et en déduit l'affichage ; le délai est réarmé tant que le tour reste en cours. Aucun rejeu
d'événements n'est attendu du serveur.

**Fin de tour sans nouvelle requête** : `turn_completed` porte le tour et la fiche. Le lieu
affiché dans la fiche suit l'effet `movement` du tour, que le backend a appliqué. Un tour
terminé connu par relecture (et non par l'événement) ne porte pas la fiche : le front la
relit alors.

#### 5.3.6 Erreurs

Le front **affiche le message associé au `code` d'erreur** renvoyé par l'API, via une clé de
traduction de l'i18n : les codes forment une liste fermée, connue à la compilation, comme les
autres enums du système (principe 2). Le `message` textuel de l'API ne sert qu'au **débogage**
et de **repli** pour un code que le front ne connaît pas encore — jamais comme texte principal,
puisqu'il reste en anglais quelle que soit la langue de l'interface. Le front choisit aussi la
présentation et l'action proposée. L'**encadré d'échec** est une note épinglée sur la feuille à
la place de la narration, bord brique (section 8).

| Situation | Source | Présentation | Action |
|---|---|---|---|
| `llm_timeout` | `turn_failed` | Encadré d'échec | **Retry** / **Edit** |
| `llm_unreachable` | `turn_failed` | Encadré d'échec | **Retry** / **Edit** |
| `llm_http_error` | `turn_failed` | Encadré d'échec | **Retry** / **Edit** |
| `llm_invalid_output` | `turn_failed` | Encadré d'échec — le message suggère de reformuler | **Edit** mis en avant, **Retry** |
| `turn_validation_failed` | `turn_failed` | Encadré d'échec (*« Nothing was applied. »*) | **Retry** / **Edit** |
| `turn_expired` | lecture du tour | Encadré d'échec — le tour ne s'est jamais terminé | **Retry** / **Edit** |
| `turn_queue_unavailable` (503) | POST | Encadré d'échec — le tour n'a pas pu être pris en charge | **Retry** avec une **nouvelle** clé |
| `turn_already_in_progress` (409) | POST | Pas d'encadré : bascule en attente du tour en cours | — |
| Saisie invalide (422 du validateur) | POST | Erreur sous le champ, texte conservé | Corriger |
| Non authentifié (401) | toute requête | Redirection vers `/login`, brouillon conservé | Se reconnecter |
| Partie introuvable (404) | chargement | Page *« This game does not exist or is not yours. »* | Retour à **My games** |
| Réseau / 5xx sur le POST | POST | Encadré *« Connection lost. »* | **Retry** avec la **même** clé |

Le détail `reasons[]` d'un `turn_validation_failed` sert au diagnostic développeur : il n'est
pas montré au joueur (au plus dans une zone repliée, en environnement de développement).

#### 5.3.7 Jet en direct

Le jet d'un tour joué en direct se lance **à la main**, comme à la table. Le d100 est déjà
tiré par le backend quand `roll_resolved` arrive : le geste du joueur déclenche la
révélation, il ne pèse jamais sur le résultat. Aucune mécanique d'adresse (arrêter les dés
au bon moment…) ne doit laisser croire le contraire.

Trois temps :

1. **Préparation** — à `roll_resolved`, le plateau de dés grandit et la carte du jet s'y
   construit : la compétence ou la caractéristique et sa valeur, la difficulté si elle n'est pas
   `average`, puis chaque modificateur, qui s'ajoute l'un après l'autre, et la chance finale
   (*Chance → 75%*). Pas de jauge : la chance chiffrée suffit. Les deux d10 montrent « ? ». Un
   bouton **Roll the dice** reçoit le focus (Entrée ou Espace le déclenchent).
2. **Lancer** — les faces des deux d10, dizaines et unités, défilent environ une seconde ; les
   dizaines s'arrêtent d'abord, les unités ensuite, sur le d100 transmis.
3. **Révélation** — le d100 et le degré tamponné apparaissent, avec un accent pour `critical`
   et `fumble` ; le jet rejoint la feuille en carte (5.3.2), puis la narration retenue apparaît
   en fondu et poursuit son écriture. Le plateau garde le dernier jet au repos.

**Plusieurs jets par tour** (Phase 10, KAN-141) : un round de combat apporte jusqu'à deux
`roll_resolved`, dans l'ordre — l'attaque du personnage, puis sa défense contre la riposte ;
un personnage attaqué pendant une action sûre n'a que sa défense. Chaque jet se lance à la
main, l'un après l'autre, dans le plateau : le second attend, hors de vue, que le premier ait
rejoint la feuille, puis se prépare à son tour. Les jets des PNJ ne sont jamais envoyés.
La carte porte en tête ce qu'est le jet et contre qui : *Attack on Jussac*, *Parry against
Jussac* — la défense choisie par le backend. Un unique dont le personnage ignore le nom n'est
jamais nommé : *Parry against unknown opponent 2*, d'un rang que le backend tient fixe ; à
la révélation, le degré s'accompagne de l'issue (*Hit*, *Blocked*, *Missed* ; *Blow avoided*,
*Blow taken*).

**Dégâts montrés, jamais lancés** : ceux qu'inflige l'attaque du personnage apparaissent en
détail à la révélation de son jet, sous le degré, sans geste de lancer — dés de l'arme,
modificateur de dégâts et armure quand ils ne sont pas nuls, total, effet spécial. Ceux qu'il
subit ne sont jamais détaillés : le joueur n'en voit que la perte de points de vie, sur la
fiche et dans les effets du tour (`hitPointsDelta`, total du tour).

**Narration retenue** : les fragments reçus avant la révélation sont conservés, pas affichés.
`turn_completed` peut arriver avant le clic : le tour est alors **retenu** à la place du tour en
cours, la même carte à l'écran, et la saisie reste verrouillée (5.3.3). Il ne rejoint le
journal, la fiche et la lecture à voix haute qu'à la révélation du **dernier** jet du tour : sinon les points de vie de
la carte du personnage ou la voix trahiraient l'issue avant les dés. Sur `turn_failed`, la révélation a
lieu aussitôt, pour tous les jets du tour, puis l'encadré d'échec remplace la narration comme
d'ordinaire.

**Jamais rejoué** : un tour relu (réouverture de l'écran, rattrapage, historique) affiche
directement ses cartes de jet et sa narration ; la lecture du tour en porte la liste (`rolls`).
Seul un `roll_resolved` reçu en direct ouvre le jet dans le plateau.

**Préférences** (5.5) : avec le **lancer automatique**, la carte enchaîne seule la
préparation et le lancer, sans bouton, pour chaque jet du tour ; avec l'**animation des dés** coupée, la révélation est
immédiate (le bouton reste, sauf lancer automatique). Les deux réglages sont indépendants.

**Accessibilité** : les dés sont masqués aux lecteurs d'écran (`aria-hidden`) ; le
jet complet, dégâts compris, est annoncé une fois, à sa révélation. Les couleurs d'issue doublent le libellé du
degré, jamais l'inverse.

**Mise en œuvre** : la révélation suit une petite machine pure, distincte de `turnReducer`
(qui repasse à `idle` sur `turn_completed`), attachée à l'identifiant du tour —
`staged → rolling → landed`, puis le jet suivant en file ou `revealed`. Elle reçoit à chaque
`roll_resolved` la liste des jets du tour entendus jusque-là et n'ajoute à sa file que les
nouveaux : un événement entendu deux fois ne rejoue rien. Elle est testée unitairement, et chaque état de la
carte en HTML statique.

### 5.4 Pages système

- **Introuvable** (route inconnue ou partie inaccessible) : une carte sur la table, message
  court, deux d10 sur 00 et 0 pour le décor, retour à **My characters**.
- **Erreur inattendue** : message générique, bouton de rechargement. Jamais de trace
  technique à l'écran.

### 5.5 Préférences

Ouvertes depuis le menu du compte (**Preferences**), sur une carte soulevée au-dessus de la
table : elle monte du bas sur mobile, centrée sur desktop. Ce sont
des **choix d'interface propres à un appareil** : stockés dans le navigateur (section 7,
*Stockage local*), **jamais en base**, jamais transmis au backend. Ils ne suivent donc pas le
joueur d'un appareil à l'autre, et un appareil partagé par plusieurs comptes les partage.
Une modification prend effet immédiatement, sans bouton d'enregistrement.

| Groupe | Réglage | Valeurs | Défaut |
|---|---|---|---|
| Apparence | Thème | *Light* / *Dark* / *System* | *Light* (refonte visuelle, KAN-160) |
| Narration | Lecture à voix haute | on / off | on — si le navigateur sait lire ; doublé par le bouton de la carte du personnage (5.3.1) |
| Dés | Lancer automatique | on / off | off |
| Animations | Dés | on / off | on |
| Animations | Apparition de la narration | on / off | on |
| Animations | Jauge de points de vie | on / off | on |
| Animations | Panneaux et pages (*Panels and pages*) : ouverture et fermeture des boîtes de dialogue et de la fiche sur mobile, fondu entre deux pages | on / off | on |

**Animations et `prefers-reduced-motion`** : le réglage du système est un **plancher**. Quand il
demande moins de mouvement, toutes les animations sont coupées quoi qu'indiquent les
préférences, et leurs interrupteurs s'affichent désactivés, avec la mention que le système en
décide. Les indicateurs d'état (points d'attente, chargement) ne sont pas des animations
réglables : ils signalent un état, et le réglage du système suffit à les figer.

La liste des animations réglables grandit avec elles : toute nouvelle animation notable
(au-delà d'une transition de survol) y prend sa ligne.

### 5.6 Personnages et parties d'un personnage (Phase 12)

Depuis la Phase 12, le joueur ne lance plus une partie depuis un catalogue de scénarios avec
un prétiré : il choisit un univers, y crée un personnage, puis choisit pour lui un scénario de
cet univers. Un personnage ne joue qu'une partie à la fois. Ces écrans remplacent **My games**
(5.2) et **New game** (Phase 5). Tout ce qui est chiffré vient du backend ; le front ne fait
qu'afficher et tenir le brouillon de la création.

**Accueil — `/`** (après connexion)
- **Mes personnages** : une fiche à onglet par personnage (l'univers sur l'onglet), les engagés
  d'abord (avec leur partie en cours : *Playing*, pastilles de points de vie, étiquette
  scénario · chapitre, bouton **Continue**), puis par dernière activité ; nom, profession. La
  fiche mène à la page du personnage.
- **Univers** : un couvercle de boîte vu d'en haut par univers où le joueur peut créer un
  personnage (libellé, ton), bouton **Create a character**.
- **États** : chargement (squelettes) ; aucun personnage (*« No character yet. »*, invitation à
  choisir un univers) ; erreur de chargement avec **Try again**.

**Création — `/worlds/:worldId/new-character`**, cinq étapes en intercalaires posés sur la
feuille de l'étape (faites cochées, en cours relevée), avec retour en arrière possible
jusqu'à la soumission ; le brouillon vit dans le composant (perdu si l'on quitte la page) :
1. **Dés** : sept fois 4D6, les trois meilleurs gardés, tirés par le backend et révélés à
   l'écran comme un jet en direct ; le dé écarté, désigné par le backend, se grise une fois posé
   (5.3.7, préférence d'animation *Dés*, `prefers-reduced-motion` en plancher). Le premier
   tirage part du bouton **Roll the dice**, jamais à l'arrivée sur la page. **Reroll** à
   volonté, qui remplace toute la série (et défait le placement). Les sept résultats sont
   empilés sur une colonne au téléphone, deux au-delà : quatre dés et leur total par ligne.
2. **Placement** : glisser ou attribuer chaque résultat à une caractéristique, chaque résultat
   une seule fois. Une mention signale que SIZ et INT ne descendent pas sous 8 ; la valeur
   relevée s'affiche telle que la renvoie l'aperçu.
3. **Profession** : les professions de l'univers, avec leur description, leurs compétences
   professionnelles et leur équipement de départ. Changer de profession efface les points
   professionnels déjà répartis (ils allaient aux compétences de l'ancienne), pas les points
   personnels.
4. **Compétences** : deux réserves affichées avec leur reste (professionnelle, sur les seules
   compétences de la profession ; personnelle, sur toutes), chaque compétence avec sa chance
   de base et sa valeur, le plafond de l'univers rappelé. Un reliquat est signalé, pas bloquant.
5. **Identité** : nom (35 caractères au plus, compteur), genre (*Female*, *Male*, *Neutral*).
   Récapitulatif, puis **Create**. Une erreur de validation renvoie à l'étape du champ fautif.

Le front ne calcule rien, même ici : à chaque changement du brouillon (avec un léger délai), il
l'envoie à l'**aperçu** (`POST /characters/preview`), qui renvoie la fiche calculée —
caractéristiques relevées, chance de base et valeur de chaque compétence, reste des réserves,
points de vie — et les refus par champ. C'est le même calcul que la création, sans écriture.

**Page d'un personnage — `/characters/:characterId`**
- Sa fiche (comme 5.3.4, sans l'état de partie) : nom, genre, profession, univers (sur
  l'onglet), caractéristiques, compétences. **Pas de points de vie** : ils n'existent que dans
  une partie, et s'affichent sur la carte de la partie en cours (tranché le 2026-11-06).
- **Partie en cours**, s'il y en a une : **Continue** (vers `/games/:gameId`) et **Abandon**,
  derrière une modale de confirmation (*« Abandon this scenario? »*, la partie passe en échec et
  ne se reprend pas) ; refusé pendant un tour en cours.
- **Scénarios disponibles** (s'il n'est pas engagé) : ceux de son univers qu'il n'a pas
  réussis, avec synopsis ; un scénario échoué est marqué (*Failed — try again*). **Play**
  lance une nouvelle partie. Un `game_master` y voit aussi les brouillons, marqués.
- **Parties passées** : échouées (supprimables, avec confirmation) et réussies ; chacune se
  relit.
- **Supprimer le personnage**, avec confirmation, seulement s'il n'est engagé dans aucune
  partie.

**Écran de jeu d'une partie close** (`failed`, et plus tard `completed`) : le journal se relit,
la zone de saisie laisse place, dans le plateau de dés, à une carte (*« This game is over. »*) et
un retour à la page du personnage. La carte du personnage de l'écran de jeu mène à la page du
personnage plutôt qu'à **My games**.

**Fiche (5.3.4)** : profession et genre s'ajoutent à l'identité.

---

## 6. Contrat avec le backend — besoins du front

Routes préfixées `/api/v1`. Les noms sont indicatifs ; ce qui compte est la donnée
disponible.

| Méthode | Route | État | Usage |
|---|---|---|---|
| `POST` | `/auth/login` | Existe, **à passer en cookie de session** | Connexion |
| `POST` | `/account/logout` | Existe, à adapter | Déconnexion |
| `GET` | `/account/profile` | Existe | Nom et initiales dans le menu du compte |
| `GET` | `/sessions/:id` | Existe (KAN-16), en-tête complété en Phase 12 | Partie, close comprise : statut, `endedAt`, personnage (fiche et état de la partie), scénario, libellés, tour en cours éventuel |
| `GET` | `/sessions/:id/turns` | Existe (KAN-16), paginée en Phase 9 (KAN-133) | Historique des tours aboutis, par pages de 20 (`?before=` un numéro de tour), `metadata.hasEarlier` |
| `GET` | `/sessions/:id/turns/:turnId` | Existe (KAN-16) | État et résultat d'un tour (rattrapage) |
| `POST` | `/sessions/:id/turns` | Existe, **à passer en `202` + clé d'idempotence** | Soumission |
| SSE | canal Transmit de la partie | **À créer** | Progression du tour (architecture, 8bis) |
| — | personnages, création, lancement, abandon | Existe (Phase 12, KAN-151) | Écrans 5.6 ; routes dans l'architecture, 8bis (« Personnages et parties d'un personnage »). `GET /sessions` a disparu : l'accueil lit `GET /characters` |

**Authentification** : cookie de session `httpOnly` ; aucun jeton stocké côté front. En
développement, le serveur Vite proxifie `/api` et `/__transmit` vers le backend (même
origine). Les requêtes mutantes portent l'en-tête CSRF attendu par `@adonisjs/shield`
(cookie `XSRF-TOKEN` relu et renvoyé en `X-XSRF-TOKEN`).

**Ce que le front attend de chaque réponse**, au-delà des valeurs brutes :
- chaque référence de contenu accompagnée de son **libellé** (`{ reference, label }`) ;
- la partie : univers, chapitre, statut, dernière activité, personnage complet, et
  l'identifiant du tour en cours s'il y en a un ;
- un tour d'historique : action du joueur, jet éventuel (depuis la Phase 6 en entier :
  compétence libellée ou caractéristique, valeur, difficulté, modificateurs avec leur valeur,
  chance, d100, `result`, `degree`), narration,
  effets visibles avec libellés — points de vie, déplacement, et depuis la Phase 4 ce qui est
  arrivé aux objets du personnage (`items` : `change` parmi `gained` / `lost` / `used_up` /
  `equipped` / `unequipped`, l'objet, la quantité, et le PNJ ou le lieu concerné quand il y en
  a un) ;
- `turn_completed` : de quoi mettre à jour le journal **et** la fiche sans nouvelle requête —
  inventaire compris depuis la Phase 4, lieu courant libellé, et depuis la Phase 7 la
  **période de la journée** (`period`, enum fermé du système, libellé par le front dans
  `enums.json`).

**Inventaire (Phase 4).** La fiche porte `character.inventory` : les objets que détient le
personnage, chacun en `{ handle, item: { reference, label }, quantity, equipped }`. Un objet
empilable n'a pas de `handle`. Un objet improvisé porte le libellé de son archétype ; son
descripteur, réservé au narrateur, ne sort jamais, pas plus que les modificateurs. Ce que
détiennent les PNJ et les lieux n'est pas exposé : le joueur l'apprend par la narration.

**Libellés en Phase 2 (KAN-15).** Faute de tables de contenu avant la Phase 5, les libellés
sont portés par la définition de l'univers codée en dur (`app/services/game/world.ts`) et
servis par un seul point d'accès côté backend (`ContentLabels`). Une référence sans libellé
fait échouer la réponse plutôt que d'afficher la référence brute. Pour que cela ne puisse
pas arriver en jeu, les lieux forment une **liste fermée** : un déplacement proposé par le
LLM hors de cette liste est rejeté par la validation du tour.

**Un tour se désigne par son identifiant**, pas par son numéro : un tour `pending` n'a pas
forcément encore de numéro (KAN-17). La lecture d'un tour renvoie son `status`, et pour un
tour `failed` son `failure` (`code`, `message`) — le même que `turn_failed`. Le front affiche la
traduction du `code` ; le `message` sert au débogage et de repli (section 5.3.6).

Exemple indicatif de la vue d'une partie :

```json
{
  "id": "…",
  "status": "in_progress",
  "lastActivityAt": "2026-09-21T14:02:00Z",
  "world": { "reference": "three_musketeers", "label": "The Three Musketeers" },
  "chapter": { "reference": "the_road_to_paris", "label": "The Road to Paris" },
  "character": {
    "name": "d'Artagnan",
    "hitPoints": 8,
    "hitPointsMax": 10,
    "characteristics": [{ "reference": "STR", "value": 13 }, { "reference": "CON", "value": 14 }],
    "skills": [{ "reference": "swordsmanship", "label": "Swordsmanship", "category": "combat", "value": 60 }],
    "resources": [{ "reference": "purse", "label": "Purse", "value": 15 }],
    "inventory": [
      { "handle": "letter_to_treville", "item": { "reference": "letter_to_treville", "label": "Letter for M. de Tréville" }, "quantity": 1, "equipped": false },
      { "handle": "rapier_1", "item": { "reference": "rapier", "label": "Rapier" }, "quantity": 1, "equipped": true }
    ]
  },
  "location": { "reference": "meung_sur_loire", "label": "Meung-sur-Loire" },
  "period": "morning",
  "activeQuests": [{ "reference": "deliver_the_letter", "label": "Deliver the letter", "summary": "Carry your father's letter to Monsieur de Tréville." }],
  "pendingTurn": null
}
```

---

## 7. Exigences non fonctionnelles

**Accessibilité**
- Contrastes WCAG AA dans les deux thèmes, y compris pour les couleurs d'issue de jet — qui
  ne portent jamais l'information seules (libellé toujours présent).
- Tout au clavier : navigation, envoi, ouverture et fermeture de la fiche, **Retry**.
- La narration qui arrive est annoncée aux lecteurs d'écran (région `aria-live="polite"`),
  les messages d'attente aussi, sans répétition bavarde.
- Respect de `prefers-reduced-motion`, plancher que les préférences ne lèvent jamais (5.5).

**Responsive** : de 360 px à l'écran large. Points de rupture Tailwind par défaut ; la
disposition à deux colonnes n'apparaît qu'à partir de `lg` (1024 px).

**Thèmes** : clair et sombre, **clair par défaut** depuis la refonte visuelle (KAN-160), choix
mémorisé ; *System* reste un choix possible. Le choix se fait dans les préférences (5.5).

**Internationalisation** : posée dès la Phase 2 avec **react-i18next** (i18next), même si elle
ne contient au départ que l'anglais. Ajouter une langue ne doit être qu'un travail de
traduction.
- **Pourquoi react-i18next** : les clés dynamiques avec repli sont natives, ce qu'exigent les
  codes d'erreur (`t(\`errors.${code}\`, { defaultValue: message })`, section 5.3.6) et les
  libellés d'enums ; les clés se typent à partir des fichiers anglais, sans étape de
  compilation ; un plugin ESLint (`no-literal-string`) détecte les textes en dur ; une langue
  supplémentaire se charge à la demande. Contrepartie acceptée : environ 20 ko gzippés, et
  des pluriels par suffixes plutôt qu'en ICU (plugin `i18next-icu` si un jour nécessaire).
- **Aucun texte d'interface en dur** dans les composants : libellés, messages d'état, textes
  d'accueil, attributs d'accessibilité (`aria-label`, `alt`) et libellés des enums du système
  passent tous par une clé de traduction.
- **Aucune chaîne assemblée par concaténation** : un message à variable (*« You arrive at
  {location} »*) est une clé avec interpolation, et un pluriel passe par les règles de
  pluriel de la bibliothèque. L'ordre des mots change d'une langue à l'autre.
- **Dates et nombres** formatés selon la langue active (`Intl`), jamais à la main : dernière
  activité relative, points de vie, compteur de caractères.
- **Langue active fixée à `en`** en Phase 2, sans sélecteur : le choix par le joueur arrive
  en Phase 14.
- **Ce que l'i18n ne couvre pas** : les références de contenu, dont le libellé vient du
  backend (principe 2), et la narration, produite par le LLM dans la langue de la partie. Les polices retenues couvrent le latin
étendu (accents, ligatures) : la narration sera un jour dans la langue du joueur.

**Sécurité**
- Le texte de narration est affiché comme **texte**, jamais interprété en HTML : il vient
  d'un LLM, lui-même alimenté par le texte du joueur. Pas de rendu Markdown en Phase 2 ; les
  sauts de paragraphe sont les seuls éléments de mise en forme.
- Aucun jeton en `localStorage` (voir *Stockage local*).

**Stockage local** (`localStorage`) — n'y vivent que deux choses :
- le **brouillon de saisie**, par partie (5.3.3) ;
- les **préférences d'interface** (5.5) : choix purement d'affichage, propres à un appareil,
  qui ne changent rien au jeu. Elles ne sont **jamais stockées en base** ni envoyées au
  backend, et le backend n'en a jamais besoin pour jouer un tour.

Rien d'autre : ni jeton, ni donnée de jeu, ni cache de réponses de l'API. Le stockage peut
être bloqué (navigation privée, données de site désactivées) : chaque lecture a alors sa
valeur par défaut, et un choix fait pendant la visite dure le temps de la visite. Une valeur
lue inconnue ou mal formée vaut le défaut, sans erreur. Les clés sont préfixées
`wanderlore.`. La déconnexion n'efface pas les préférences, qui ne sont pas des données
personnelles.

**Performance** : premier affichage de l'écran de jeu rapide sur mobile en 4G ; pas de
bibliothèque lourde pour le journal en Phase 2 (virtualisation inutile tant que
l'historique reste court).

**Tests** : la machine d'état du tour (5.3.5) et la table de correspondance des erreurs
(5.3.6) sont testées unitairement (Vitest), sans navigateur et sans backend — ce sont les
deux endroits où une régression casse l'expérience sans bruit. Le reste suit la règle du
projet : on ne teste pas le framework.

---

## 8. Direction visuelle

**« La table de jeu »**, validée le 2026-11-05 (epic KAN-160) sur les maquettes de
`apps/frontend/design/`. Elle remplace la direction de la Phase 2 (« un livre lu à la lampe »,
sombre par défaut). Les valeurs ci-dessous et `apps/frontend/design/table.css` font foi ; les
écarts des maquettes sont listés dans `apps/frontend/design/README.md`.

**Intention** : *une table de jeu*. Les éléments du jeu sont des objets posés sur la table :
le récit est écrit sur une feuille de papier, chaque jet tombe sur une petite carte tamponnée,
les points de vie sont des pastilles, les dés reposent dans un plateau creusé, le personnage est
une pile de fiches à onglets, le lieu une étiquette de papier. Ludique et tactile — c'est un
jeu, ni un livre ni un blog — mais calme et lisible : le récit reste au centre (principe 4).
Neutre vis-à-vis de l'univers (principe 6) : ni bois, ni cuir, ni feutre, ni parchemin, ni
ornement d'époque.

**Typographie**
- *Literata* pour le récit (16,5 px / 1,68 sur mobile, 18 px / 1,7 sur desktop, sans espacement
  de lettres négatif, colonne de ~70 caractères), les noms, les titres et le wordmark
  **WANDERLORE** (capitales, espacement 0,24 em).
- *Inter* pour tout ce qui est interactif ou mécanique : boutons, libellés, **les mots du
  joueur**, cartes de jet, tampons, nombres (chiffres tabulaires), valeurs de la fiche.
- Petits libellés en *Inter* 11 px, capitales espacées, encre atténuée. L'italique de la serif
  est réservé aux états d'attente et aux textes d'ambiance (ton d'un univers).

**Couleurs** — thème clair (par défaut)

| Rôle | Valeur |
|---|---|
| Table (fond) | `#EFE9DE`, lueur radiale et grain fin |
| Feuille du récit | `#FAF6EE` |
| Carte (fiche, carte de jet, étiquette) / carte dessous | `#FDFBF7` / `#F2ECE1` |
| Plateau de dés (creusé) | `#E5DFD3`, ombre intérieure |
| Encre principale / secondaire / atténuée | `#1C1917` / `#57534E` / `#736B63` |
| Accent — bleu encre (actions seulement) | `#1F3A5F` (survol `#162A45`), texte `#FFFFFF` |
| Points de vie — brique | `#B83A2E` |
| Réussite (tampon) | `#2D6A4F` sur `#E8F3ED` |
| Échec (tampon) | `#99382C` sur `#F8EBEA` |

**Thème sombre — « la table la nuit »** : table `#191612` sous une lueur de lampe, feuilles
`#2A2620`, cartes `#322D26`, plateau `#120F0C`, encre `#EDE6D6` / `#B5AB9B` / `#958B7B`, accent
`#8FB3E0` (texte `#10131A`), points de vie `#E0705F`, réussite `#7FBF9A`, échec `#E58A7C`. Les
dés restent ivoire. Jetons complets dans `table.css` (`:root[data-theme='dark']`).

- Un seul accent, réservé aux actions : envoyer, *Roll the dice*, *Retry*, *Continue*, liens,
  anneau de focus. Jamais pour un libellé, un indicateur d'attente ou une décoration.
- Les points de vie sont **toujours** en brique, jamais en vert, qui signifie une réussite.
- **Texture de la table** (fond seulement, jamais sur une feuille ou une carte) : une lueur
  radiale, des bords légèrement assombris et un grain fin, figés à l'écran. Opacités de
  quelques pour cent, contraste WCAG AA inchangé.

**Profondeur et formes** : papier sur papier — chaque objet porte une ombre douce et réaliste
(la feuille la plus marquée, les cartes moins), le plateau une ombre intérieure, une boîte de
dialogue une ombre forte au-dessus de la table assombrie. Coins faiblement arrondis : 3 à 4 px
pour les feuilles, cartes et tampons, 6 px pour les boutons et champs, 7 px en haut des onglets ;
pilules pour les seuls jetons d'effet (« −3 HP ») et interrupteurs. **Aucune carte de jet n'est
inclinée** ; les fiches sous la pile dépassent de quelques pixels, 1° au plus.

**Objets** (le vocabulaire de tous les écrans)
- *Feuille du récit* : une feuille continue portant les mots du joueur et la narration. Sur
  mobile, presque bord à bord avec un liseré de table autour.
- *Mots du joueur* : *Inter* 15–16 px medium, précédés d'un « › » à l'accent.
- *Carte de jet* : posée droite entre les mots du joueur et la narration, décalée vers la
  droite, bord gauche de 4 px à la couleur de l'issue, le jet en entier en *Inter*
  (« Persuasion 45% · Difficult · Advantage +10 · → 32% · rolled 27 ») et un **tampon** (issue,
  et en combat ce que le jet a fait : « Success · Hit », « Failure · Blow taken »). Les dégâts
  infligés sur une seconde ligne. Le tampon est à droite sur desktop, sous la ligne sur mobile.
- *Jeton d'effet* : brique pour les points de vie (« −3 HP »), carte de papier pour les autres
  effets (« You arrive at… »).
- *Pastilles de points de vie* : une pastille par point, pleines pour les points restants,
  cerclées pour les points perdus, suivies de « 11 / 14 ».
- *Étiquette du lieu* : petite étiquette percée, épinglée sur le bord haut de la feuille : le
  lieu et la période (« Hôtel de Laffemas · Paris — Dusk »), puis l'univers et le scénario. Jamais
  d'heure, de date ni de sorties. Le récit défile sous elle sans jamais passer dessous.
- *Plateau de dés* : creusé dans la table, glissé sous le bord bas de la feuille. Deux d10
  (dizaines, unités) **dessinés comme de vrais dés à dix faces**, ivoire, chiffres en *Inter* ;
  il montre le dernier jet et son tampon. Au jet en direct (5.3.7), il grandit : la carte du jet
  se construit, les dés montrent « ? », le bouton *Roll the dice* les lance.
- *Pile de fiches* : la fiche du personnage, onglets *Character*, *Inventory*, *Quests*. Sur
  mobile, la carte du personnage en haut de l'écran (nom, pastilles) porte les trois onglets
  accrochés sous elle, et la pile se lève au-dessus de la table assombrie ; sur desktop, la pile
  reste à droite (~400 px).
- *Bordereau de saisie* : « What do you do? », dictée, bouton d'envoi bleu encre ; verrouillé, un
  cadenas et « The game master is answering… ».
- *Note d'échec* : épinglée à la place de la narration, bord brique, message et *Retry* (plein) /
  *Edit* (contour).
- Hors partie : le wordmark et le jeton du compte (initiales) posés sur la table, sans barre
  d'application ; les personnages en fiches à onglet (l'univers sur l'onglet), les univers en
  couvercles de boîte vus d'en haut, la création en intercalaires numérotés.

**Correspondance avec l'avant-refonte** (intégrée en KAN-167, section 5 reprise) : l'en-tête
(5.3.1) est devenu la carte du personnage qui dépasse (mobile) et la barre du haut (desktop) ; le
bandeau de scène, l'étiquette du lieu ; la pastille de jet, la carte de jet ; la jauge de points
de vie, les pastilles (son animation : rebond et pulsation des pastilles) ; la carte de jet en
direct vit dans le plateau de dés. Hors partie, la barre d'application a disparu : le wordmark
et le jeton du compte sont posés sur la table.

**Mise en page** : mobile d'abord (390 px), sans barre de navigation en bas ni barre d'onglets.
Desktop à partir de 1024 px : la feuille au centre-gauche, le plateau et la saisie sous elle,
la pile de fiches à droite ; les points de vie aussi dans la barre du haut, pour rester visibles
quel que soit l'onglet ouvert.

**Mouvement** : animations brèves et en 2D — apparition en fondu de la narration, rebond des
pastilles quand les points de vie changent, points d'attente, lancer des dés (5.3.7), une boîte
de dialogue qui se soulève au-dessus de la table (ou la fiche qui monte du bas sur mobile) et
redescend en se refermant, un fondu discret à l'arrivée sur une page. Chacune se coupe dans les
préférences (5.5).

**Iconographie** : Lucide pour les icônes d'interface (retour, haut-parleur, micro, envoi,
cadenas, fermeture, corbeille). Les dés ne sont pas des icônes : d10 et d6 se dessinent en SVG.

---

## 9. Évolutions prévues par phase

Décrites pour que la structure les accueille ; **aucune ne s'implémente en Phase 2**.

- **Phase 3 — Narration en streaming.** L'événement `narration_chunk` réapparaît : la
  narration s'écrit progressivement à la place du message d'attente. Le rendu du journal doit
  donc accepter un bloc de narration qui grandit, sans saut de défilement. Cette narration
  reste **provisoire** : `turn_completed` la remplace par celle du tour reçu, et sur
  `turn_failed` elle est retirée au profit de l'encadré d'échec (architecture, section 8bis).
- **Phase 4 — Inventaire.** Un onglet **Inventory** dans la fiche : objets possédés et
  équipés, noms d'affichage fournis par le backend, en lecture seule. La fiche est conçue
  dès la Phase 2 comme un panneau capable d'accueillir des onglets. La pastille de jet
  mentionne l'objet qui a pesé sur le jet (avec sa valeur depuis la Phase 6).
- **Phase 5 — Multi-univers.** Un écran **New game** : choix d'un scénario dans un
  catalogue (univers, synopsis, ton), puis démarrage avec le personnage prétiré du
  scénario — aucune création de personnage avant la Phase 12. Le catalogue ne montre que
  les scénarios publiés ; un compte `game_master` y voit aussi les brouillons, pour les
  tester. Le nom de l'univers et tous les libellés viennent de la base. Le back-office est
  un package séparé.
- **Phase 6 — Bascule sur le BRP.** La fiche montre les sept caractéristiques, les
  compétences en pourcentage et les points de vie. **La pastille de jet montre désormais le
  détail du jet** : compétence ou caractéristique et sa valeur, modificateurs appliqués avec
  leur valeur (une circonstance par son label d'effet, un objet par son nom), chance finale,
  résultat du d100 et degré de réussite. Tout vient du backend, le front ne calcule rien.
- **Phase 7 — Temps et lieux.** La période de la journée (aube, matin… nuit) s'affiche à
  côté du lieu, dans le bandeau de scène (d'abord dans l'onglet *Situation*), libellée par l'i18n à partir de l'enum que transmet le
  backend. Ni l'heure, ni la date, ni les sorties du lieu ne s'affichent (tranché à
  l'ouverture de la phase) : l'information de jeu passe par le récit. Une carte des lieux
  visités reste une piste, sans phase. Le front ne calcule ni durée ni période.
- **Entre les Phases 7 et 8 — Jet en direct et préférences.** Lot d'interface sans
  changement d'API : le jet se lance à la main et s'anime (5.3.7) ; un écran de préférences
  (5.5) réunit le thème, la lecture à voix haute, le lancer automatique et les animations, le
  tout en stockage local.
- **Phase 9 — Mémoire long terme.** Le résumé ne s'affiche pas ; le journal est paginé
  (*Load earlier*, 5.3.2).
- **Phase 10 — Combat.** Combat en rounds, un round par tour (même pipeline, donc même
  journal). Jusqu'à deux jets du personnage par tour, l'attaque puis la défense, lancés l'un
  après l'autre ; les dégâts infligés s'affichent en détail, sans geste de lancer, les dégâts
  subis seulement par la perte de points de vie (5.3.2, 5.3.7, KAN-141). La lecture d'un tour
  porte `rolls` (liste) à la place de `roll`. Ni repère de round ni état de l'adversaire : le
  backend ne les transmet pas, le récit les porte.
- **Phase 11 — Échéances et événements déclenchés par le temps.** Pas d'impact visible : ce
  que l'horloge déclenche passe par le récit, comme le temps lui-même (Phase 7).
- **Phase 12 — Progression et cycle de vie.** Accueil par personnages et création de
  personnage guidée, page d'un personnage avec ses parties, abandon d'un scénario (5.6) — le
  prétiré et l'écran **New game** disparaissent ; puis progression du personnage en fin de
  scénario ; mise en pause et reprise ; écrans de fin (victoire, mort du personnage, abandon).
- **Phase 13 — Règles optionnelles par univers.** Santé mentale, passions et réputation
  sur la fiche, pour les seuls univers qui les emploient ; un jet caché n'affiche pas son
  détail.
- **Phase 13bis — Pouvoirs et espèces non humaines.** Points de pouvoir, pouvoirs connus,
  espèce et traits sur la fiche ; étape *espèce* dans la création, pour les seuls univers qui
  en déclarent.
- **Phase 14 — Ouverture.** Inscription, validation d'email, mot de passe oublié ; choix de la
  langue de la partie et de l'interface (traductions ajoutées à l'i18n posée en Phase 2) ; paramètres du
  compte ; messages de modération.

---

## 10. Maquettes

### Méthode

Depuis la refonte visuelle (KAN-160), les maquettes sont **écrites en HTML/CSS**, plus générées
par Google Stitch. Stitch a servi à explorer quatre directions sur l'écran de jeu ; décliné sur
tous les écrans, il redessinait chaque écran à partir de zéro, et le même objet (étiquette,
dés, onglets, saisie) changeait d'un écran à l'autre. Les maquettes reposent désormais sur une
feuille de styles commune et des fonctions partagées : un objet est identique partout.

- **Contenu réel** : textes d'interface repris des fichiers de traduction du front, contenu
  repris des univers en code — jamais de *lorem ipsum* ni de libellé inventé.
- **Vérifier chaque maquette contre les principes de la section 1** et lister les écarts dans
  le README des maquettes.
- Les maquettes d'une phase à venir sont étiquetées comme des explorations.

### Livrables et dépôt

Les maquettes validées sont versionnées dans **`apps/frontend/design/`** :
- `table.css` : la feuille de styles commune (jetons des deux thèmes, composants) ;
- `<écran>.html` : chaque écran en page statique, une seule page pour le mobile et le desktop
  (bascule à 1024 px) ;
- `<écran>-mobile.webp` et `<écran>-desktop.webp` : les captures du rendu attendu (390 px en
  densité 2x, 1440 × 900) ;
- `src/` : les sources (`screens.js`, `screen.html#<écran>`, `#<écran>-dark` pour la nuit, et la
  page de revue `review.html`), d'où les exports se régénèrent.

Nommage : identifiant de l'écran puis nom court — `g1-game`, `s2-home`, `c4-skills`. Les
captures sont en WebP : le grain de la texture rend le PNG dix à quinze fois plus lourd.

**Ces fichiers sont une référence visuelle, pas du code à reprendre.** À l'intégration :
- les jetons de `table.css` alimentent la configuration Tailwind du socle ;
- chaque écran est redécoupé en composants React branchés sur les vraies données et sur les
  machines d'état du tour (5.3.5) et du jet en direct ;
- les icônes sont remplacées par Lucide (section 8) ;
- tout ce qui contredit la section 1 est retiré, même présent sur une maquette validée.

---

## 11. Points ouverts

- **Délai de rattrapage** sans événement SSE avant relecture de l'état du tour (5.3.5).
- **Direction visuelle** (section 8) : « la table de jeu », validée le 2026-11-05 (KAN-160),
  à intégrer. Les écarts des maquettes sont listés dans `apps/frontend/design/README.md`.
