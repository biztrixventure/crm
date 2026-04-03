import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import {
  Phone,
  Send,
  Loader2,
} from 'lucide-react';
import { formatDateTime, cn } from '../lib/utils';

// Transfer Form component
function TransferForm({ onSubmit }) {
  const [closers, setClosers] = useState([]);
  const [formData, setFormData] = useState({
    closer_id: '',
    customer_name: '',
    customer_phone: '',
    car_make: '',
    car_model: '',
    car_year: '',
    zip_code: '',
    city: '',
    state: '',
    miles: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchClosers() {
      try {
        const response = await api.get('/users/closers/list');
        setClosers(response.data.closers || []);
      } catch (error) {
        console.error('Failed to fetch closers:', error);
      }
    }
    fetchClosers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/transfers', formData);
      toast.success('Transfer submitted successfully!');
      setFormData({
        closer_id: '',
        customer_name: '',
        customer_phone: '',
        car_make: '',
        car_model: '',
        car_year: '',
        zip_code: '',
        city: '',
        state: '',
        miles: '',
        notes: '',
      });
      onSubmit?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/50">
          <Phone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          New Transfer
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Closer *
            </label>
            <select
              value={formData.closer_id}
              onChange={(e) => setFormData({ ...formData, closer_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select closer...</option>
              {closers.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer Phone *
            </label>
            <input
              type="tel"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Car Make
            </label>
            <input
              type="text"
              value={formData.car_make}
              onChange={(e) => setFormData({ ...formData, car_make: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Car Model
            </label>
            <input
              type="text"
              value={formData.car_model}
              onChange={(e) => setFormData({ ...formData, car_model: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Car Year
            </label>
            <input
              type="text"
              value={formData.car_year}
              onChange={(e) => setFormData({ ...formData, car_year: e.target.value })}
              maxLength={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Miles
            </label>
            <input
              type="text"
              value={formData.miles}
              onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Transfer
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Overview() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Fronter Dashboard
      </h1>

      <TransferForm />
    </div>
  );
}

function Transfers() {
  return <div className="text-gray-900 dark:text-white">My Transfers - Coming soon</div>;
}

function Numbers() {
  return <div className="text-gray-900 dark:text-white">My Numbers - Coming soon</div>;
}

function Callbacks() {
  return <div className="text-gray-900 dark:text-white">Callbacks - Coming soon</div>;
}

export default function FronterDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="transfers/*" element={<Transfers />} />
      <Route path="numbers/*" element={<Numbers />} />
      <Route path="callbacks/*" element={<Callbacks />} />
    </Routes>
  );
}
