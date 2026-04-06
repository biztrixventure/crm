import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { Loader2, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

export default function ComplianceBatchDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isManager = user?.role === 'compliance_manager';

  const [batch, setBatch] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewData, setReviewData] = useState({
    status: 'pending',
    flagReason: '',
    flagNotes: '',
  });

  useEffect(() => {
    fetchBatchDetail();
  }, [batchId]);

  async function fetchBatchDetail() {
    try {
      const res = await api.get(`/compliance/batches/${batchId}`);
      setBatch(res.data.batch);
      setRecords(res.data.records || []);
    } catch (error) {
      console.error('Failed to fetch batch:', error);
      toast.error('Failed to load batch details');
      navigate('/compliance/batches');
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
        batch_id: batchId,
        closer_record_id: recordId,
        status: reviewData.status,
        flag_reason: reviewData.flagReason,
        flag_notes: reviewData.flagNotes,
      });

      toast.success('Review submitted');
      setSelectedRecord(null);
      setReviewData({ status: 'pending', flagReason: '', flagNotes: '' });
      fetchBatchDetail();
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteBatch() {
    if (!window.confirm('Mark this batch as complete? All records must be reviewed.')) return;

    setSubmitting(true);
    try {
      await api.patch(`/compliance/batches/${batchId}/complete`);
      toast.success('Batch marked as complete');
      fetchBatchDetail();
    } catch (error) {
      console.error('Failed to complete batch:', error);
      toast.error(error.response?.data?.message || 'Failed to complete batch');
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

  if (!batch) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-primary-600 dark:text-primary-400">Batch not found</p>
      </div>
    );
  }

  const progress = batch.total_records ? Math.round((batch.reviewed_records / batch.total_records) * 100) : 0;
  const canComplete = batch.reviewed_records === batch.total_records && batch.total_records > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/compliance/batches')}
            className="p-2 hover:bg-cream-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-primary-900 dark:text-primary-100">
              {batch.company?.display_name || 'Batch'}
            </h1>
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
              {batch.date_from} to {batch.date_to}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
            batch.status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : batch.status === 'in_progress'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
          }`}>
            {batch.status === 'completed' ? 'Completed' : batch.status === 'in_progress' ? 'In Progress' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-primary-900 dark:text-primary-100">Progress</p>
          <p className="text-sm text-primary-600 dark:text-primary-400">{batch.reviewed_records} of {batch.total_records} reviewed</p>
        </div>
        <div className="w-full bg-cream-200 dark:bg-dark-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-cream-50 dark:bg-dark-700/50 rounded-lg p-4">
            <p className="text-xs text-primary-600 dark:text-primary-400">Approved</p>
            <p className="text-2xl font-bold text-primary-900 dark:text-primary-100">{batch.approved_records || 0}</p>
          </div>
          <div className="bg-cream-50 dark:bg-dark-700/50 rounded-lg p-4">
            <p className="text-xs text-primary-600 dark:text-primary-400">Flagged</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{batch.flagged_records || 0}</p>
          </div>
          <div className="bg-cream-50 dark:bg-dark-700/50 rounded-lg p-4">
            <p className="text-xs text-primary-600 dark:text-primary-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{batch.total_records - batch.reviewed_records}</p>
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary-900 dark:text-primary-100">Records to Review</h2>
          {!isManager && canComplete && batch.status !== 'completed' && (
            <button
              onClick={handleCompleteBatch}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {submitting ? 'Completing...' : 'Complete Batch'}
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-dark-800 rounded-2xl">
            <p className="text-primary-600 dark:text-primary-400">No records in this batch</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const review = record.compliance_reviews?.[0];
              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-primary-900 dark:text-primary-100">{record.customer_name}</p>
                        {review?.status === 'approved' && (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        )}
                        {review?.status === 'issue_found' && (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="text-sm text-primary-600 dark:text-primary-400 space-y-1">
                        <p>VIN: {record.vin}</p>
                        <p>Reference: {record.reference_no}</p>
                        <p>Closer: {record.closer?.full_name}</p>
                      </div>
                      {review?.status === 'issue_found' && (
                        <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <p className="text-xs text-red-900 dark:text-red-100 font-medium">Issue: {review.flag_reason}</p>
                          {review.flag_notes && (
                            <p className="text-xs text-red-800 dark:text-red-200 mt-1">{review.flag_notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {review?.status === 'approved' ? (
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                          Approved
                        </span>
                      ) : review?.status === 'issue_found' ? (
                        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
                          Issue Found
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedRecord(record.id);
                            setReviewData({ status: 'pending', flagReason: '', flagNotes: '' });
                          }}
                          className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full hover:bg-primary-200 dark:hover:bg-primary-800/30 transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
