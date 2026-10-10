export interface Server {
  id: string;
  name: string;
  hostname: string | null;
  ipAddress: string | null;
  operatingSystem: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewServer {
  name: string;
  hostname?: string | null;
  ipAddress?: string | null;
  operatingSystem?: string | null;
  description?: string | null;
}
