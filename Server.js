import path from "node:path";
import { RegistryService } from "./Services/RegistryService.js";
import { handleRequest } from "./Router.js";

const projectRoot = path.resolve(import.meta.dir);
const dataDir = path.join(projectRoot, "Data");
const registryDir = path.join(projectRoot, "registry");
const port = Number(process.env.PORT || process.env.SUPERHUB_PORT || 3005);

const registry = new RegistryService({
	projectRoot,
	dataDir,
	registryDir
});

await registry.init();
const verifySummary = await registry.verifyLocalRegistry();

const services = {
	registry
};

const server = Bun.serve({
	port,
	async fetch(request) {
		return handleRequest(request, { services, projectRoot });
	}
});

console.log("[superhub] local registry boot verify:", verifySummary);
console.log(`[superhub] listening on port ${server.port}`);
