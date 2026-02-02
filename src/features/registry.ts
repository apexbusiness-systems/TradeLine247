import rawRegistry from "./feature-registry.json";

export type FeatureStatus = "ready" | "simulated" | "locked";
export type FeatureMode = "wired" | "simulated" | "locked";
export type NavGroup = "marketing" | "admin" | "ops" | "utility";

export interface FeatureEntry {
  id: string;
  title: string;
  path: string;
  navGroup: NavGroup;
  status: FeatureStatus;
  mode: FeatureMode;
  requiresAuth: boolean;
  description: string;
  anchor?: string;
  gateReason?: string;
  cta?: string;
}

export const featureRegistry: FeatureEntry[] = rawRegistry as FeatureEntry[];

export const featureRoutePaths = new Set(featureRegistry.map((feature) => feature.path));

export const navByGroup = featureRegistry.reduce<Record<NavGroup, FeatureEntry[]>>(
  (acc, entry) => {
    acc[entry.navGroup] = acc[entry.navGroup] || [];
    acc[entry.navGroup].push(entry);
    return acc;
  },
  {
    marketing: [],
    admin: [],
    ops: [],
    utility: [],
  }
);

export const getFeatureByPath = (path: string): FeatureEntry | undefined =>
  featureRegistry.find((entry) => entry.path === path);

export const marketingNavFeatures = navByGroup.marketing.filter((feature) => feature.status === "ready");
export const adminNavFeatures = navByGroup.admin.filter((feature) => feature.status === "ready");

export const lockedFeatures = featureRegistry.filter((feature) => feature.status === "locked");

export default featureRegistry;
