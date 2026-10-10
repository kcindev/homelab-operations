import { randomUUID } from 'node:crypto';
import type { Server } from '../../src/domain/server.js';
import { DuplicateServerNameError, type ServerRepository } from '../../src/repositories/server-repository.js';

export function createInMemoryServerRepository(initial: Server[] = []): ServerRepository {
  const servers = [...initial];
  return {
    async createServer(input) {
      if (servers.some((server) => server.name === input.name)) {
        throw new DuplicateServerNameError();
      }
      const now = new Date();
      const server: Server = {
        id: randomUUID(),
        name: input.name,
        hostname: input.hostname ?? null,
        ipAddress: input.ipAddress ?? null,
        operatingSystem: input.operatingSystem ?? null,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      };
      servers.push(server);
      return server;
    },
    async listServers() {
      return [...servers].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    async getServerById(id) {
      return servers.find((server) => server.id === id) ?? null;
    },
  };
}
