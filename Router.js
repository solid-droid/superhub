import { jsonResponse, toErrorBody } from "./Helper/http.js";
import { handleMetaList } from "./Router/meta.js";
import { handleMetaBySlug } from "./Router/meta-slug.js";
import { handleMetaBySlugVersion } from "./Router/meta-slug-version.js";
import { handleSummary } from "./Router/summary.js";
import { handlePluginFullBundle, handlePluginFullFile } from "./Router/plugin-full.js";
import { handlePluginBundle, handlePluginFile } from "./Router/plugin.js";
import { handlePluginPost } from "./Router/plugin-post.js";
import { handleVerifyLocalRegistry } from "./Router/verify-local-registry.js";
import { handleHome } from "./Router/home.js";

function compilePathPattern(pathPattern) {
	const params = [];
	const regexParts = pathPattern
		.split("/")
		.filter(Boolean)
		.map((segment) => {
			if (segment.startsWith(":")) {
				const paramName = segment.slice(1);
				params.push(paramName);
				return "([^/]+)";
			}
			return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		});

	const regex = new RegExp(`^/${regexParts.join("/")}/?$`);
	return { regex, params };
}

function createRoute(method, pathPattern, handler) {
	const compiled = compilePathPattern(pathPattern);
	return {
		method,
		pathPattern,
		handler,
		...compiled
	};
}

const ROUTES = [
	createRoute("GET", "/", handleHome),
	createRoute("GET", "/meta", handleMetaList),
	createRoute("GET", "/meta/:slug/:version", handleMetaBySlugVersion),
	createRoute("GET", "/meta/:slug", handleMetaBySlug),
	createRoute("GET", "/summary", handleSummary),
	createRoute("GET", "/plugin-full/:slug/:version/:file", handlePluginFullFile),
	createRoute("GET", "/plugin-full/:slug/:version", handlePluginFullBundle),
	createRoute("GET", "/plugin/:slug/:version/:file", handlePluginFile),
	createRoute("GET", "/plugin/:slug/:version", handlePluginBundle),
	createRoute("POST", "/plugin/:slug/:version", handlePluginPost),
	createRoute("GET", "/verify/local-registry", handleVerifyLocalRegistry)
];

function matchRoute(method, pathName) {
	for (const route of ROUTES) {
		if (route.method !== method) {
			continue;
		}

		const match = pathName.match(route.regex);
		if (!match) {
			continue;
		}

		const params = {};
		for (let i = 0; i < route.params.length; i += 1) {
			params[route.params[i]] = match[i + 1];
		}

		return {
			route,
			params
		};
	}

	return null;
}

export async function handleRequest(request, context) {
	const url = new URL(request.url);
	const found = matchRoute(request.method.toUpperCase(), url.pathname);

	if (!found) {
		return jsonResponse(404, toErrorBody("route not found", {
			method: request.method,
			path: url.pathname
		}));
	}

	try {
		return await found.route.handler({
			request,
			params: found.params,
			services: context.services,
			projectRoot: context.projectRoot
		});
	} catch (error) {
		return jsonResponse(500, toErrorBody("internal server error", error.message));
	}
}
