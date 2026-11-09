// The ONE place where the frontend talks to the backend.
// Every page uses api.get / api.post / ... instead of calling fetch directly, so:
//   • the login token is added to every request automatically,
//   • every error becomes the same kind of object (ApiError) with a clear message,
//   • when the backend says "401 – not logged in", the user is logged out everywhere.

const TOKEN_KEY = 'taf-ems-token';

// We keep the token in sessionStorage: it survives a page refresh, but is deleted when the
// browser tab is closed (safer on shared computers than localStorage, which never expires).
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

// An error from the backend, with the parts of our standard error format.
export class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // e.g. 400, 401, 403, 404, 409, 429
    this.details = details; // e.g. [{ field: 'email', message: 'Enter a valid email address.' }]
    this.code = code; // e.g. 'PASSWORD_CHANGE_REQUIRED'
  }
}

// AuthContext registers a function here, called when any request gets 401.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Turns { page: 1, search: '' } into "?page=1" (empty values are left out).
function toQueryString(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function request(method, path, { body, query } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}${toQueryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch itself fails only when the server cannot be reached at all.
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.');
  }

  // Read the reply as JSON. If it is not JSON (for example an HTML error page), say so clearly.
  let result = null;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(response.status, `Unexpected reply from the server (status ${response.status}).`);
  }

  if (!response.ok || !result.success) {
    const error = result?.error ?? {};
    if (response.status === 401 && token) onUnauthorized(error.message);
    throw new ApiError(response.status, error.message ?? 'Something went wrong.', error.details, error.code);
  }

  return result.data;
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};
