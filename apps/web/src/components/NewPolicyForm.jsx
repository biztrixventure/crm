import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axios from '../lib/axios';
import toast from 'react-hot-toast';

export default function NewPolicyForm({ existingOutcome, onClose, onSuccess }) {
  const [companies, setCompanies] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    customer_phone: existingOutcome?.customer_phone || '',
    customer_name: existingOutcome?.customer_name || '',
    company_id: '',
    car_make: '',
    car_model: '',
    car_year: '',
    car_miles: '',
    car_vin: '',
    plan_id: '',
    client_id: '',
    down_payment: '',
    monthly_payment: '',
    remarks: '',
    disposition_id: '',
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [compRes, dispRes, planRes, clientRes] = await Promise.all([
          axios.get('/companies'),
          axios.get('/dispositions'),
          axios.get('/plans'),
          axios.get('/clients'),
        ]);
        setCompanies(compRes.data.companies || []);
        setDispositions(dispRes.data.dispositions || []);
        setPlans(planRes.data.plans || []);
        setClients(clientRes.data.clients || []);
      } catch (err) {
        toast.error('Failed to load form options');
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.company_id || !formData.disposition_id || !formData.car_make) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`/outcomes/${existingOutcome.id}/new-policy`, {
        transfer_id: null,
        company_id: formData.company_id,
        customer_phone: formData.customer_phone,
        customer_name: formData.customer_name,
        disposition_id: formData.disposition_id,
        remarks: formData.remarks,
      });

      toast.success('New policy created successfully');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create policy');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
        <div className="bg-white dark:bg-dark-900 rounded-2xl p-8 shadow-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-primary-800 dark:text-primary-200">
            Create New Policy
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-cream-100 dark:hover:bg-dark-800 rounded-lg transition disabled:opacity-50"
          >
            <X size={24} className="text-primary-600 dark:text-primary-400" />
          </button>
        </div>

        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          Creating a new policy for {existingOutcome?.customer_name}. Customer information is pre-filled from the previous record.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info Section */}
          <div>
            <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Vehicle Info Section */}
          <div>
            <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">
              Vehicle Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Make <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.car_make}
                  onChange={(e) => setFormData({ ...formData, car_make: e.target.value })}
                  placeholder="e.g., TOYOTA"
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.car_model}
                  onChange={(e) => setFormData({ ...formData, car_model: e.target.value })}
                  placeholder="e.g., CAMRY"
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.car_year}
                  onChange={(e) => setFormData({ ...formData, car_year: e.target.value })}
                  placeholder="e.g., 2018"
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miles
                </label>
                <input
                  type="text"
                  value={formData.car_miles}
                  onChange={(e) => setFormData({ ...formData, car_miles: e.target.value })}
                  placeholder="e.g., 152,225"
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VIN
                </label>
                <input
                  type="text"
                  value={formData.car_vin}
                  onChange={(e) => setFormData({ ...formData, car_vin: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Policy Info Section */}
          <div>
            <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-4">
              Policy Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                  required
                >
                  <option value="">Select company</option>
                  {companies.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Disposition <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.disposition_id}
                  onChange={(e) => setFormData({ ...formData, disposition_id: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                  required
                >
                  <option value="">Select disposition</option>
                  {dispositions.filter(d => d.is_active).map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plan
                </label>
                <select
                  value={formData.plan_id}
                  onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                >
                  <option value="">Select plan</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                  disabled={loading}
                >
                  <option value="">Select client</option>
                  {clients.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-cream-200 dark:border-dark-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-cream-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-cream-50 dark:hover:bg-dark-800 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Create Policy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
