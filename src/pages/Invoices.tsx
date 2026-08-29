import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [orderId, setOrderId] = useState('');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['adminInvoices'],
    queryFn: async () => {
      const res = await api.get('/api/admin/invoices');
      return res.data;
    }
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/invoices/${id}/pay`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminInvoices'] })
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/invoices/generate/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      setIsGenerateModalOpen(false);
      setOrderId('');
    }
  });

  const isOverdue = (dueDateStr: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <Button onClick={() => setIsGenerateModalOpen(true)}>
          + Generate Invoice
        </Button>
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : invoices?.map((inv: any) => {
              const overdue = inv.payment_status !== 'paid' && isOverdue(inv.due_date);
              
              return (
                <TableRow key={inv.id} className={overdue ? 'bg-red-50' : ''}>
                  <TableCell>#{inv.id}</TableCell>
                  <TableCell>#{inv.order_id}</TableCell>
                  <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className={overdue ? 'text-red-600 font-medium' : ''}>
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>${Number(inv.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === 'paid' ? 'secondary' : overdue ? 'destructive' : 'outline'}>
                      {overdue ? 'OVERDUE' : inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.payment_status !== 'paid' && (
                      <Button size="sm" onClick={() => payMutation.mutate(inv.id)}>Mark Paid</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice from Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            generateMutation.mutate(orderId);
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Delivered Order ID</Label>
              <Input required type="number" value={orderId} onChange={e => setOrderId(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">Generate</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
