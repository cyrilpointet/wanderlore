# Maquettes Phase 2

Maquettes des écrans du front joueur, générées avec Google Stitch à partir de la section 10
du cahier des charges front (`doc/cahier-des-charges-front-mj-virtuel.md`). Ticket : KAN-20.

**Référence visuelle, pas code à reprendre.** Chaque écran est livré en deux fichiers au même
nom : l'export HTML de Stitch (couleurs, espacements, tailles, structure) et une capture PNG
(rendu attendu). À l'intégration, les règles du cahier des charges priment sur les maquettes :
tout ce qui contredit la section 1 est retiré, même présent ici.

## Écrans

| Écran | Mobile | Desktop |
|---|---|---|
| S1 — Connexion | `s1-login-mobile` | `s1-login-desktop` |
| S2 — Mes parties | `s2-games-mobile` | `s2-games-desktop` |
| S3 — Partie, état normal | — | `s3-game-desktop` |
| S4 — Partie, état normal | `s4-game-mobile` | — |
| S4 — Partie, fiche ouverte | `s4-game-sheet-mobile` | — |
| S5 — Tour en cours | `s5-turn-pending-mobile` | — |
| S6 — Tour échoué | `s6-turn-failed-mobile` | — |
| S7 — Partie neuve | `s7-game-new-mobile` | — |

Les captures mobiles sont à 780 px de large (390 px en densité 2x), les captures desktop à
2560 px (1440 px en densité ~1,8x). Les dimensions dans le HTML sont les vraies.

## Source

- Projet Stitch « Wanderlore » (`16269902839264571239`), design system « Literary Lamplight »
  généré par Stitch à partir du préambule de style de la section 10.
- Les jetons de couleur, typographie et espacement sont dans la configuration Tailwind en tête
  de chaque HTML (`tailwind.config`). Ils alimentent la configuration Tailwind du socle.

## Écarts à corriger à l'intégration

Relevés à la relecture de chaque maquette contre le cahier des charges. Les maquettes sont
conservées telles que Stitch les a produites ; c'est l'intégration qui corrige.

### Communs à plusieurs écrans

- **Icônes Material Symbols** (`favorite`, `casino`, `location_on`…) : à remplacer par Lucide
  (section 8).
- **Espacement des mots serré** dans la narration mobile (S4, S6) : l'export applique un
  `letter-spacing: -0.01em` à la narration, à ne pas reproduire (section 8 : 16 px / 26 px,
  sans espacement négatif).
- **Puces de jet** : en pilule sur S4 mobile, à 4 px de rayon sur S3 et S5. Retenir 4 px,
  conformément au design system.
- **Séparation entre les tours** : un filet court sur S5, rien ailleurs. Retenir une règle
  unique.

### Par écran

- **S1** — Placeholder d'e-mail `chronicler@wanderlore.io` inventé ; champs pré-remplis sur
  desktop.
- **S2 mobile** — Commentaire HTML périmé `<!-- Card 2: Evelyn Vance -->`, sans effet visuel.
  Filet de séparation interne aux cartes absent de la version desktop.
- **S3** — **Barres de points de vie en vert sauge** (header et fiche) : elles doivent être en
  rouge brique, comme sur S4. Colonne de lecture légèrement décalée à gauche au lieu d'être
  centrée. Actions du joueur marquées d'un filet ambré plutôt que d'un fond légèrement teinté.
- **S4 fiche ouverte** — La capture s'arrête au début du bloc « Situation » (la feuille défile) ;
  le lieu et la quête sont dans le HTML. Icône de compte dans le header grisé derrière la
  feuille, à retirer. Sous-titre « Character Sheet » ajouté par Stitch.
- **S5** — Texte de l'action du joueur en serif : il doit être en sans-serif (S3, S4, S6).
  Libellé « YOU » et points d'attente en ambré : l'accent est réservé aux actions, les passer
  en couleur neutre. Bandes sombres en haut et en bas de la capture : artefact du cadre mobile.
- **S7** — Résumé de la quête en sans-serif, alors qu'il est en serif dans la fiche (S3, S4).
