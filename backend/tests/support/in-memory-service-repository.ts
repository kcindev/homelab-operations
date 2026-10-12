import { randomUUID } from 'node:crypto';
import type { Service } from '../../src/domain/service.js';
import type { ServerRepository } from '../../src/repositories/server-repository.js';
import {
  DuplicateServiceNameError,
  ServerNotFoundError,
  type ServiceRepository,
} from '../../src/repositories/service-repository.js';

// Uses the server repository to mimic the services_server_id_fkey foreign key.
export function createInMemoryServiceRepository(
  servers: ServerRepository,
  initial: Service[] = [],
): ServiceRepository {
  const services = [...initial];
  return {
    async createService(serverId, input) {
      if (!(await servers.getServerById(serverId))) {
        throw new ServerNotFoundError();
      }
      if (services.some((service) => service.serverId === serverId && service.name === input.name)) {
        throw new DuplicateServiceNameError();
      }
      const now = new Date();
      const service: Service = {
        id: randomUUID(),
        serverId,
        name: input.name,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      };
      services.push(service);
      return service;
    },
    async listServicesByServerId(serverId) {
      return services
        .filter((service) => service.serverId === serverId)
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    async getServiceById(id) {
      return services.find((service) => service.id === id) ?? null;
    },
  };
}
