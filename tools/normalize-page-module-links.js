const LEGACY_CASE_STUDIES_HREF = /^(?:\/)?case-studies\.html(?=$|[?#])/i;

function normalizeLegacyCaseStudiesHref(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.replace(LEGACY_CASE_STUDIES_HREF, '/case-studies');
  if (!/^\/case-studies(?=$|[?#])/i.test(normalized)) return normalized;

  const hashIndex = normalized.indexOf('#');
  const beforeHash = hashIndex === -1 ? normalized : normalized.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : normalized.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex === -1) return normalized;

  const searchParams = new URLSearchParams(beforeHash.slice(queryIndex + 1));
  const solutionValues = searchParams.getAll('solution');
  if (!solutionValues.length || !solutionValues.every(value => value === 'production-line')) {
    return normalized;
  }

  searchParams.delete('solution');
  const query = searchParams.toString();
  return `/case-studies${query ? `?${query}` : ''}${fragment}`;
}

function normalizePageModuleLinks(value) {
  if (Array.isArray(value)) {
    return value.map(normalizePageModuleLinks);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const normalized = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    normalized[key] = key === 'href' || key === 'ctaHref'
      ? normalizeLegacyCaseStudiesHref(nestedValue)
      : normalizePageModuleLinks(nestedValue);
  }
  return normalized;
}

module.exports = {
  normalizeLegacyCaseStudiesHref,
  normalizePageModuleLinks,
};
