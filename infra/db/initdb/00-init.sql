-- infra/db/initdb/00-init.sql — spec-e-burgos-008 cycle-01, architect DEC-01/DEC-10.
-- Se monta en /opt/crypto-trader/db/initdb/ (ver docker-compose.prod.yml).
--
-- IDEMPOTENTE. Corre como superusuario (postgres), conectado a la base `postgres`.
-- Las contraseñas NUNCA se escriben acá: se leen del entorno del contenedor (.env.db).
--
-- Dos puntos de entrada, ambos ejecutando este mismo archivo:
--   1. montado en /docker-entrypoint-initdb.d/ → corre en el `initdb` de un volumen vacío.
--   2. re-ejecutado en cada deploy vía `docker compose exec postgres psql`. Este es el
--      normativo; el 1 es cinturón y tiradores para que el bootstrap converja igual.
\set ON_ERROR_STOP on
\getenv app_pwd APP_DB_PASSWORD

-- ── Rol de aplicación: LOGIN y nada más. Sin SUPERUSER, sin CREATEDB, sin CREATEROLE.
-- La app NO se conecta como `postgres`.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crypto_trader_app') THEN
    CREATE ROLE crypto_trader_app LOGIN;
  END IF;
END $$;

-- Converge la password en cada corrida => rotar = cambiar el Secret y desplegar.
ALTER ROLE crypto_trader_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_pwd';

-- ── Base (CREATE DATABASE no puede ir dentro de un bloque DO: patrón \gexec)
SELECT 'CREATE DATABASE crypto_trader OWNER crypto_trader_app'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crypto_trader')\gexec
ALTER DATABASE crypto_trader OWNER TO crypto_trader_app;

-- ── Sin esto, PUBLIC tiene CONNECT sobre toda base. Hoy hay un solo rol de
-- aplicación, pero el día que se agregue un segundo no debe poder abrir esta base.
REVOKE ALL ON DATABASE crypto_trader FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE crypto_trader TO crypto_trader_app;

-- ── Extensión pre-creada por el superusuario.
-- La migración 20260413130000_add_agent_definitions_rag hace
-- `CREATE EXTENSION IF NOT EXISTS vector`, pero corre como crypto_trader_app, que
-- NO es superusuario. Creándola acá, esa línea de la migración queda como no-op
-- en vez de fallar por permisos.
\connect crypto_trader
CREATE EXTENSION IF NOT EXISTS vector;
