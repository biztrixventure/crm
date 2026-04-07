import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Search, Download, Filter, Eye } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';
import { formatPhone } from '../../lib/utils';

export default function CloserManagerCloserRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    closer_id: '',
    status: '',
    disposition: '',
  });
  const [closers, setClosers] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchRecords();
    fetchClosers();
    fetchDispositions();
  }, []);

  async function fetchRecords() {
    try {
      setLoading(true);
      const res = await api.get('/closer-manager/records?limit=500');
      setRecords(res.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      toast.error('Failed to load records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClosers() {
    try {
      const res = await api.get('/closer-manager/closers?limit=500');
      setClosers(res.data.closers || []);
    } catch (error) {
      console.error('Failed to fetch closers:', error);
    }
  }

  async function fetchDispositions() {
    try {
      const res = await api.get('/dispositions');
      setDispositions(res.data.dispositions || []);
    } catch (error) {
      console.error('Failed to fetch dispositions:', error);
    }
  }

  // Filter records based on multiple criteria
  const filteredRecords = records.filter((record) => {
    const matchSearch =
      !search ||
      record.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      record.customer_phone?.includes(search) ||
      record.vin?.toLowerCase().includes(search.toLowerCase()) ||
      record.reference_number?.toLowerCase().includes(search.toLowerCase());

    const matchCloser =
      !filters.closer_id || record.closer_id === filters.closer_id;

    const matchStatus = !filters.status || record.status === filters.status;

    const matchDisposition =
      !filters.disposition ||
      record.dispositions?.id === filters.disposition;

    return matchSearch && matchCloser && matchStatus && matchDisposition;
  });

  const exportCSV = () => {
    const headers = [
      'Customer Name',
      'Phone',
      'VIN',
      'Closer',
      'Status',
      'Disposition',
      'Date',
    ];
    const rows = filteredRecords.map((r) => [
      r.customer_name || '',
      r.customer_phone || '',
      r.vin || '',
      r.closer?.full_name || '',
      r.status || '',
      r.dispositions?.label || '',
      formatDateTime(r.created_at),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `closer_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-1">
          Closer Records
        </h2>
        <p className="text-primary-600 dark:text-primary-400">
          View all sales records from your closers
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-700/50 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, VIN, or reference number..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 placeholder-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Closer Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              Closer
            </label>
            <select
              value={filters.closer_id}
              onChange={(e) =>
                setFilters({ ...filters, closer_id: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Closers</option>
              {closers.map((closer) => (
                <option key={closer.id} value={closer.id}>
                  {closer.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="SOLD">Sold</option>
            </select>
          </div>

          {/* Disposition Filter */}
          <div>
            <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
              Disposition
            </label>
            <select
              value={filters.disposition}
              onChange={(e) =>
                setFilters({ ...filters, disposition: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Dispositions</option>
              {dispositions.map((disp) => (
                <option key={disp.id} value={disp.id}>
                  {disp.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <div className="flex items-end">
            <button
              onClick={exportCSV}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-primary-600 dark:text-primary-400">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-cream-200/50 dark:border-dark-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  VIN
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Closer
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Disposition
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Date
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-cream-200 dark:border-dark-700 hover:bg-primary-50/50 dark:hover:bg-dark-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-primary-900 dark:text-primary-100 font-medium">
                      {record.customer_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300 font-mono">
                      {record.customer_phone ? formatPhone(record.customer_phone) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300 font-mono">
                      {record.vin || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-900 dark:text-primary-100">
                      {record.closer?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          record.status === 'SOLD'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : record.status === 'PENDING'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {record.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300">
                      {record.dispositions?.label || 'Pending'}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                      {formatDateTime(record.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setShowDetail(true);
                        }}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye size={18} className="text-primary-600 dark:text-primary-400" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center text-primary-600 dark:text-primary-400"
                  >
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-cream-200 dark:border-dark-700 p-6 sticky top-0 bg-white dark:bg-dark-800">
              <h2 className="text-xl font-bold text-primary-900 dark:text-primary-100">
                Record Details
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Customer Name
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedRecord.customer_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Phone
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {formatPhone(selectedRecord.customer_phone)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    VIN
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedRecord.vin}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Email
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedRecord.customer_email}
                  </p>
                </div>
              </div>

              <hr className="border-cream-200 dark:border-dark-700" />

              {/* Record Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Closer
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedRecord.closer?.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Status
                  </p>
                  <span
                    className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedRecord.status === 'SOLD'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Disposition
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedRecord.dispositions?.label || 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Date
                  </p>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {formatDateTime(selectedRecord.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-cream-200 dark:border-dark-700 p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 rounded-lg border-2 border-cream-300 dark:border-dark-600 text-primary-900 dark:text-primary-100 font-medium hover:bg-cream-50 dark:hover:bg-dark-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
