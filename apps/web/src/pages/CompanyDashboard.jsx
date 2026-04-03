import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import {
  Phone,
  DollarSign,
  Users,
  Clock,
  Download,
  Upload,
  Loader2,
  UserPlus,
  ListOrdered,
} from 'lucide-react';
import { formatDateTime, formatPhone, cn } from '../lib/utils';
import CallbacksManager from '../components/CallbacksManager';

// KPI Card component
function KPICard({ title, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    green: 'bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
    blue: 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className={cn('p-3 rounded-xl', colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function Overview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, transfersRes] = await Promise.all([
          api.get(`/companies/${user.companyId}/stats`),
          api.get('/transfers', { params: { limit: 5 } }),
        ]);
        setStats(statsRes.data.stats);
        setTransfers(transfersRes.data.transfers || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user.companyId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Company Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.company?.display_name}
          </p>
        </div>
        {user.featureFlags?.allow_export && (
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Transfers Today"
          value={stats?.transfersToday || 0}
          icon={Phone}
          color="primary"
        />
        <KPICard
          title="Sales Today"
          value={stats?.salesToday || 0}
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Pending Callbacks"
          value={stats?.pendingCallbacks || 0}
          icon={Clock}
          color="yellow"
        />
        <KPICard
          title="Active Fronters"
          value={stats?.activeUsers || 0}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Recent Transfers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Transfers
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Fronter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Closer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDateTime(transfer.created_at)}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {transfer.customer_name}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.customer_phone}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.fronter?.full_name}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {transfer.closer?.full_name}
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No transfers yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Transfers() {
  return <div className="text-gray-900 dark:text-white">Transfers - Coming soon</div>;
}

function Outcomes() {
  return <div className="text-gray-900 dark:text-white">Outcomes - Coming soon</div>;
}

function Fronters() {
  return <div className="text-gray-900 dark:text-white">Fronters - Coming soon</div>;
}

function Numbers() {
  const { user } = useAuthStore();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState('');
  const [listDetails, setListDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [fronters, setFronters] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [filters, setFilters] = useState({ assigned: 'all', fronter_id: '' });
  const [assignForm, setAssignForm] = useState({ fronter_id: '', from_row: '', to_row: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const numbersEnabled = user?.featureFlags?.enableNumberLists !== false;

  async function fetchLists() {
    try {
      setListsLoading(true);
      const res = await api.get('/numbers/lists', { timeout: 12000 });
      const nextLists = res.data.lists || [];
      setLists(nextLists);
      if (!selectedListId && nextLists.length) {
        setSelectedListId(nextLists[0].id);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load number lists');
    } finally {
      setListsLoading(false);
    }
  }

  async function fetchFronters() {
    try {
      const res = await api.get('/users', { timeout: 12000 });
      const activeFronters = (res.data.users || []).filter((u) => u.role === 'fronter' && u.is_active);
      setFronters(activeFronters);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load fronters');
    }
  }

  async function fetchListDetails(listId, page = 1) {
    if (!listId) return;
    try {
      setDetailsLoading(true);
      const params = { page, limit: 50 };
      if (filters.assigned === 'assigned') params.assigned = 'true';
      if (filters.assigned === 'unassigned') params.assigned = 'false';
      if (filters.fronter_id) params.fronter_id = filters.fronter_id;

      const res = await api.get(`/numbers/lists/${listId}`, { params, timeout: 12000 });
      setListDetails(res.data);
      setCurrentPage(page);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load list numbers');
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    fetchLists();
    fetchFronters();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      fetchListDetails(selectedListId, 1);
    }
  }, [selectedListId, filters.assigned, filters.fronter_id]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a CSV/XLSX file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await api.post('/numbers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      toast.success('Numbers uploaded successfully');
      setFile(null);
      await fetchLists();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedListId) {
      toast.error('Select a list first');
      return;
    }
    try {
      setAssigning(true);
      await api.post('/numbers/assign', {
        list_id: selectedListId,
        fronter_id: assignForm.fronter_id,
        from_row: Number(assignForm.from_row),
        to_row: Number(assignForm.to_row),
      });
      toast.success('Numbers assigned');
      setAssignForm({ fronter_id: '', from_row: '', to_row: '' });
      await Promise.all([fetchListDetails(selectedListId, currentPage), fetchLists()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  if (!numbersEnabled) {
    return <div className="text-gray-900 dark:text-white">Number lists are disabled for your company.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Number Lists</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Upload CSV/XLSX</h2>
        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Lists</h3>
          </div>
          <div className="max-h-[480px] overflow-auto">
            {listsLoading ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading lists...</div>
            ) : lists.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No lists uploaded yet.</div>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={cn(
                    'w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40',
                    selectedListId === list.id && 'bg-primary-50 dark:bg-primary-900/20'
                  )}
                >
                  <p className="font-medium text-gray-900 dark:text-white truncate">{list.file_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {list.total_numbers} total • {list.assignedCount} assigned • {list.unassignedCount} unassigned
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Assign Range to Fronter
            </h3>
            <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                required
                value={assignForm.fronter_id}
                onChange={(e) => setAssignForm((s) => ({ ...s, fronter_id: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select fronter...</option>
                {fronters.map((f) => (
                  <option key={f.id} value={f.id}>{f.full_name}</option>
                ))}
              </select>
              <input
                required
                type="number"
                min="1"
                placeholder="From row"
                value={assignForm.from_row}
                onChange={(e) => setAssignForm((s) => ({ ...s, from_row: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                required
                type="number"
                min="1"
                placeholder="To row"
                value={assignForm.to_row}
                onChange={(e) => setAssignForm((s) => ({ ...s, to_row: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={assigning || !selectedListId}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListOrdered className="w-4 h-4" />}
                Assign
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Numbers</h3>
              <div className="flex gap-2">
                <select
                  value={filters.assigned}
                  onChange={(e) => setFilters((s) => ({ ...s, assigned: e.target.value }))}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
                <select
                  value={filters.fronter_id}
                  onChange={(e) => setFilters((s) => ({ ...s, fronter_id: e.target.value }))}
                  className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">All Fronters</option>
                  {fronters.map((f) => (
                    <option key={f.id} value={f.id}>{f.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {detailsLoading ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading numbers...</div>
            ) : !listDetails?.numbers?.length ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No numbers found for current filters.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Row</th>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Phone</th>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Fronter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {listDetails.numbers.map((n) => (
                        <tr key={n.id}>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{n.row_order + 1}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{formatPhone(n.phone_number)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{n.fronter?.full_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => fetchListDetails(selectedListId, currentPage - 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Page {listDetails.pagination?.page || 1} of {listDetails.pagination?.totalPages || 1}
                  </p>
                  <button
                    disabled={currentPage >= (listDetails.pagination?.totalPages || 1)}
                    onClick={() => fetchListDetails(selectedListId, currentPage + 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Callbacks() {
  return <CallbacksManager title="Company Callbacks" />;
}

export default function CompanyDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="transfers/*" element={<Transfers />} />
      <Route path="outcomes/*" element={<Outcomes />} />
      <Route path="fronters/*" element={<Fronters />} />
      <Route path="numbers/*" element={<Numbers />} />
      <Route path="callbacks/*" element={<Callbacks />} />
    </Routes>
  );
}
