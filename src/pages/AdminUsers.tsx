import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminUsersPage() {
  const { role, email: currentEmail } = useAuth();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'sales' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await api.get('/api/admin/users');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/admin/users`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'sales' });
      setErrorMsg('');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create user');
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    createMutation.mutate(formData);
  };

  if (role !== 'super_admin') {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Admin Users</h2>
        <Button onClick={() => setIsModalOpen(true)}>+ New Admin User</Button>
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : users?.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="uppercase text-xs">{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "default" : "destructive"}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {u.email !== currentEmail && (
                    u.is_active ? (
                      <Button variant="destructive" size="sm" onClick={() => deactivateMutation.mutate(u.id)}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => activateMutation.mutate(u.id)}>
                        Activate
                      </Button>
                    )
                  )}
                  {u.email === currentEmail && (
                    <span className="text-xs text-gray-400 italic">Current User</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users?.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No users found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {errorMsg}
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input required type={showPassword ? 'text' : 'password'} minLength={8} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="pr-10" />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Minimum 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select 
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="super_admin">Super Admin</option>
                <option value="sales">Sales</option>
                <option value="warehouse">Warehouse</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
