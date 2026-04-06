import { useState } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { SearchIcon, Loader2, PhoneIcon, Clock, Building2, User } from 'lucide-react';
import { formatDateTime, normalizePhone } from '../../lib/utils';

export default function NumberSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const normalizedPhone = normalizePhone(query);
      const res = await api.get(`/search/number?phone=${encodeURIComponent(normalizedPhone)}`);
      setResults(res.data.results || []);

      if (!res.data.results || res.data.results.length === 0) {
        toast.success('No results found for this number');
      } else {
        toast.success(`Found ${res.data.results.length} result(s)`);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      if (error.response?.status === 404) {
        toast.success('Number not found in the system');
      } else {
        toast.error(error.response?.data?.error || 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-1">Number Search</h2>
        <p className="text-primary-600 dark:text-primary-400">Search for customer numbers and check sales status</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-lg border border-cream-200/50 dark:border-dark-700/50">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              type="tel"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter phone number (e.g., 555-123-4567)..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-cream-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-primary-900 dark:text-primary-100 placeholder-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 disabled:opacity-70 transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SearchIcon size={18} />
                Search
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {searched && !loading && results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h3>
          <div className="grid gap-3">
            {results.map((lead, idx) => (
              <div key={idx} className="bg-white dark:bg-dark-800 rounded-xl p-4 border border-cream-200/50 dark:border-dark-700/50 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary-900 dark:text-primary-100 text-lg">
                      {lead.customer_name || 'Unknown'}
                    </h4>
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mt-1">
                      <PhoneIcon size={16} />
                      <span className="font-mono">{lead.customer_phone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {/* Sold Status - Primary Badge */}
                    <span className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                      lead.is_sold
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {lead.is_sold ? (
                        <>
                          <span className="text-green-500">✓</span> SOLD
                        </>
                      ) : (
                        <>
                          <span className="text-blue-500">○</span> NOT SOLD
                        </>
                      )}
                    </span>
                    {/* Record Type Badge */}
                    <span className="px-2 py-1 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {lead.type === 'record' ? 'Record' : 'Transfer'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-cream-200/50 dark:border-dark-700/50">
                  {lead.customer_email && (
                    <div>
                      <p className="text-xs text-primary-500 dark:text-primary-400">Email</p>
                      <p className="text-sm text-primary-800 dark:text-primary-100 break-all">{lead.customer_email}</p>
                    </div>
                  )}
                  {(lead.company?.display_name || lead.company) && (
                    <div className="flex items-start gap-1">
                      <Building2 size={14} className="text-primary-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-primary-500 dark:text-primary-400">Company</p>
                        <p className="text-sm text-primary-800 dark:text-primary-100">{lead.company?.display_name || lead.company}</p>
                      </div>
                    </div>
                  )}
                  {lead.vin && (
                    <div>
                      <p className="text-xs text-primary-500 dark:text-primary-400">VIN</p>
                      <p className="text-sm text-primary-800 dark:text-primary-100 font-mono break-all">{lead.vin}</p>
                    </div>
                  )}
                  {lead.disposition && (
                    <div>
                      <p className="text-xs text-primary-500 dark:text-primary-400">Disposition</p>
                      <p className="text-sm font-medium text-primary-800 dark:text-primary-100">{lead.disposition}</p>
                    </div>
                  )}
                  {lead.closer_name && (
                    <div className="flex items-start gap-1">
                      <User size={14} className="text-primary-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-primary-500 dark:text-primary-400">Closer</p>
                        <p className="text-sm text-primary-800 dark:text-primary-100">{lead.closer_name}</p>
                      </div>
                    </div>
                  )}
                  {lead.created_at && (
                    <div className="flex items-start gap-1">
                      <Clock size={14} className="text-primary-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-primary-500 dark:text-primary-400">Added</p>
                        <p className="text-sm text-primary-800 dark:text-primary-100">{formatDateTime(lead.created_at)}</p>
                      </div>
                    </div>
                  )}
                  {lead.status && lead.type === 'transfer' && (
                    <div>
                      <p className="text-xs text-primary-500 dark:text-primary-400">Transfer Status</p>
                      <p className="text-sm text-primary-800 dark:text-primary-100 capitalize">{lead.status}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-2xl border border-cream-200/50 dark:border-dark-700/50">
          <SearchIcon size={48} className="mx-auto text-primary-300 dark:text-primary-700 mb-3" />
          <p className="text-primary-600 dark:text-primary-400">No records found for this number</p>
        </div>
      )}

      {/* Initial state */}
      {!searched && (
        <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-2xl border border-cream-200/50 dark:border-dark-700/50">
          <PhoneIcon size={48} className="mx-auto text-primary-300 dark:text-primary-700 mb-3" />
          <p className="text-primary-600 dark:text-primary-400">Enter a phone number to search for customers and check sales status</p>
        </div>
      )}
    </div>
  );
}
