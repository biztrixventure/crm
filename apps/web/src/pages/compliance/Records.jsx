import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

export default function ComplianceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState({
    status: 'pending',
    flagReason: '',
    flagNotes: '',
  });
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    try {
      const res = await api.get('/compliance/records?limit=100');
      setRecords(res.data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReview(recordId) {
    if (reviewData.status === 'issue_found' && !reviewData.flagReason) {
      toast.error('Please select a reason for the issue');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/compliance/reviews', {
        closer_record_id: recordId,
        status: reviewData.status,
        flag_reason: reviewData.flagReason,
        flag_notes: reviewData.flagNotes,
      });

      toast.success('Review submitted');
      setSelectedRecord(null);
      setReviewData({ status: 'pending', flagReason: '', flagNotes: '' });
      fetchRecords();
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

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
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100">
          {isManager ? 'All Closer Records' : 'Records for Review'}
        </h2>
        <p className="text-sm text-primary-600 dark:text-primary-400">{filtered.length} records</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          type="text"
          placeholder="Search by customer, VIN, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-primary-800 dark:text-primary-100 focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg overflow-x-auto border border-cream-200/50 dark:border-dark-700/50">
        <table className="w-full min-w-max">
          <thead className="bg-cream-100 dark:bg-dark-700 border-b border-cream-200 dark:border-dark-600 sticky top-0">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Closer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">VIN</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Reference</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Company</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-primary-900 dark:text-primary-100">Status</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-primary-900 dark:text-primary-100">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-dark-600">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-primary-600 dark:text-primary-400">
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((record) => {
                const review = record.compliance_reviews?.[0];
                return (
                  <tr key={record.id} className="hover:bg-cream-50 dark:hover:bg-dark-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      {new Date(record.record_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-primary-900 dark:text-primary-100">
                      {record.closer?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-900 dark:text-primary-100">
                      {record.customer_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      {record.vin?.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                      {record.reference_no}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-600 dark:text-primary-400">
                      {record.company?.display_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {review?.status === 'approved' ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium w-fit">
                          <CheckCircle size={14} />
                          Approved
                        </span>
                      ) : review?.status === 'issue_found' ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium w-fit">
                          <AlertCircle size={14} />
                          Issue
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium w-fit">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {!review || review.status === 'pending' ? (
                        <button
                          onClick={() => {
                            setSelectedRecord(record.id);
                            setReviewData({ status: 'pending', flagReason: '', flagNotes: '' });
                          }}
                          className="px-3 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-800/30 transition-colors"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="text-xs text-primary-500">Reviewed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4">
            <div className="border-b border-cream-200 dark:border-dark-700 p-6">
              <h2 className="text-xl font-bold text-primary-900 dark:text-primary-100">Review Record</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                  Status
                </label>
                <select
                  value={reviewData.status}
                  onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="issue_found">Issue Found</option>
                </select>
              </div>

              {reviewData.status === 'issue_found' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                      Issue Reason *
                    </label>
                    <select
                      value={reviewData.flagReason}
                      onChange={(e) => setReviewData({ ...reviewData, flagReason: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Wrong VIN">Wrong VIN</option>
                      <option value="Wrong Reference No">Wrong Reference No</option>
                      <option value="Wrong Plan">Wrong Plan</option>
                      <option value="Missing Info">Missing Info</option>
                      <option value="Duplicate">Duplicate</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={reviewData.flagNotes}
                      onChange={(e) => setReviewData({ ...reviewData, flagNotes: e.target.value })}
                      placeholder="Describe the issue..."
                      className="w-full px-4 py-2 rounded-lg border border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 h-24 resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleSubmitReview(selectedRecord)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  disabled={submitting}
                  className="px-4 py-2 bg-cream-200 dark:bg-dark-700 text-primary-900 dark:text-primary-100 rounded-lg transition-colors hover:bg-cream-300 dark:hover:bg-dark-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
