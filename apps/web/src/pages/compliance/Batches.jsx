import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Plus, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';

export default function ComplianceBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    date_from: '',
    date_to: '',
    assign_to: '',
  });
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isManager = user?.role === 'compliance_manager';

  useEffect(() => {
    fetchBatches();
    if (isManager) {
      fetchCompanies();
      fetchAgents();
    }
  }, []);

  async function fetchBatches() {
    try {
      const res = await api.get('/compliance/batches?limit=50');
      setBatches(res.data.batches || []);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompanies() {
    try {
      const res = await api.get('/companies?limit=100');
      setCompanies(res.data.companies || []);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  }

  async function fetchAgents() {
    try {
      const res = await api.get('/users?role=compliance_agent&limit=100');
      setAgents(res.data.users || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }

  async function handleCreateBatch(e) {
    e.preventDefault();
    if (!formData.company_id || !formData.date_from || !formData.date_to) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/compliance/batches', {
        company_id: formData.company_id,
        date_from: formData.date_from,
        date_to: formData.date_to,
        assign_to: formData.assign_to || null,
      });

      toast.success('Batch created successfully');
      if (formData.assign_to) {
        const agent = agents.find(a => a.id === formData.assign_to);
        toast.success(`Batch assigned to ${agent?.full_name}`);
      }
      setShowCreateForm(false);
      setFormData({ company_id: '', date_from: '', date_to: '', assign_to: '' });
      fetchBatches();
    } catch (error) {
      console.error('Failed to create batch:', error);
      toast.error(error.response?.data?.message || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  }

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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">
          {isManager ? 'Compliance Batches' : 'My Assigned Batches'}
        </h2>
        {isManager && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Create Batch
          </button>
        )}
      </div>

      {showCreateForm && isManager && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-6 border border-cream-200/50 dark:border-dark-700/50">
          <form onSubmit={handleCreateBatch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                  Company *
                </label>
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                  From Date *
                </label>
                <input
                  type="date"
                  value={formData.date_from}
                  onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                  To Date *
                </label>
                <input
                  type="date"
                  value={formData.date_to}
                  onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                  Assign Agent (Optional)
                </label>
                <select
                  value={formData.assign_to}
                  onChange={(e) => setFormData({ ...formData, assign_to: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">No assignment</option>
                  {agents.length === 0 ? (
                    <option disabled>No compliance agents available</option>
                  ) : (
                    agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.full_name} ({agent.email})
                      </option>
                    ))
                  )}
                </select>
                {formData.assign_to && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                    ✓ Agent will be notified when batch is created
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Batch'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 bg-cream-200 dark:bg-dark-700 text-primary-900 dark:text-primary-100 rounded-lg transition-colors hover:bg-cream-300 dark:hover:bg-dark-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-hidden border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date Range</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Agent</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Records</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Reviewed</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Flagged</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  {isManager ? 'No batches created yet' : 'No batches assigned to you'}
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                    {batch.company?.display_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                    {batch.date_from} to {batch.date_to}
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-700 dark:text-primary-300">
                    {batch.assigned_to_user?.full_name ? (
                      <span className="inline-flex items-center gap-1">
                        {batch.assigned_to_user.full_name}
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                          Assigned
                        </span>
                      </span>
                    ) : (
                      <span className="text-primary-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-primary-900 dark:text-primary-100">
                    {batch.total_records}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-primary-900 dark:text-primary-100">
                    {batch.reviewed_records}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-red-600 dark:text-red-400">
                    {batch.flagged_records}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      batch.status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : batch.status === 'in_progress'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {batch.status === 'in_progress' ? 'In Progress' : batch.status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => navigate(`/compliance/batches/${batch.id}`)}
                      className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
