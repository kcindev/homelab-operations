import { randomUUID } from 'node:crypto';
import { DatabaseError, type Pool } from 'pg';
import type { NewServer, Server } from '../domain/server.js';

export interface ServerRepository {
  createServer(input: NewServer): Promise<Server>;
  listServers(): Promise<Server[]>;
  getServerById(id: string): Promise<Server | null>;
}

export class DuplicateServerNameError extends Error {
  constructor(options?: ErrorOptions) {
    super('A server with this name already exists', options);
    this.name = 'DuplicateServerNameError';
  }
}

interface ServerRow {
  id: string;
  name: string;
  hostname: string | null;
  ip_address: string | null;
  operating_system: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

const UNIQUE_VIOLATION = '23505';

const serverColumns =
  'id, name, hostname, ip_address, operating_system, description, created_at, updated_at';

function toServer(row: ServerRow): Server {
  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    operatingSystem: row.operating_system,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createServerRepository(pool: Pool): ServerRepository {
  return {
    async createServer(input) {
      try {
        const result = await pool.query<ServerRow>(
          `INSERT INTO servers (id, name, hostname, ip_address, operating_system, description)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${serverColumns}`,
          [
            randomUUID(),
            input.name,
            input.hostname ?? null,
            input.ipAddress ?? null,
            input.operatingSystem ?? null,
            input.description ?? null,
          ],
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error('INSERT INTO servers returned no row');
        }
        return toServer(row);
      } catch (error) {
        if (
          error instanceof DatabaseError &&
          error.code === UNIQUE_VIOLATION &&
          error.constraint === 'servers_name_key'
        ) {
          throw new DuplicateServerNameError({ cause: error });
        }
        throw error;
      }
    },

    async listServers() {
      const result = await pool.query<ServerRow>(`SELECT ${serverColumns} FROM servers ORDER BY name`);
      return result.rows.map(toServer);
    },

    async getServerById(id) {
      const result = await pool.query<ServerRow>(`SELECT ${serverColumns} FROM servers WHERE id = $1`, [id]);
      const row = result.rows[0];
      return row ? toServer(row) : null;
    },
  };
}
