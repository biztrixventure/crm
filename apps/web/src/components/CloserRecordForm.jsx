import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import axios from '../lib/axios';
import toast from 'react-hot-toast';
import { normalizePhone } from '../lib/utils';

export default function CloserRecordForm({ onSuccess }) {
  const [companies, setCompanies] = useState([]);
  const [dispositions, setDispositions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    customer_phone: '',
    customer_name: '',
    customer_email: '',
    customer_address: '',
    customer_dob: '',
    customer_gender: '',
    car_make: '',
    car_model: '',
    car_year: '',
    car_miles: '',
    car_vin: '',
    plan_id: '',
    client_id: '',
    down_payment: '',
    monthly_payment: '',
    reference_no: '',
    next_payment_note: '',
    fronter_name: '',
    company_id: '',
    disposition_id: '',
    remarks: '',
    record_date: new Date().toISOString().split('T')[0],
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

  const handlePhoneBlur = () => {
    if (formData.customer_phone) {
      setFormData(prev => ({
        ...prev,
        customer_phone: normalizePhone(formData.customer_phone).replace(/[^\d]/g, '').replace(/^1/, ''),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const required = ['customer_phone', 'customer_name', 'car_make', 'car_model', 'car_year', 'car_miles', 'car_vin', 'plan_id', 'client_id', 'down_payment', 'monthly_payment', 'reference_no', 'company_id', 'disposition_id'];
    const missing = required.filter(field => !formData[field]);
    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(formData.customer_phone);
      const { data } = await axios.post('/outcomes', {
        transfer_id: null,
        company_id: formData.company_id,
        customer_phone: normalizedPhone,
        customer_name: formData.customer_name,
        disposition_id: formData.disposition_id,
        remarks: formData.remarks,
      });

      toast.success('Closer record submitted successfully!');
      
      // Reset form
      setFormData({
        customer_phone: '',
        customer_name: '',
        customer_email: '',
        customer_address: '',
        customer_dob: '',
        customer_gender: '',
        car_make: '',
        car_model: '',
        car_year: '',
        car_miles: '',
        car_vin: '',
        plan_id: '',
        client_id: '',
        down_payment: '',
        monthly_payment: '',
        reference_no: '',
        next_payment_note: '',
        fronter_name: '',
        company_id: '',
        disposition_id: '',
        remarks: '',
        record_date: new Date().toISOString().split('T')[0],
      });

      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit record');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-8 shadow-lg border border-cream-200 dark:border-dark-800 flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-lg border border-cream-200 dark:border-dark-800">
      <h2 className="text-2xl font-bold text-primary-800 dark:text-primary-200 mb-6">
        Closer Record Form
      </h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-300 mb-4 pb-2 border-b border-cream-200 dark:border-dark-700">
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
                onBlur={handlePhoneBlur}
                placeholder="(555) 555-5555"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
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
                placeholder="JOHN DOE"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                DOB
              </label>
              <input
                type="text"
                value={formData.customer_dob}
                onChange={(e) => setFormData({ ...formData, customer_dob: e.target.value })}
                placeholder="MM/DD/YYYY or text"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.customer_address}
                onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                placeholder="123 Main St, City, ST 12345"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gender
              </label>
              <input
                type="text"
                value={formData.customer_gender}
                onChange={(e) => setFormData({ ...formData, customer_gender: e.target.value })}
                placeholder="M / F / Other"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Vehicle Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-300 mb-4 pb-2 border-b border-cream-200 dark:border-dark-700">
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
                placeholder="TOYOTA"
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
                placeholder="CAMRY"
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
                placeholder="2018"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Miles <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.car_miles}
                onChange={(e) => setFormData({ ...formData, car_miles: e.target.value })}
                placeholder="152,225"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                VIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.car_vin}
                onChange={(e) => setFormData({ ...formData, car_vin: e.target.value })}
                placeholder="4T1B11HK5JU153898"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
          </div>
        </div>

        {/* Policy Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-300 mb-4 pb-2 border-b border-cream-200 dark:border-dark-700">
            Policy Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.plan_id}
                onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              >
                <option value="">Select plan</option>
                {plans.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              >
                <option value="">Select client</option>
                {clients.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Down Payment <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.down_payment}
                onChange={(e) => setFormData({ ...formData, down_payment: e.target.value })}
                placeholder="108.00"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monthly Payment <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthly_payment}
                onChange={(e) => setFormData({ ...formData, monthly_payment: e.target.value })}
                placeholder="108.00"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reference No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.reference_no}
                onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                placeholder="MBH4220SBN"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Next Payment Note
              </label>
              <input
                type="text"
                value={formData.next_payment_note}
                onChange={(e) => setFormData({ ...formData, next_payment_note: e.target.value })}
                placeholder="Monthly payments on 3rd of May"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Operational Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-300 mb-4 pb-2 border-b border-cream-200 dark:border-dark-700">
            Operational Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fronter Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fronter_name}
                onChange={(e) => setFormData({ ...formData, fronter_name: e.target.value })}
                placeholder="Fronter name"
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>
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
                Record Date
              </label>
              <input
                type="date"
                value={formData.record_date}
                onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
                disabled={loading}
              />
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
            rows={4}
            placeholder="Additional notes or comments..."
            className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white"
            disabled={loading}
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t border-cream-200 dark:border-dark-700">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            Submit Record
          </button>
        </div>
      </form>
    </div>
  );
}
