import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import api from '../../lib/axios';
import CloserRecordForm from '../../components/CloserRecordForm';
import OutcomesTable from '../../components/OutcomesTable';

export default function CloserManagerRecord() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary-800 dark:text-primary-200 mb-1">My Records</h2>
        <p className="text-primary-600 dark:text-primary-400">Record sales and track outcomes</p>
      </div>

      <div>
        <CloserRecordForm onSuccess={() => setRefreshKey((v) => v + 1)} />
      </div>

      <div key={refreshKey}>
        <OutcomesTable compact />
      </div>
    </div>
  );
}
