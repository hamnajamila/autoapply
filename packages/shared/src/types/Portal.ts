export type PortalMeta = {
  name: string;
  displayName: string;
  logoUrl: string;
  requiresAuth: boolean;
  description: string;
};

export type PortalConnectionStatus = {
  portalName: string;
  connected: boolean;
  isActive: boolean;
  lastSynced?: string | null;
  lastError?: string | null;
};

