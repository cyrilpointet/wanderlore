# Maquettes — « La table de jeu »

Maquettes du front joueur après la refonte visuelle (epic KAN-160), validées par le product
owner le 2026-11-05. Elles remplacent les maquettes Stitch de la Phase 2 (KAN-20), qui restent
dans l'historique git.

**Direction** : les éléments du jeu sont des objets posés sur une table. Le récit est écrit sur
une feuille de papier, chaque jet tombe sur une petite carte tamponnée, les points de vie sont
des pastilles, les dés reposent dans un plateau creusé, le personnage est une pile de fiches à
onglets, le lieu une étiquette de papier. Le détail est dans la section 8 du cahier des charges
du front (`doc/cahier-des-charges-front-mj-virtuel.md`).

**Référence visuelle, pas code à reprendre.** À l'intégration, les règles du cahier des charges
priment : tout ce qui contredit la section 1 est retiré, même présent ici.

## Fichiers

- **`table.css`** : la feuille de styles commune à tous les écrans — jetons de couleur des deux
  thèmes, typographie, composants. C'est la source des jetons du socle Tailwind.
- **`<écran>.html`** : chaque écran en page statique. Une seule page sert le mobile et le
  desktop (la mise en page bascule à 1024 px) : ouvrir dans un navigateur et redimensionner.
- **`<écran>-mobile.webp`** et **`<écran>-desktop.webp`** : les captures du rendu attendu, en
  390 px (densité 2x, page entière pour les écrans qui défilent) et en 1440 × 900.
- **`src/`** : les sources des maquettes. `screen.html#<écran>` rend un écran,
  `#<écran>-dark` le rend de nuit ; `screens.js` construit tous les écrans avec les mêmes
  fonctions (un objet est identique d'un écran à l'autre) ; `review.html` est la page de revue
  (tous les écrans côte à côte, bascule jour / nuit). Pour modifier une maquette, modifier
  `src/` puis régénérer les exports.

## Écrans

| Écran | Fichier |
|---|---|
| Partie | `g1-game` |
| Partie, la table la nuit (thème sombre) | `g1-game-dark` |
| Jet en direct | `g2-live-roll` |
| Jet révélé | `g3-roll-revealed` |
| Fiche — Personnage / Inventaire / Quêtes | `g4-sheet-character`, `g4b-sheet-inventory`, `g4c-sheet-quests` |
| Tour en cours | `g5-turn-pending` |
| Tour échoué | `g6-turn-failed` |
| Nouvelle partie | `g7-game-new` |
| Partie terminée | `g8-game-over` |
| Connexion | `s1-login` |
| Accueil | `s2-home` |
| Page d'un personnage (hors partie) | `s3-character` |
| Abandon d'une partie | `s3b-abandon` |
| Création — 1 Dés … 5 Identité | `c1-dice`, `c2-characteristics`, `c3-profession`, `c4-skills`, `c5-identity` |
| Préférences, puis animations réduites par l'appareil | `s4-preferences`, `s4b-preferences-reduced-motion` |
| Menu du compte | `s5-account-menu` |
| Page introuvable | `s6-not-found` |
| Erreur inattendue | `s7-error` |

Un seul thème sombre est exporté (`g1-game-dark`). Les jetons de `table.css` donnent la nuit
pour tous les écrans (`src/screen.html#<écran>-dark`).

## Relecture contre la section 1 du cahier des charges

Les sept principes sont tenus : rien n'est calculé à l'écran, enums et contenus restent
distincts, chaque jet du personnage est montré en entier, le récit occupe le centre, l'habillage
ne choisit aucun univers, le mobile est le format de départ. Les textes viennent des fichiers de
traduction du front (`src/i18n/locales/en/`) et du contenu des Trois Mousquetaires
(`apps/backend/database/content/`). Restent ces écarts, à traiter à l'intégration :

- **Libellé nouveau** : « Chance » devant le total de la carte du jet en direct (`g2`, `g3`).
  Il demande une clé de traduction.
- **Lien de retour** sur desktop et dans la fiche mobile : la maquette affiche le nom du
  personnage (« ‹ Armand de Lisle »), le front actuel « Character page ». Le nom vient du
  contenu ; garder « Character page » comme libellé accessible.
- **Ton de l'univers** des Trois Mousquetaires (`s2`) : phrase d'exemple, le vrai ton vient de
  la base.
- **Sur mobile, le tampon d'un jet passe sous la ligne du jet**, pour qu'elle garde sa largeur ;
  sur desktop, il est à droite.
- **Sur desktop, les points de vie sont aussi dans la barre du haut**, pour rester visibles
  quel que soit l'onglet ouvert de la fiche.
- **Icônes** : dessinées à la main dans `src/screens.js` (sprite SVG), dans le style de Lucide.
  À remplacer par Lucide (section 8). Les dés (d10, d6) ne sont pas des icônes : ils se
  dessinent en SVG, comme dans la maquette.
- **Dernier jet au repos dans le plateau** (`g1`, `g4` à `g8`) : retiré à l'intégration (tranché
  le 2026-11-06). Une fois révélé, le jet n'est plus que sur la feuille ; le plateau ne porte que
  la saisie, et ne montre les d10 que pendant un jet en direct.
- **Formulaire de connexion pré-rempli** (`s1`) : pour la maquette seulement.
- **Page introuvable** (`s6`) : deux d10 sur 00 et 0, le pire jet (100). Décor seulement.
