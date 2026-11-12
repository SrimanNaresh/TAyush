import axios from 'axios';

// Core API client. Each module (clinic, pharmacy, lab) gets its own axios
// instance from createModuleApi('/api/<module>'), so copied module pages keep
// their short paths ('/vendors', '/tests', ...) unchanged.
const instances = [];

function makeInstance(baseURL) {
  const inst = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
  // Let AuthContext react to an expired/invalid session from anywhere.
  inst.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      return Promise.reject(err);
    }
  );
  if (currentToken) inst.defaults.headers.common.Authorization = `Bearer ${currentToken}`;
  instances.push(inst);
  return inst;
}

let currentToken = '';
const api = makeInstance('/api');

export function createModuleApi(baseURL) {
  return makeInstance(baseURL);
}

export function setAuthToken(token) {
  currentToken = token || '';
  for (const inst of instances) {
    if (token) inst.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete inst.defaults.headers.common.Authorization;
  }
}

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

export const userApi = {
  list: (search = '') => api.get('/core/users', { params: { search } }).then((r) => r.data),
  roles: () => api.get('/core/users/roles').then((r) => r.data),
  create: (data) => api.post('/core/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/core/users/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/core/users/${id}`).then((r) => r.data),
};

export const menuAccessApi = {
  get: (userId) => api.get(`/core/menu-access/${userId}`).then((r) => r.data),
  save: (userId, items) => api.put(`/core/menu-access/${userId}`, { items }).then((r) => r.data),
};

// Organisation details (one row). Named clinicApi too, since the copied
// module pages read the name/address/logo for prints through clinicApi.get().
export const organisationApi = {
  get: () => api.get('/core/organisation').then((r) => r.data),
  save: (data) => api.put('/core/organisation', data).then((r) => r.data),
};
export const clinicApi = organisationApi;

// Cross-module pre-fill (Phase 5): a prescription with its medicines matched
// to Pharmacy items and its lab tests matched to Lab tests.
export const linkApi = {
  prescription: (id) => api.get(`/links/prescription/${id}`).then((r) => r.data),
};

export default api;
