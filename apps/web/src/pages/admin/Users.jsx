import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-primary-800 mb-2">Users Management</h3>
      <p className="text-primary-600">Coming soon - Manage all system users</p>
    </div>
  );
}
