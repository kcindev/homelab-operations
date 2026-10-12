export interface Service {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewService {
  name: string;
  description?: string | null;
}
