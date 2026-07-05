export type Actor = {
  id: string;
  name: string;
  image?: string;
  currentZoneId: string | null;
  engagementId?: string;
  initiative?: number;
  statusEffects: string[];
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
