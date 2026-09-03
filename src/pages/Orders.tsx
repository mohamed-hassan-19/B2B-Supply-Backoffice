import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { exportToExcel } from '../lib/exportToExcel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function OrdersPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Group 12 filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [startDate, endDate, clientFilter]);

  const { data: clientsData } = useQuery({ 
    queryKey: ['adminClientsList'], 
    queryFn: async () => {
      const res = await api.get('/api/admin/clients');
      return res.data.items || res.data;
    }
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['adminOrders', startDate, endDate, clientFilter, page],
    queryFn: async () => {
      let url = `/api/admin/orders?page=${page}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (clientFilter) url += `client_id=${clientFilter}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const { data: activeOrderDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['adminOrderDetails', activeOrder?.id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/orders/${activeOrder.id}`);
      return res.data;
    },
    enabled: !!activeOrder?.id
  });

  const orders = ordersData?.items || [];
  const total = ordersData?.total || 0;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => {
      let endpoint = '';
      if (status === 'approved') endpoint = 'approve';
      else if (status === 'processing') endpoint = 'process';
      else if (status === 'shipped') endpoint = 'ship';
      else if (status === 'delivered') endpoint = 'deliver';
      
      return api.patch(`/api/admin/orders/${id}/${endpoint}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number, reason: string }) => 
      api.patch(`/api/admin/orders/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActiveOrder(null);
    }
  });

  const handleExport = async () => {
    let url = `/api/admin/orders?export=true&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (clientFilter) url += `client_id=${clientFilter}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((o: any) => ({
      'Order ID': o.id,
      'Client': o.Client?.company_name,
      'Date': new Date(o.createdAt).toLocaleString(),
      'Status': o.status,
      'Total Amount': Number(o.total_amount),
      'Items Count': o.OrderItems?.length || 0,
      'Shipping Address': o.shipping_address
    }));
    exportToExcel(exportData, 'orders');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'approved': return 'default';
      case 'processing': return 'default';
      case 'shipped': return 'outline';
      case 'delivered': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const canApprove = role === 'super_admin' || role === 'sales';
  const canProcess = role === 'super_admin' || role === 'warehouse';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Orders</h2>
        <Button variant="outline" onClick={handleExport}>
          Export to Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-md border shadow-sm">
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" className="h-9" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input type="date" className="h-9" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Client</Label>
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
              <TableHead>Order ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : orders.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell>#{o.id}</TableCell>
                <TableCell className="font-medium">
                  {o.Client?.company_name} {o.Client?.is_priority && '⭐'}
                </TableCell>
                <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadge(o.status)}>
                    {o.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>£{Number(o.total_amount).toFixed(2)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setActiveOrder(o);
                    setIsViewModalOpen(true);
                  }}>
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {orders.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={orders.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order #{activeOrder?.id}</DialogTitle>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="text-center py-8">Loading details...</div>
          ) : (activeOrder && activeOrderDetails) ? (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="details">Order Details</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Client</span> {activeOrderDetails.client?.company_name}</div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Date</span> {new Date(activeOrderDetails.order.createdAt).toLocaleString()}</div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Status</span> <Badge variant={getStatusBadge(activeOrderDetails.order.status)}>{activeOrderDetails.order.status.toUpperCase()}</Badge></div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Total</span> £{Number(activeOrderDetails.order.total_amount).toFixed(2)}</div>
                  <div className="col-span-2"><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Shipping Address</span> {activeOrderDetails.order.shipping_address}</div>
                  {activeOrderDetails.order.notes && (
                    <div className="col-span-2"><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Notes</span> {activeOrderDetails.order.notes}</div>
                  )}
                  {activeOrderDetails.order.cancellation_reason && (
                    <div className="col-span-2 text-red-600"><span className="font-semibold block text-xs uppercase tracking-wider mb-1">Cancellation Reason</span> {activeOrderDetails.order.cancellation_reason}</div>
                  )}
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrderDetails.items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.Product?.name || `Product #${item.product_id}`}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">£{Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">£{Number(item.total_price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  {canApprove && activeOrderDetails.order.status === 'pending' && (
                    <Button onClick={() => statusMutation.mutate({ id: activeOrder.id, status: 'approved' })}>
                      Approve Order
                    </Button>
                  )}
                  
                  {canProcess && activeOrderDetails.order.status === 'approved' && (
                    <Button onClick={() => statusMutation.mutate({ id: activeOrder.id, status: 'processing' })}>
                      Mark Processing
                    </Button>
                  )}
                  
                  {canProcess && activeOrderDetails.order.status === 'processing' && (
                    <Button onClick={() => statusMutation.mutate({ id: activeOrder.id, status: 'shipped' })}>
                      Mark Shipped
                    </Button>
                  )}

                  {canProcess && activeOrderDetails.order.status === 'shipped' && (
                    <Button onClick={() => statusMutation.mutate({ id: activeOrder.id, status: 'delivered' })}>
                      Mark Delivered
                    </Button>
                  )}

                  {(activeOrderDetails.order.status === 'pending' || activeOrderDetails.order.status === 'approved' || activeOrderDetails.order.status === 'processing') && (
                    <Button variant="destructive" onClick={() => setIsCancelModalOpen(true)}>
                      Cancel Order
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity">
                <div className="space-y-4">
                  {(!activeOrderDetails.activity_logs || activeOrderDetails.activity_logs.length === 0) ? (
                    <p className="text-gray-500 text-sm italic">No activity recorded for this order yet.</p>
                  ) : (
                    <div className="relative border-l border-gray-200 ml-3 space-y-6">
                      {activeOrderDetails.activity_logs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((log: any) => (
                        <div key={log.id} className="mb-6 ml-6 relative">
                          <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 ring-4 ring-white">
                            <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{log.action_type.replace('_', ' ').toUpperCase()}</span>
                            <span className="text-sm text-gray-700 mt-1">{log.description}</span>
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                              <span>By: {log.actor}</span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cancellation Reason</Label>
              <Input 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Briefly explain why this order is being cancelled"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
              <Button 
                variant="destructive" 
                disabled={!cancelReason.trim()}
                onClick={() => {
                  if (activeOrder) {
                    cancelMutation.mutate({ id: activeOrder.id, reason: cancelReason });
                  }
                }}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
