import { randomUUID } from 'node:crypto';
import { DatabaseError, type Pool } from 'pg';
import type { NewService, Service } from '../domain/service.js';

export interface ServiceRepository {
  createService(serverId: string, input: NewService): Promise<Service>;
  listServicesByServerId(serverId: string): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | null>;
}

export class DuplicateServiceNameError extends Error {
  constructor(options?: ErrorOptions) {
    super('A service with this name already exists on this server', options);
    this.name = 'DuplicateServiceNameError';
  }
}

export class ServerNotFoundError extends Error {
  constructor(options?: ErrorOptions) {
    super('Server not found', options);
    this.name = 'ServerNotFoundError';
  }
}

interface ServiceRow {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const serviceColumns = 'id, server_id, name, description, created_at, updated_at';

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createServiceRepository(pool: Pool): ServiceRepository {
  return {
    async createService(serverId, input) {
      try {
        const result = await pool.query<ServiceRow>(
          `INSERT INTO services (id, server_id, name, description)
           VALUES ($1, $2, $3, $4)
           RETURNING ${serviceColumns}`,
          [randomUUID(), serverId, input.name, input.description ?? null],
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error('INSERT INTO services returned no row');
        }
        return toService(row);
      } catch (error) {
        if (error instanceof DatabaseError) {
          if (error.code === UNIQUE_VIOLATION && error.constraint === 'services_server_id_name_key') {
            throw new DuplicateServiceNameError({ cause: error });
          }
          if (error.code === FOREIGN_KEY_VIOLATION && error.constraint === 'services_server_id_fkey') {
            throw new ServerNotFoundError({ cause: error });
          }
        }
        throw error;
      }
    },

    async listServicesByServerId(serverId) {
      const result = await pool.query<ServiceRow>(
        `SELECT ${serviceColumns} FROM services WHERE server_id = $1 ORDER BY name`,
        [serverId],
      );
      return result.rows.map(toService);
    },

    async getServiceById(id) {
      const result = await pool.query<ServiceRow>(`SELECT ${serviceColumns} FROM services WHERE id = $1`, [id]);
      const row = result.rows[0];
      return row ? toService(row) : null;
    },
  };
}
