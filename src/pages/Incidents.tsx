import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { exportToExcel } from '../lib/exportToExcel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';

export default function IncidentsPage() {
  const { role } = useAuth();
  const canWrite = role === 'super_admin' || role === 'warehouse';
  const queryClient = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<any>(null);

  const [newIncident, setNewIncident] = useState({ target_type: 'order', order_id: '', product_id: '', type: '', description: '' });
  const [updateData, setUpdateData] = useState({ status: '', resolution: '' });

  // Group 12 filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [startDate, endDate, clientFilter, statusFilter, typeFilter]);

  const { data: clientsData } = useQuery({ 
    queryKey: ['adminClientsList'], 
    queryFn: async () => {
      const res = await api.get('/api/admin/clients');
      return res.data.items || res.data;
    }
  });

  const { data: productsData } = useQuery({ 
    queryKey: ['adminProductsList'], 
    queryFn: async () => {
      const res = await api.get('/api/admin/products');
      return res.data.items || res.data;
    }
  });

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['adminIncidents', statusFilter, typeFilter, startDate, endDate, clientFilter, page],
    queryFn: async () => {
      let url = `/api/admin/incidents?page=${page}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (typeFilter) url += `type=${typeFilter}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (clientFilter) url += `client_id=${clientFilter}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const incidents = incidentsData?.items || [];
  const total = incidentsData?.total || 0;

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/admin/incidents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminIncidents'] });
      setIsCreateModalOpen(false);
      setNewIncident({ target_type: 'order', order_id: '', product_id: '', type: '', description: '' });
      alert('Incident created successfully');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Error creating incident');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api.patch(`/api/admin/incidents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminIncidents'] });
      setIsUpdateModalOpen(false);
      setActiveIncident(null);
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      target_type: newIncident.target_type,
      type: newIncident.type,
      description: newIncident.description
    };
    if (newIncident.target_type === 'order') payload.order_id = parseInt(newIncident.order_id);
    if (newIncident.target_type === 'product') payload.product_id = parseInt(newIncident.product_id);
    createMutation.mutate(payload);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIncident) {
      updateMutation.mutate({
        id: activeIncident.id,
        data: updateData
      });
    }
  };

  const handleExport = async () => {
    let url = `/api/admin/incidents?export=true&`;
    if (statusFilter) url += `status=${statusFilter}&`;
    if (typeFilter) url += `type=${typeFilter}&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (clientFilter) url += `client_id=${clientFilter}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((i: any) => ({
      'Incident ID': i.id,
      'Target': i.order_id ? `Order #${i.order_id}` : (i.Product ? `Product: ${i.Product.name}` : `Product #${i.product_id}`),
      'Type': i.type,
      'Status': i.status,
      'Reported By': i.AdminUser?.name || `Admin #${i.created_by}`,
      'Description': i.description,
      'Resolution': i.resolution || '',
      'Date': new Date(i.createdAt).toLocaleString()
    }));
    exportToExcel(exportData, 'incidents');
  };

  const openUpdateModal = (incident: any) => {
    setActiveIncident(incident);
    setUpdateData({ status: incident.status, resolution: incident.resolution || '' });
    setIsUpdateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Incidents</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            Export to Excel
          </Button>
          {canWrite && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              + Report Incident
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-md border shadow-sm">
        <div className="space-y-1">
          <Label>Status</Label>
          <select 
            className="flex h-9 w-48 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <select 
            className="flex h-9 w-48 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="damaged_product">Damaged Product</option>
            <option value="damaged_order">Damaged Order</option>
            <option value="missing_product">Missing Product</option>
            <option value="incorrect_product">Incorrect Product</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" className="h-9" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input type="date" className="h-9" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Client (Orders Only)</Label>
          <select 
            className="flex h-9 w-48 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="">All Clients</option>
            {(clientsData || []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : incidents.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No incidents found.</TableCell></TableRow>
            ) : incidents.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell>#{i.id}</TableCell>
                <TableCell>
                  {i.order_id ? (
                    <span className="font-medium text-blue-600">Order #{i.order_id}</span>
                  ) : (
                    <span className="font-medium text-green-600">Product: {i.Product?.name || `#${i.product_id}`}</span>
                  )}
                </TableCell>
                <TableCell className="capitalize">{i.type.replace('_', ' ')}</TableCell>
                <TableCell>{i.AdminUser?.name || i.created_by}</TableCell>
                <TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={i.status === 'resolved' ? 'outline' : i.status === 'open' ? 'destructive' : 'secondary'}>
                    {i.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openUpdateModal(i)}>
                    View / Update
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {incidents.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={incidents.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report New Incident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Type</Label>
              <select 
                required
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={newIncident.target_type}
                onChange={e => setNewIncident({...newIncident, target_type: e.target.value})}
              >
                <option value="order">Order</option>
                <option value="product">Product</option>
              </select>
            </div>
            
            {newIncident.target_type === 'order' && (
              <div className="space-y-2">
                <Label>Order ID</Label>
                <Input 
                  required 
                  type="number" 
                  value={newIncident.order_id} 
                  onChange={e => setNewIncident({...newIncident, order_id: e.target.value})} 
                  placeholder="e.g. 123"
                />
              </div>
            )}

            {newIncident.target_type === 'product' && (
              <div className="space-y-2">
                <Label>Product</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={newIncident.product_id}
                  onChange={e => setNewIncident({...newIncident, product_id: e.target.value})}
                >
                  <option value="" disabled>Select Product...</option>
                  {(productsData || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Type</Label>
              <select 
                required
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={newIncident.type}
                onChange={e => setNewIncident({...newIncident, type: e.target.value})}
              >
                <option value="" disabled>Select Type...</option>
                <option value="damaged_product">Damaged Product</option>
                <option value="damaged_order">Damaged Order</option>
                <option value="missing_product">Missing Product</option>
                <option value="incorrect_product">Incorrect Product</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea 
                required
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={newIncident.description}
                onChange={e => setNewIncident({...newIncident, description: e.target.value})}
                placeholder="Describe the issue in detail..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Reporting...' : 'Report Incident'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incident #{activeIncident?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded border">
              <div className="col-span-2">
                <span className="font-semibold">Target:</span>{' '}
                {activeIncident?.order_id 
                  ? `Order #${activeIncident.order_id}` 
                  : `Product: ${activeIncident?.Product?.name || '#' + activeIncident?.product_id}`
                }
              </div>
              <div><span className="font-semibold">Type:</span> <span className="capitalize">{activeIncident?.type?.replace('_', ' ')}</span></div>
              <div className="col-span-2 mt-2"><span className="font-semibold block mb-1">Description:</span> {activeIncident?.description}</div>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Status</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={updateData.status}
                  onChange={e => setUpdateData({...updateData, status: e.target.value})}
                  disabled={!canWrite}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Resolution Note</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={updateData.resolution}
                  onChange={e => setUpdateData({...updateData, resolution: e.target.value})}
                  placeholder="How was this resolved? (optional)"
                  disabled={!canWrite}
                />
              </div>
              {canWrite && (
                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Updates'}
                </Button>
              )}
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
