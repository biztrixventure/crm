import { useState, useEffect } from 'react';
import { Plus, Edit2, X, Check } from 'lucide-react';
import axios from '../lib/axios';

export default function PlanManager() {
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get('/plans');
      setPlans(data.plans || []);
    } catch (err) {
      setError('Failed to fetch plans');
      console.error(err);
    }
  };

  const handleAdd = async () => {
    if (!newPlan.trim()) {
      setError('Plan name required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/plans', { name: newPlan });
      setPlans([data.plan, ...plans]);
      setNewPlan('');
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id) => {
    if (!editName.trim()) {
      setError('Plan name required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.patch(`/plans/${id}`, { name: editName });
      setPlans(plans.map(p => p.id === id ? data.plan : p));
      setEditingId(null);
      setEditName('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update plan');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (plan) => {
    setLoading(true);
    try {
      const { data } = await axios.patch(`/plans/${plan.id}`, {
        is_active: !plan.is_active,
      });
      setPlans(plans.map(p => p.id === plan.id ? data.plan : p));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 border border-cream-200 dark:border-dark-800 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-primary-800 dark:text-primary-200">Plans</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus size={18} /> Add Plan
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 bg-cream-50 dark:bg-dark-800 rounded-lg border border-cream-200 dark:border-dark-700">
          <input
            type="text"
            placeholder="Plan name (e.g., Signature, Gold, Platinum)"
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            className="w-full px-3 py-2 border border-cream-300 dark:border-dark-600 rounded-lg dark:bg-dark-700 dark:text-white mb-3"
            disabled={loading}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition"
            >
              <Check size={18} /> Add
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewPlan('');
                setError('');
              }}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition"
            >
              <X size={18} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {plans.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No plans yet. Add one to get started.</p>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                plan.is_active
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex-1">
                {editingId === plan.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1 border border-cream-300 dark:border-dark-600 rounded dark:bg-dark-700 dark:text-white"
                    disabled={loading}
                  />
                ) : (
                  <p className={`font-medium ${plan.is_active ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}`}>
                    {plan.name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingId === plan.id ? (
                  <>
                    <button
                      onClick={() => handleEdit(plan.id)}
                      disabled={loading}
                      className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded transition"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                      className="p-2 bg-gray-400 hover:bg-gray-500 text-white rounded transition"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(plan.id);
                        setEditName(plan.name);
                      }}
                      disabled={loading}
                      className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggle(plan)}
                      disabled={loading}
                      className={`px-3 py-2 rounded text-sm font-medium transition ${
                        plan.is_active
                          ? 'bg-green-200 text-green-800 hover:bg-green-300'
                          : 'bg-red-200 text-red-800 hover:bg-red-300'
                      }`}
                    >
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
