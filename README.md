# Wanderlore

Jeu de rôle textuel en solo : le joueur incarne son personnage, l'application tient le rôle
de maître du jeu, piloté par un LLM.

Contrairement à la génération narrative libre, le moteur de jeu reste déterministe — jets de
dés, règles et état du monde sont calculés côté serveur. Le LLM interprète et raconte, il ne
décide jamais.

> 🚧 Projet personnel en cours de développement, pas encore utilisable.

## Stack

AdonisJS · PostgreSQL · Redis · Turborepo

## Démarrage

```bash
docker compose up -d
npm install
npm run dev
```

## Documentation

Les documents de conception sont dans [`doc/`](doc/) — commencer par la
[synthèse](doc/synthese-passation-mj-virtuel-llm.md).
