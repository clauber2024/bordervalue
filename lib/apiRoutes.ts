type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export const apiRoutes = {
  conceptualProducts(params?: QueryParams | URLSearchParams) {
    return withQuery("/api/conceptual-products", params);
  },

  chain(chainName: string) {
    return `/api/chain/${encodeURIComponent(chainName)}`;
  },
};

function withQuery(path: string, params?: QueryParams | URLSearchParams) {
  const query = toSearchParams(params);
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function toSearchParams(params?: QueryParams | URLSearchParams) {
  if (!params) return new URLSearchParams();
  if (params instanceof URLSearchParams) return params;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });
  return query;
}
