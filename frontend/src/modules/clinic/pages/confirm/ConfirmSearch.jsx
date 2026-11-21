import { useNavigate } from 'react-router-dom';
import { UserCheck, ListChecks } from 'lucide-react';
import { PageHeader, Toast } from '../../../../components/ui.jsx';
import PatientPicker from '../../components/PatientPicker.jsx';
import { useToast } from '../../../../hooks/useToast.js';
import { confirmApi } from '../../api.js';

export default function ConfirmSearch() {
  const navigate = useNavigate();
  const { toast, show } = useToast();

  const addNew = (name, mobile) => {
    navigate('/clinic/registration/patient', { state: { prefill: { name, mobileNo: mobile }, fromConfirm: true } });
  };

  // Each match carries its own Confirm button; a confirmed patient leaves the list.
  const confirmPatient = async (patient) => {
    try {
      await confirmApi.create({ patientId: patient.PatientId });
      show(`${patient.Name} confirmed for today`, 'success');
      return true;
    } catch (err) {
      show(err.response?.data?.error || 'Confirm failed', 'error');
      return false;
    }
  };

  return (
    <div>
      <PageHeader
        title="Confirm Patient"
        actions={
          <button className="btn-secondary" onClick={() => navigate('/clinic/confirm/list')}>
            <ListChecks size={16} /> Confirm List
          </button>
        }
      />

      <PatientPicker
        onAddNew={addNew}
        onClear={() => {}}
        rowAction={{ label: 'Confirm Patient', busyLabel: 'Confirming...', icon: UserCheck, run: confirmPatient }}
      />

      <Toast toast={toast} />
    </div>
  );
}
