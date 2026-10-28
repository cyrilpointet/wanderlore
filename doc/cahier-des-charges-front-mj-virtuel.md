# Cahier des charges — Front joueur

## Document de référence technique

**Périmètre** : le package `apps/frontend`, c'est-à-dire l'interface du rôle `player`. Le
back-office (`game_master`, `superadmin`) est un package distinct, introduit en Phase 5, et
n'est pas couvert ici.

**Double usage** :
1. **Référence** pour implémenter le front, phase par phase. La Phase 2 est spécifiée en
   détail ; les phases suivantes sont décrites comme des évolutions, pour que la structure
   des écrans les accueille sans refonte.
2. **Base de génération des maquettes** avec Google Stitch. La section 10 fournit le
   préambule de style, le contenu d'exemple et un prompt prêt à l'emploi par écran.

**Documents complémentaires** : roadmap (Phase 2, décisions de cadrage), architecture
(section 8bis, contrat SSE), système de règles (section 4, marges). En cas de divergence,
ces documents font foi sur le fond ; celui-ci fait foi sur l'interface.

> **⚠️ Convention de langue** : ce document est en français. Tous les textes d'interface
> qu'il cite sont en **anglais**, langue par défaut de l'application, et les prompts Stitch
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
| 10 | Création de personnage guidée, combat en rounds, pause / reprise, écrans de fin |
| 10bis | Santé mentale, passions et réputation sur la fiche, selon l'univers |
| 11 | Inscription, mot de passe oublié, choix de la langue, paramètres du compte |

Les évolutions des phases 3 à 11 sont détaillées en section 9. **Elles ne s'implémentent pas
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
existe côté backend, mais le front ne l'expose pas avant la Phase 11.

---

## 5. Écrans Phase 2

Routes indicatives, gérées par TanStack Router. Toutes sauf `/login` exigent d'être
authentifié.

### 5.1 Connexion — `/login`

**Objectif** : s'authentifier, rien d'autre.

- Nom de l'application (wordmark **Wanderlore**) et une accroche d'une ligne :
  *« Your solo tabletop adventure, with a game master who never cancels. »* (à affiner).
- Champs **Email** et **Password**, bouton **Sign in**.
- Aucun lien d'inscription ni de mot de passe oublié.

**États** : envoi en cours (bouton désactivé, indicateur) ; identifiants refusés
(*« Invalid email or password. »*, sous le formulaire, champs conservés) ; erreur réseau.

**Après connexion** : redirection vers la page demandée avant l'authentification si elle
existe, sinon `/games`.

### 5.2 Mes parties — `/games`

**Objectif** : retrouver et reprendre une partie.

Une carte par partie, triées par dernière activité :
- nom du personnage (titre de la carte) ;
- univers (*The Three Musketeers*) et chapitre en cours (*The Road to Paris*) — libellés
  fournis par le backend ;
- statut (`in_progress` → *In progress*, `paused` → *Paused*, `completed` → *Completed*) ;
- dernière activité en relatif (*« 2 hours ago »*) ;
- points de vie actuels, en petit (repère visuel rapide).

Toute la carte est cliquable → `/games/:gameId`.

**États** : chargement (squelettes de cartes) ; aucune partie (*« No game yet. »* — pas de
bouton de création en Phase 2) ; erreur de chargement avec **Try again**.

L'en-tête porte le wordmark et le menu du compte (nom ou initiales, **Preferences**,
**Sign out**).

### 5.3 Partie — `/games/:gameId`

L'écran principal. Trois zones : **en-tête**, **journal**, **fiche du personnage**, plus la
**zone de saisie** en pied du journal.

**Disposition**
- **Desktop (≥ 1024 px)** : journal au centre, colonne de lecture limitée à ~70 caractères
  par ligne ; fiche en colonne latérale droite fixe (~320 px).
- **Tablette et mobile** : journal plein écran. La fiche s'ouvre dans un panneau (tiroir
  latéral ou *bottom sheet*) depuis un bouton de l'en-tête. Les points de vie restent
  visibles en permanence dans l'en-tête.
- La zone de saisie reste collée en bas de l'écran ; sur mobile, elle reste visible au-dessus
  du clavier virtuel.

#### 5.3.1 En-tête

- Retour à **My games**.
- Nom du personnage et, en dessous, univers · chapitre.
- Jauge compacte de points de vie (`8 / 10`) — visible sur toutes les tailles d'écran.
- Bouton d'ouverture de la fiche (mobile et tablette uniquement).
- Bouton de lecture à voix haute (icône, toutes tailles d'écran), si le navigateur sait lire :
  il reste sur l'écran de jeu pour couper ou rétablir la voix d'un geste, et double le réglage
  des préférences (5.5) — un seul réglage, deux accès, toujours d'accord.
- Menu du compte.

#### 5.3.2 Journal

Le récit, du plus ancien au plus récent, défilé automatiquement vers le bas à l'arrivée d'un
nouvel élément — sauf si le joueur est remonté lire l'historique (il voit alors un bouton
**New message ↓**).

Le journal se lit comme un livre, pas comme une messagerie. Types d'éléments :

| Élément | Contenu | Rendu |
|---|---|---|
| **Action du joueur** | Texte saisi, tel quel | Bloc compact, discret, marqué « You » ; typographie d'interface ; retrait ou teinte légère pour le distinguer du récit |
| **Jet** | Le jet en entier : *« Persuasion 60% · Difficult · Advantage +10 · → 40% · rolled 12 · Special success »* | Pastille centrée entre l'action et la narration, couleur selon l'issue, petite icône de dé ; la chance n'est montrée que quand elle diffère de la valeur, la difficulté que quand elle n'est pas `average`. Pendant le tour en cours, carte de jet en direct (5.3.7), repliée en pastille une fois le résultat révélé |
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

**Historique long** : chargé en entier en Phase 2. Une pagination vers le haut (**Load
earlier**) sera à prévoir quand les parties s'allongeront (Phase 9) ; la structure du
journal doit la permettre.

#### 5.3.3 Zone de saisie

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
- **Points de vie** : jauge et valeur `8 / 10`. Couleur qui se dégrade en dessous du tiers.
  Brève animation quand la valeur change à la fin d'un tour.
- **Caractéristiques** : les sept du BRP, *Strength 13 · Constitution 14 · Size 12…*
  (Phase 6 ; elles remplacent les attributs).
- **Compétences**, groupées sous leur catégorie du BRP, en pourcentage. Seules les
  compétences que le personnage a entraînées.
- **Ressources** : *Purse 15*.
- **Situation** : lieu actuel et quête en cours avec son résumé. Retenu en Phase 2 (KAN-15) :
  l'état d'accueil d'une partie neuve exige déjà ces données, et le bloc sert la reprise
  après interruption. Depuis la Phase 7, la **période de la journée** (*Dusk*) sous le lieu —
  jamais l'heure, la date ni le numéro de jour, et jamais les sorties du lieu : le joueur les
  apprend par le récit, par les moyens de son personnage (une montre pour l'heure). Une pièce
  d'un réseau s'affiche suivie du lieu qui la contient (*The kitchen · Ward House*), libellé
  construit par le backend.

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
| — | `roll_resolved` | Carte de jet en direct (5.3.7) ; la narration qui suit est retenue jusqu'à la révélation |
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
présentation et l'action proposée.

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

1. **Préparation** — à `roll_resolved`, une carte de jet prend la place de la pastille : la
   compétence ou la caractéristique et sa valeur, la difficulté si elle n'est pas `average`,
   puis chaque modificateur, qui s'ajoute l'un après l'autre, et la chance finale. Une jauge
   de 0 à 100 porte **le seul seuil de la chance** : ni zone de critique ou de spécial, ni
   plages 01–05 et 96–00, qui reviendraient à recalculer les règles côté front. Un bouton
   **Roll the dice** reçoit le focus (Entrée ou Espace le déclenchent).
2. **Lancer** — deux d10, dizaines et unités, défilent environ une seconde ; les dizaines
   s'arrêtent d'abord, les unités ensuite, sur le d100 transmis. Un marqueur glisse sur la
   jauge jusqu'à cette valeur.
3. **Révélation** — le degré apparaît, avec un accent pour `critical` et `fumble` ; la carte
   se replie en pastille (5.3.2), puis la narration retenue apparaît en fondu et poursuit son
   écriture.

**Narration retenue** : les fragments reçus avant la révélation sont conservés, pas affichés.
`turn_completed` peut arriver avant le clic : le tour est alors **retenu** à la place du tour en
cours, la même carte à l'écran, et la saisie reste verrouillée (5.3.3). Il ne rejoint le
journal, la fiche et la lecture à voix haute qu'à la révélation : sinon les points de vie de
l'en-tête ou la voix trahiraient l'issue avant les dés. Sur `turn_failed`, la révélation a
lieu aussitôt, puis l'encadré d'échec remplace la narration comme d'ordinaire.

**Jamais rejoué** : un tour relu (réouverture de l'écran, rattrapage, historique) affiche
directement la pastille et sa narration. Seul un `roll_resolved` reçu en direct ouvre la
carte.

**Préférences** (5.5) : avec le **lancer automatique**, la carte enchaîne seule la
préparation et le lancer, sans bouton ; avec l'**animation des dés** coupée, la révélation est
immédiate (le bouton reste, sauf lancer automatique). Les deux réglages sont indépendants.

**Accessibilité** : les dés et la jauge sont masqués aux lecteurs d'écran (`aria-hidden`) ; le
jet complet est annoncé une fois, à la révélation. Les couleurs d'issue doublent le libellé du
degré, jamais l'inverse.

**Mise en œuvre** : la révélation suit une petite machine pure, distincte de `turnReducer`
(qui repasse à `idle` sur `turn_completed`), attachée à l'identifiant du tour —
`staged → rolling → landed → revealed`. Elle est testée unitairement, et chaque état de la
carte en HTML statique.

### 5.4 Pages système

- **Introuvable** (route inconnue ou partie inaccessible) : message court, retour à
  **My games**.
- **Erreur inattendue** : message générique, bouton de rechargement. Jamais de trace
  technique à l'écran.

### 5.5 Préférences

Ouvertes depuis le menu du compte (**Preferences**), dans une feuille de dialogue. Ce sont
des **choix d'interface propres à un appareil** : stockés dans le navigateur (section 7,
*Stockage local*), **jamais en base**, jamais transmis au backend. Ils ne suivent donc pas le
joueur d'un appareil à l'autre, et un appareil partagé par plusieurs comptes les partage.
Une modification prend effet immédiatement, sans bouton d'enregistrement.

| Groupe | Réglage | Valeurs | Défaut |
|---|---|---|---|
| Apparence | Thème | *System* / *Dark* / *Light* | *System* (sombre si le système n'exprime rien) |
| Narration | Lecture à voix haute | on / off | on — si le navigateur sait lire ; doublé par le bouton de l'en-tête de l'écran de jeu (5.3.1) |
| Dés | Lancer automatique | on / off | off |
| Animations | Dés | on / off | on |
| Animations | Apparition de la narration | on / off | on |
| Animations | Jauge de points de vie | on / off | on |

**Animations et `prefers-reduced-motion`** : le réglage du système est un **plancher**. Quand il
demande moins de mouvement, toutes les animations sont coupées quoi qu'indiquent les
préférences, et leurs interrupteurs s'affichent désactivés, avec la mention que le système en
décide. Les indicateurs d'état (points d'attente, chargement) ne sont pas des animations
réglables : ils signalent un état, et le réglage du système suffit à les figer.

La liste des animations réglables grandit avec elles : toute nouvelle animation notable
(au-delà d'une transition de survol) y prend sa ligne.

---

## 6. Contrat avec le backend — besoins du front

Routes préfixées `/api/v1`. Les noms sont indicatifs ; ce qui compte est la donnée
disponible.

| Méthode | Route | État | Usage |
|---|---|---|---|
| `POST` | `/auth/login` | Existe, **à passer en cookie de session** | Connexion |
| `POST` | `/account/logout` | Existe, à adapter | Déconnexion |
| `GET` | `/account/profile` | Existe | Nom et initiales dans le menu du compte |
| `GET` | `/sessions` | Existe (KAN-16) | Liste des parties (5.2) |
| `GET` | `/sessions/:id` | Existe (KAN-16) | Partie : personnage, libellés, tour en cours éventuel |
| `GET` | `/sessions/:id/turns` | Existe (KAN-16) | Historique des tours aboutis |
| `GET` | `/sessions/:id/turns/:turnId` | Existe (KAN-16) | État et résultat d'un tour (rattrapage) |
| `POST` | `/sessions/:id/turns` | Existe, **à passer en `202` + clé d'idempotence** | Soumission |
| SSE | canal Transmit de la partie | **À créer** | Progression du tour (architecture, 8bis) |

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

**Thèmes** : clair et sombre, sombre par défaut, choix mémorisé ; suit le système si le
joueur n'a rien choisi. Le choix se fait dans les préférences (5.5).

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
  en Phase 11.
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

Validée sur les maquettes de la Phase 2 (KAN-20, `apps/frontend/design/`). Les valeurs
ci-dessous font foi ; les exports Stitch en sont une illustration, avec des écarts listés dans
`apps/frontend/design/README.md`.

**Intention** : *un livre qu'on lit à la lueur d'une lampe, avec la feuille de personnage
posée à côté*. Calme, lisible, concentré sur le texte. Inspiré de la table de jeu, sans
folklore : ni parchemin texturé, ni dragons, ni polices gothiques — l'univers change d'une
partie à l'autre, l'habillage ne doit pas en choisir un.

**Typographie**
- Narration : *Literata*, 18 px / interligne 29 px sur desktop, 16 px / interligne 26 px
  sur mobile, sans espacement de lettres négatif. Colonne de lecture limitée à ~70 caractères
  (~680 px). L'italique est réservé aux états d'attente et aux murmures narratifs.
- Interface : *Inter* — corps 15 px, libellés 13 px, métadonnées 11 px (capitales espacées).
- Titres (nom du personnage, « My games ») : *Literata*, 20 à 32 px selon le niveau.
- Actions du joueur : *Inter*, jamais la serif — c'est ce qui les distingue de la narration.
- Wordmark **Wanderlore** : *Literata* 16 px, capitales, espacement 0,22 em.

**Couleurs** — thème sombre (par défaut)

| Rôle | Valeur |
|---|---|
| Fond (niveau 0) | `#15130F` |
| Surfaces : header, saisie, fiche (niveau 1) | `#1E1B16` |
| Cartes, puces (niveau 2) | `#28241E` |
| Feuille ouverte, popovers (niveau 3) | `#332E27` |
| Bordures fines / actives | `#2E2922` / `#3A342C` |
| Texte principal / secondaire / métadonnées | `#EDE6D6` / `#A89F91` / `#787063` |
| Accent laiton (survol) | `#D49B44` (`#C88D37`) |
| Réussite — vert sauge | `#7A9A7B` |
| Échec et points de vie — rouge brique | `#B85C50` |

- Un seul accent, réservé aux actions : envoyer, *Retry*, liens, anneau de focus. Jamais
  pour un libellé, un indicateur d'attente ou une décoration.
- Les points de vie sont **toujours** en rouge brique — jamais en vert, qui signifie une
  réussite de jet. Dégradé vers l'ambre quand ils baissent (à confirmer à l'intégration).
- Thème clair : fond papier (proche de `#F6F1E7`), texte encre — non maquetté en Phase 2.

**Formes et mouvement** : coins faiblement arrondis — 4 px pour les puces et badges, 6 à
8 px pour les champs, cartes et boutons ; pas de pilule, sauf les petits boutons-icônes
ronds. Bordures fines plutôt qu'ombres, la profondeur venant des niveaux de surface ; seule
la feuille ouverte porte une ombre ambiante. Beaucoup d'espace. Animations brèves :
apparition en fondu de la narration, pulsation de la jauge de points de vie quand elle
change, points de suspension animés pour l'attente, et le jet en direct (5.3.7), en 2D — pas
de dés en trois dimensions ni de moteur physique. Chacune se coupe dans les préférences
(5.5).

**Composants récurrents** (tels que maquettés)
- *Action du joueur* : libellé « You » en métadonnée neutre, texte en *Inter*, filet laiton
  de 2 px à gauche.
- *Puce de jet* : centrée entre l'action et la narration, icône de dé, le jet en entier
  (« Compétence 60% · modificateurs · d100 · Degré »), teinte sémantique sur fond atténué.
- *Carte de jet en direct* (5.3.7) : même emplacement, surface légèrement relevée ; la ligne
  du jet qui se construit, une jauge fine de 0 à 100 marquée au seul seuil de la chance, deux
  tuiles de d10 (dizaines, unités) en chiffres de l'interface, le bouton *Roll the dice*
  (plein), puis le degré. Se replie en puce.
- *Ligne d'effets* : sous la narration, discrète, icône et couleur sémantique (« −2 HP »).
- *Carte d'erreur* : à la place de la narration, liseré rouge brique sans fond rouge,
  message et boutons *Retry* (plein) / *Edit* (contour).
- *Fiche* : caractéristiques, compétences en retrait sous leur catégorie, ressources, bloc
  « Situation » ;
  colonne de 320 px sur desktop, feuille couvrant les deux tiers de l'écran sur mobile.

**Iconographie** : jeu d'icônes linéaire (Lucide, courant avec React). Une icône de dé pour
les jets, un cœur pour les points de vie, une épingle de carte pour les lieux. Les exports
Stitch utilisent Material Symbols, à remplacer.

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
  scénario — aucune création de personnage avant la Phase 10. Le catalogue ne montre que
  les scénarios publiés ; un compte `game_master` y voit aussi les brouillons, pour les
  tester. Le nom de l'univers et tous les libellés viennent de la base. Le back-office est
  un package séparé.
- **Phase 6 — Bascule sur le BRP.** La fiche montre les sept caractéristiques, les
  compétences en pourcentage et les points de vie. **La pastille de jet montre désormais le
  détail du jet** : compétence ou caractéristique et sa valeur, modificateurs appliqués avec
  leur valeur (une circonstance par son label d'effet, un objet par son nom), chance finale,
  résultat du d100 et degré de réussite. Tout vient du backend, le front ne calcule rien.
- **Phase 7 — Temps et lieux.** La période de la journée (aube, matin… nuit) s'affiche sous
  le lieu, dans l'onglet *Situation*, libellée par l'i18n à partir de l'enum que transmet le
  backend. Ni l'heure, ni la date, ni les sorties du lieu ne s'affichent (tranché à
  l'ouverture de la phase) : l'information de jeu passe par le récit. Une carte des lieux
  visités reste une piste, sans phase. Le front ne calcule ni durée ni période.
- **Entre les Phases 7 et 8 — Jet en direct et préférences.** Lot d'interface sans
  changement d'API : le jet se lance à la main et s'anime (5.3.7) ; un écran de préférences
  (5.5) réunit le thème, la lecture à voix haute, le lancer automatique et les animations, le
  tout en stockage local. Les zones de degré sur la jauge attendraient que le backend
  transmette les seuils dans `roll_resolved`.
- **Phase 9 — Mémoire long terme.** Pas d'impact visible ; la pagination du journal devient
  probablement nécessaire.
- **Phase 10 — Cycle de vie et combat.** Création de personnage guidée ; combat en rounds
  (même pipeline, donc même journal, avec un repère visuel de round et l'état de
  l'adversaire si le backend le transmet) ; mise en pause et reprise ; écrans de fin
  (victoire, mort du personnage, abandon).
- **Phase 10bis — Règles optionnelles par univers.** Santé mentale, passions et réputation
  sur la fiche, pour les seuls univers qui les emploient ; un jet caché n'affiche pas son
  détail.
- **Phase 11 — Ouverture.** Inscription, validation d'email, mot de passe oublié ; choix de la
  langue de la partie et de l'interface (traductions ajoutées à l'i18n posée en Phase 2) ; paramètres du
  compte ; messages de modération.

---

## 10. Génération des maquettes avec Stitch

### Méthode

- **Un écran par prompt**, et un état par écran quand l'état change la mise en page (attente,
  échec, partie neuve). Stitch produit mieux un écran précis qu'un parcours entier.
- **Toujours coller le préambule** ci-dessous en tête du prompt, pour garder un système
  visuel cohérent d'un écran à l'autre.
- **Mobile d'abord** : générer la version téléphone, puis demander la déclinaison desktop.
- **Contenu réel** : utiliser le contenu d'exemple ci-dessous plutôt que du *lorem ipsum* —
  la narration est l'élément principal, sa longueur réelle conditionne la mise en page.
- **Itérer par petites retouches** (« make the roll chip smaller ») plutôt que de réécrire
  le prompt.
- **Vérifier chaque maquette contre les principes de la section 1.** Stitch invente
  volontiers ce qui manque : chiffres de dés, inventaire, bouton d'inscription, avatars
  générés, barre de navigation à onglets. Tout cela est à retirer en Phase 2.
- Générer d'abord les écrans de la Phase 2. Les écrans des phases suivantes ne se génèrent
  qu'en exploration, clairement étiquetés comme tels.

### Livrables et dépôt

Les maquettes validées sont versionnées dans **`apps/frontend/design/`**, pour que
l'intégration se fasse depuis le dépôt plutôt que depuis Stitch : le projet Stitch peut encore
évoluer ou être retouché, le dépôt fige la version validée. Stitch est accessible depuis Claude
Code par son serveur MCP (génération, lecture et export des écrans), mais l'intégration ne s'y
réfère pas.

Pour chaque écran et chaque format, deux fichiers au même nom :
- **l'export HTML de Stitch** (option *Code*) : la source de référence pour les couleurs,
  espacements, tailles et structure ;
- **une capture PNG** : le rendu attendu, pour vérifier l'intégration à l'œil.

Nommage : identifiant de l'écran, nom court, format — `s1-login-mobile.html`,
`s1-login-mobile.png`, `s3-game-desktop.html`… Un écran généré dans un seul format ne porte
que celui-là. L'export Figma n'est pas un livrable : il n'est pas lisible depuis le dépôt.

**Ces fichiers sont une référence visuelle, pas du code à reprendre.** Le HTML exporté est une
page statique : sans états, sans données réelles, avec des images de remplacement et souvent
des icônes Material Symbols. À l'intégration :
- les couleurs et polices alimentent la configuration Tailwind du socle ;
- chaque écran est redécoupé en composants React branchés sur les vraies données et sur la
  machine d'état du tour (5.3.5) ;
- les icônes sont remplacées par Lucide (section 8) ;
- tout ce qui contredit la section 1 est retiré, même présent sur une maquette validée.

### Préambule de style (à coller en tête de chaque prompt)

```
Design system for "Wanderlore", a web app for playing solo tabletop role-playing games with
an AI game master, in a chat-like interface. Audience: experienced pen-and-paper RPG players.

Mood: a book read by lamplight, with a character sheet lying next to it. Calm, literary,
focused on reading. Tabletop-inspired but setting-neutral: no parchment textures, no dragons,
no gothic fonts, no fantasy ornaments — the app hosts many different settings.

Theme: dark by default. Background warm ink (#15130F), slightly lighter surfaces, cream text
(#EDE6D6). Single accent colour, brass/amber, used only for actions. Muted semantic colours:
sage green for success, brick red for failure and hit points.

Typography: narration in a readable serif (Literata), 18px, line-height 1.6, max ~70
characters per line. Interface in a neutral sans-serif (Inter), 14–16px. The "Wanderlore"
wordmark in the serif, small caps, letter-spaced.

Shapes: subtle 4–8px radius, thin borders rather than shadows, generous whitespace. Linear
icons (Lucide style). All interface text in English.

Never show dice numbers, target numbers or roll totals. Never show an inventory. Never show a
sign-up link.
```

### Contenu d'exemple

```
Game: d'Artagnan — The Three Musketeers · The Road to Paris — In progress — 2 hours ago
Character: d'Artagnan. Hit points 8 / 10.
Characteristics: Strength 13, Constitution 14, Size 12, Intelligence 13, Power 12,
                 Dexterity 16, Charisma 14.
Skills — Combat: Swordsmanship 60%. Physical: Athletics 30%. Perception: Observation 30%.
         Communication: Persuasion 45%, Etiquette 30%.
Resources: Purse 15.
Location: Meung-sur-Loire.
Quest: Deliver the letter — Carry your father's letter to Monsieur de Tréville.

Turn 1
You: I ride into the courtyard of the Jolly Miller inn and look around.
Narration: The courtyard of the Jolly Miller smells of wet straw and woodsmoke. A few
townsmen idle by the well; one of them points at your yellow horse and laughs. Near a
window on the ground floor, a gentleman in a dark cloak watches you with open contempt, a
thin scar running along his temple.

Turn 2
You: I ask the innkeeper who the gentleman in the dark cloak is.
Roll: Persuasion 45% · rolled 23 · Success
Narration: The innkeeper glances toward the courtyard, then leans across the counter and
lowers his voice. "A gentleman who pays well and asks no questions, monsieur. He came from
Paris this morning and speaks of nobody but a certain milady." Beyond the window, the
stranger folds a letter and slides it into his doublet, his scarred face turned your way.

Turn 3
You: I walk up to him and demand that he apologise for laughing at my horse.
Roll: Etiquette · Failure
Narration: Your words come out sharper than you meant. The stranger does not even turn his
head. Two of his servants step between you, and one of them shoves you hard against the
doorframe. By the time you steady yourself, the gentleman has gone back inside.
Effects: −2 HP

Turn in progress
You: I draw my sword and follow him inside.
Roll: Swordsmanship 60% · rolled 58 · Success
Status: The game master tells what happens…

Failed turn
You: I challenge him to a duel in the name of my father.
Error: The game master took too long to answer. Try your action again.
Actions: Retry, Edit
```

### Prompts par écran

Chaque prompt ci-dessous se colle **après** le préambule, avec le contenu d'exemple utile.

**S1 — Connexion (mobile, puis desktop)**
```
Mobile sign-in screen. Centered column: the "Wanderlore" wordmark, a one-line tagline
"Your solo tabletop adventure, with a game master who never cancels.", then an Email field,
a Password field and a full-width "Sign in" button in the accent colour. Below the form, an
inline error message "Invalid email or password." in muted brick red. Nothing else: no
sign-up link, no forgot-password link, no social login.
```

**S2 — Mes parties (mobile, puis desktop)**
```
Mobile "My games" screen. Top bar: "Wanderlore" wordmark on the left, account initials
button on the right. Page title "My games". A vertical list of game cards; each card shows
the character name as title, "The Three Musketeers · The Road to Paris" underneath, a small
status badge "In progress", "2 hours ago", and a compact hit points indicator "8 / 10" with
a heart icon. The whole card is clickable. No "new game" button. Show two cards, the second
one "Paused".
```

**S3 — Partie, desktop, état normal**
```
Desktop game screen, 1440px wide. Header: back link "My games", then "d'Artagnan" with
"The Three Musketeers · The Road to Paris" underneath, a compact hit points bar "8 / 10" on
the right, and account initials. Main area: a centered reading column (max ~70 characters
per line) showing the story log from the sample content, turns 1 to 3. Player actions are
compact, discreet blocks labelled "You", in the sans-serif, slightly tinted. Narration is
full-width serif prose with no bubble, like a book page. Between action and narration, a
small centered chip with a dice icon and the roll in full: "Persuasion 45% · rolled 23 ·
Success" in sage green, "Etiquette 30% · rolled 71 · Failure" in brick red. Under the narration of turn 3, a discreet effects
line: heart icon "−2 HP". At the bottom, a sticky multi-line input with placeholder
"What do you do?" and a send button in the accent colour.
Right sidebar, 320px, the read-only character sheet: name, hit points bar 8 / 10, the seven
characteristics in two columns (Strength 13…), skills in percent grouped under their category,
"Purse 15", then a "Situation" block with location "Meung-sur-Loire" (map pin icon) and the
quest "Deliver the letter" with its one-line summary.
```

**S4 — Partie, mobile, état normal et fiche ouverte**
```
Mobile version of the game screen. Header: back arrow, "d'Artagnan" with "The Road to Paris"
underneath, a compact hit points indicator "8 / 10", and a character-sheet button. Full-width
story log with turns 2 and 3 from the sample content, same styles as desktop. Sticky input
at the bottom with a send button.
Second screen: the same view with the character sheet open as a bottom sheet covering two
thirds of the screen, with a drag handle and a close button, showing the full sheet.
```

**S5 — Partie, tour en cours**
```
Mobile game screen while a turn is being played. The last player action "I draw my sword
and follow him inside." is shown, then the roll chip "Swordsmanship 60% · rolled 58 · Success"
(sage green), then an animated waiting line in italic: "The game master tells what
happens…" with three pulsing dots. The input at the bottom is disabled and dimmed, with the
hint "The game master is answering…".
```

**S6 — Partie, tour échoué**
```
Mobile game screen after a failed turn. The last player action "I challenge him to a duel in
the name of my father." is followed, instead of narration, by a sober alert card with a thin
brick-red border: the message "The game master took too long to answer. Try your action
again." and two buttons, "Retry" (accent colour) and "Edit" (secondary). The input at the
bottom is enabled and empty.
```

**S7 — Partie neuve**
```
Mobile game screen for a game with no turn yet. The story log shows a centered welcome
state: the character name "d'Artagnan", the starting location "Meung-sur-Loire" with a map
pin icon, the quest "Deliver the letter — Carry your father's letter to Monsieur de
Tréville.", and the serif line "Your story begins. What do you do?". The input at the bottom
is focused.
```

---

## 11. Points ouverts

- **Délai de rattrapage** sans événement SSE avant relecture de l'état du tour (5.3.5).
- **Direction visuelle** (section 8) : validée sur les maquettes de la Phase 2 (KAN-20). Reste
  ouvert : le dégradé des points de vie vers l'ambre, et le thème clair, non maquetté.
