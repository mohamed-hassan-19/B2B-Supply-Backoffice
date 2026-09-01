import { useState } from 'react';
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

export default function OrdersPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['adminOrders'],
    queryFn: async () => {
      const res = await api.get('/api/admin/orders');
      return res.data;
    }
  });

  const { data: activeOrderDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['adminOrder', activeOrderId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/orders/${activeOrderId}`);
      return res.data;
    },
    enabled: !!activeOrderId && isViewModalOpen,
  });

  const activeOrder = activeOrderDetails?.order || null;
  const activeItems = activeOrderDetails?.items || [];

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number, action: string }) => 
      api.patch(`/api/admin/orders/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      setIsViewModalOpen(false);
    }
  });

  const canApprove = role === 'super_admin' || role === 'sales';
  const canWarehouse = role === 'super_admin' || role === 'warehouse';

  const renderActions = (o: any) => {
    return (
      <div className="space-x-2">
        <Button variant="outline" size="sm" onClick={() => {
          setActiveOrderId(o.id);
          setIsViewModalOpen(true);
        }}>View</Button>
        
        {o.status === 'pending' && canApprove && (
          <Button size="sm" onClick={() => actionMutation.mutate({ id: o.id, action: 'approve' })}>Approve</Button>
        )}
        {o.status === 'approved' && canWarehouse && (
          <Button size="sm" onClick={() => actionMutation.mutate({ id: o.id, action: 'process' })}>Process</Button>
        )}
        {o.status === 'processing' && canWarehouse && (
          <Button size="sm" onClick={() => actionMutation.mutate({ id: o.id, action: 'ship' })}>Ship</Button>
        )}
        {o.status === 'shipped' && canWarehouse && (
          <Button size="sm" onClick={() => actionMutation.mutate({ id: o.id, action: 'deliver' })}>Deliver</Button>
        )}
        {(o.status === 'pending' || o.status === 'approved') && canApprove && (
          <Button variant="destructive" size="sm" onClick={() => actionMutation.mutate({ id: o.id, action: 'cancel' })}>Cancel</Button>
        )}
      </div>
    );
  };

  const handleExport = () => {
    const exportData = (orders || []).map((o: any) => ({
      'Order ID': o.id,
      'Client Name': o.Client?.company_name || o.client_id,
      'Date': new Date(o.createdAt).toLocaleDateString(),
      'Total': Number(o.total_amount),
      'Payment Method': o.payment_method,
      'Status': o.status
    }));
    exportToExcel(exportData, 'orders');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <Button variant="outline" onClick={handleExport}>
          Export to Excel
        </Button>
      </div>
      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : orders?.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell>#{o.id}</TableCell>
                <TableCell>{o.Client?.company_name || o.client_id}</TableCell>
                <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>£{Number(o.total_amount).toFixed(2)}</TableCell>
                <TableCell>{o.payment_method}</TableCell>
                <TableCell>
                  <Badge variant={o.status === 'cancelled' ? 'destructive' : 'outline'}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{renderActions(o)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={(open) => {
        setIsViewModalOpen(open);
        if (!open) setActiveOrderId(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order #{activeOrder?.id} Details</DialogTitle>
          </DialogHeader>
          {activeOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div><span className="font-semibold">Client Name:</span> {activeOrderDetails?.client?.company_name || activeOrder.client_id}</div>
                <div><span className="font-semibold">Date:</span> {new Date(activeOrder.createdAt).toLocaleString()}</div>
                <div><span className="font-semibold">Status:</span> {activeOrder.status}</div>
                <div><span className="font-semibold">Payment:</span> {activeOrder.payment_method}</div>
                <div><span className="font-semibold">Total Amount:</span> £{Number(activeOrder.total_amount).toFixed(2)}</div>
              </div>
              
              <h3 className="font-semibold mb-2">Order Items</h3>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isDetailsLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4">Loading items...</TableCell></TableRow>
                    ) : activeItems?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>£{Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>£{(Number(item.unit_price) * item.quantity).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
