// Clinic module API (source: Demo Source api/client.js), served at
// /api/clinic. Sign-in, users and menu access come from the core client.
// clinicApi = Clinic Master (the shared organisation row + clinic print
// settings); pharmacyApi = Clinic Master's partner pharmacies list.
import { createModuleApi } from '../../api/client.js';

export { authApi, userApi, menuAccessApi } from '../../api/client.js';

const api = createModuleApi('/api/clinic');

export const medicationApi = {
  list: (search = '') => api.get('/medications', { params: { search } }).then((r) => r.data),
  get: (id) => api.get(`/medications/${id}`).then((r) => r.data),
  create: (data) => api.post('/medications', data).then((r) => r.data),
  update: (id, data) => api.put(`/medications/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/medications/${id}`).then((r) => r.data),
  bulk: (rows) => api.post('/medications/bulk', { rows }).then((r) => r.data),
};

export const labTestApi = {
  list: (search = '') => api.get('/lab-tests', { params: { search } }).then((r) => r.data),
  nextId: () => api.get('/lab-tests/next-id').then((r) => r.data),
  create: (data) => api.post('/lab-tests', data).then((r) => r.data),
  update: (id, data) => api.put(`/lab-tests/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/lab-tests/${id}`).then((r) => r.data),
};

export const employeeApi = {
  list: (search = '') => api.get('/employees', { params: { search } }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data) => api.post('/employees', data).then((r) => r.data),
  update: (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/employees/${id}`).then((r) => r.data),
  bulk: (rows) => api.post('/employees/bulk', { rows }).then((r) => r.data),
};

export const patientApi = {
  list: (params = {}) => api.get('/patients', { params }).then((r) => r.data),
  nextId: () => api.get('/patients/next-id').then((r) => r.data),
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),
  create: (data) => api.post('/patients', data).then((r) => r.data),
  update: (id, data) => api.put(`/patients/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
  bulk: (rows) => api.post('/patients/bulk', { rows }).then((r) => r.data),
};

export const vitalApi = {
  list: (params = {}) => api.get('/vitals', { params }).then((r) => r.data),
  get: (id) => api.get(`/vitals/${id}`).then((r) => r.data),
  create: (data) => api.post('/vitals', data).then((r) => r.data),
  update: (id, data) => api.put(`/vitals/${id}`, data).then((r) => r.data),
};

export const prescriptionApi = {
  list: (params = {}) => api.get('/prescriptions', { params }).then((r) => r.data),
  history: (patientId) => api.get(`/prescriptions/history/${patientId}`).then((r) => r.data),
  followUp: (params = {}) => api.get('/prescriptions/follow-up', { params }).then((r) => r.data),
  updateNextVisitDate: (id, nextVisitDate) => api.put(`/prescriptions/${id}/next-visit-date`, { nextVisitDate }).then((r) => r.data),
  create: (data) => api.post('/prescriptions', data).then((r) => r.data),
  update: (id, data) => api.put(`/prescriptions/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/prescriptions/${id}`).then((r) => r.data),
};

export const confirmApi = {
  list: (date, status) =>
    api.get('/confirmations', { params: { ...(date ? { date } : {}), ...(status ? { status } : {}) } }).then((r) => r.data),
  create: (data) => api.post('/confirmations', data).then((r) => r.data),
  examine: (patientId) => api.post('/confirmations/examine', { patientId }).then((r) => r.data),
  remove: (id) => api.delete(`/confirmations/${id}`).then((r) => r.data),
};

export const reportApi = {
  patients: (from, to) => api.get('/reports/patients', { params: from && to ? { from, to } : {} }).then((r) => r.data),
  medicalHistory: (patientId) => api.get(`/reports/medical-history/${patientId}`).then((r) => r.data),
  visits: (from, to) => api.get('/reports/visits', { params: { from, to } }).then((r) => r.data),
};

export const billingApi = {
  report: (from, to) => api.get('/billing', { params: { from, to } }).then((r) => r.data),
  patients: (date) => api.get('/billing/patients', { params: { date } }).then((r) => r.data),
  saveFees: (patientId, data) => api.put(`/billing/patients/${patientId}`, data).then((r) => r.data),
};

export const patientDocumentApi = {
  // patientId omitted for a Patient-role login — the backend infers their own.
  list: (patientId) => api.get('/patient-documents', { params: patientId ? { patientId } : {} }).then((r) => r.data),
  upload: (formData) => api.post('/patient-documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/patient-documents/${id}`).then((r) => r.data),
  download: async (id, filename) => {
    const res = await api.get(`/patient-documents/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  // For in-page preview (not a save-file download). Caller must
  // URL.revokeObjectURL(url) once done with it.
  getBlobUrl: async (id) => {
    const res = await api.get(`/patient-documents/${id}/download`, { responseType: 'blob' });
    return { url: URL.createObjectURL(res.data), mimeType: res.data.type };
  },
};

export const clinicApi = {
  get: () => api.get('/clinic-details').then((r) => r.data),
  save: (data) => api.put('/clinic-details', data).then((r) => r.data),
  saveLetterPad: (data) => api.put('/clinic-details/letter-pad', data).then((r) => r.data),
};

export const pharmacyApi = {
  list: (search = '') => api.get('/partner-pharmacies', { params: { search } }).then((r) => r.data),
  create: (data) => api.post('/partner-pharmacies', data).then((r) => r.data),
  update: (id, data) => api.put(`/partner-pharmacies/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/partner-pharmacies/${id}`).then((r) => r.data),
};

export default api;
