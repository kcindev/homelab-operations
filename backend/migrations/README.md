# Database migrations

Versioned SQL migrations applied by `npm run db:migrate --workspace backend`.

The runner creates its own `schema_migrations` tracking table on first run.

## Rules

- File names must match `NNNN_description.sql`, for example
  `0001_create_servers.sql`. Files run in file name order.
- Each file runs inside its own transaction, together with the row recorded in
  `schema_migrations`. If any statement fails, the whole migration is rolled back
  and the runner exits with a non-zero code.
- Never edit or rename a migration that has already been applied anywhere. Add a
  new migration instead.
- Statements that PostgreSQL refuses to run inside a transaction (for example
  `CREATE INDEX CONCURRENTLY`) are not supported by this runner.
