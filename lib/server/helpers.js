function sortVersionsDescending(versions) {
    return versions.sort((a, b) => {
        const pa = a.replace('.json', '').split('.').map(Number);
        const pb = b.replace('.json', '').split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) {
                return nb - na;
            }
        }
        return 0;
    });
}

function isVersionMetadataFile(name) {
    return typeof name === 'string' && name.toLowerCase().endsWith('.json');
}

function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug);
}

function makeSlug(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function withCors(baseHeaders, headers = {}) {
    return {
        ...baseHeaders,
        ...headers,
    };
}

function jsonResponse(baseHeaders, payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: withCors(baseHeaders, {
            'Content-Type': 'application/json; charset=utf-8',
            ...headers,
        }),
    });
}

function textResponse(baseHeaders, payload, status = 200, headers = {}) {
    return new Response(payload, {
        status,
        headers: withCors(baseHeaders, headers),
    });
}

function isPathInside(rootPath, targetPath, pathLib) {
    const relative = pathLib.relative(rootPath, targetPath);
    return !relative.startsWith('..') && !pathLib.isAbsolute(relative);
}

function buildRequestContext(url, request) {
    const host = request.headers.get('host') || url.host;
    return {
        origin: `${url.protocol}//${host}`,
        query: {
            variants: url.searchParams.get('variants') || undefined,
            variantPolicy: url.searchParams.get('variantPolicy') || undefined,
        },
    };
}

export {
    sortVersionsDescending,
    isVersionMetadataFile,
    isValidSlug,
    makeSlug,
    withCors,
    jsonResponse,
    textResponse,
    isPathInside,
    buildRequestContext,
};
