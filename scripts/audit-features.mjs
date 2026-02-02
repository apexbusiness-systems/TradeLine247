import fs from "node:fs";
import path from "node:path";

const featuresFile = path.join(process.cwd(), "src/features/feature-registry.json");
const routesFile = path.join(process.cwd(), "src/routes/paths.ts");

const parsePaths = (content) => {
  const regex = /(\w+):\s*"([^"]+)"/g;
  const paths = new Map();
  let match;
  while ((match = regex.exec(content))) {
    const [, key, value] = match;
    paths.set(key, value);
  }
  return paths;
};

const filePaths = parsePaths(fs.readFileSync(routesFile, "utf-8"));
const routePaths = new Set(filePaths.values());
routePaths.add("/auth-landing"); // Additional route defined directly in App.tsx

const featureRegistry = JSON.parse(fs.readFileSync(featuresFile, "utf-8"));
const registryPaths = featureRegistry.map((entry) => entry.path);
const registrySet = new Set(registryPaths);

const missing = [...routePaths].filter((routePath) => !registrySet.has(routePath));
const extra = [...registrySet].filter((entryPath) => !routePaths.has(entryPath));
const duplicates = registryPaths.filter((p, idx, arr) => arr.indexOf(p) !== idx);

if (missing.length > 0) {
  console.error("Feature registry missing entries for routes:", missing);
  process.exitCode = 1;
}

if (duplicates.length > 0) {
  console.error("Duplicate paths detected in registry:", duplicates);
  process.exitCode = Math.max(process.exitCode, 1);
}

if (extra.length > 0) {
  console.warn("Registry has paths not mapped by routes:", extra);
}

if (process.exitCode === 0) {
  console.log("Feature registry audit succeeded.");
}
