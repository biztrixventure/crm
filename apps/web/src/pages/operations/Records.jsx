import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

export default function OperationsRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await api.get('/operations/closer-records?limit=100');
        setRecords(res.data.records || []);
      } catch (error) {
        console.error('Failed to fetch records:', error);
        toast.error('Failed to load records');
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  const filtered = records.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      r.customer_name?.toLowerCase().includes(q) ||
      r.customer_phone?.toLowerCase().includes(q) ||
      r.vin?.toLowerCase().includes(q) ||
      r.reference_no?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">Closer Records</h2>
        <p className="text-sm text-primary-600 dark:text-primary-400">Read-only view</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          placeholder="Search by customer, VIN, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-primary-800 dark:text-primary-100"
        />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-x-auto border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full min-w-max">
          <thead className="bg-cream-100 dark:bg-dark-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">VIN</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Reference</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Disposition</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr key={record.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50">
                  <td className="px-6 py-4 font-medium text-primary-900 dark:text-primary-100">{record.customer_name}</td>
                  <td className="px-6 py-4 text-primary-700 dark:text-primary-300">{record.customer_phone}</td>
                  <td className="px-6 py-4 font-mono text-sm text-primary-700 dark:text-primary-300">{record.vin}</td>
                  <td className="px-6 py-4 text-primary-700 dark:text-primary-300">{record.reference_no}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        record.status === 'SOLD'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300">{record.dispositions?.label || '-'}</td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">{formatDateTime(record.record_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
