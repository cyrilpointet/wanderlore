#!/bin/bash
# Exécuté une seule fois, à l'initialisation du volume PostgreSQL.
# Crée la base dédiée aux tests, à côté de la base de développement.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE ${POSTGRES_DB}_test OWNER ${POSTGRES_USER};
SQL
