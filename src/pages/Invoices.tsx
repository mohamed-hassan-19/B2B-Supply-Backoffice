import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { exportToExcel } from '../lib/exportToExcel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { InvoiceDetail } from '../components/InvoiceDetail';
import { useAuth } from '../contexts/AuthContext';

export default function InvoicesPage() {
  const { role } = useAuth();
  const canWrite = role === 'super_admin' || role === 'finance';
  const queryClient = useQueryClient();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

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

  const getPdfMutation = useMutation({
    mutationFn: (id: number) => api.get(`/api/admin/invoices/${id}/pdf`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      if (res.data?.pdfUrl) {
        window.open(`http://localhost:3000${res.data.pdfUrl}`, '_blank');
      }
    }
  });

  const isOverdue = (dueDateStr: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date();
  };

  const handleExport = () => {
    const exportData = (invoices || []).map((inv: any) => {
      const overdue = inv.payment_status !== 'paid' && inv.payment_status !== 'void' && isOverdue(inv.due_date);
      return {
        'Invoice ID': inv.invoice_number || inv.id,
        'Order ID': inv.order_id,
        'Created': new Date(inv.createdAt).toLocaleDateString(),
        'Due Date': inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A',
        'Amount': Number(inv.grand_total || inv.amount),
        'Status': overdue ? 'OVERDUE' : inv.payment_status
      };
    });
    exportToExcel(exportData, 'invoices');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : invoices?.map((inv: any) => {
              const overdue = inv.payment_status !== 'paid' && inv.payment_status !== 'void' && isOverdue(inv.due_date);
              
              return (
                <TableRow key={inv.id} className={overdue ? 'bg-red-50' : inv.payment_status === 'void' ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{inv.invoice_number || `#${inv.id}`}</TableCell>
                  <TableCell>#{inv.order_id}</TableCell>
                  <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>£{Number(inv.grand_total || inv.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === 'paid' ? 'secondary' : inv.payment_status === 'void' ? 'outline' : overdue ? 'destructive' : 'outline'}>
                      {overdue ? 'OVERDUE' : inv.payment_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceId(inv.id)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => getPdfMutation.mutate(inv.id)}>
                      PDF
                    </Button>
                    {inv.payment_status !== 'paid' && inv.payment_status !== 'void' && canWrite && (
                      <Button size="sm" onClick={() => payMutation.mutate(inv.id)}>Mark Paid</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedInvoiceId} onOpenChange={(open) => !open && setSelectedInvoiceId(null)}>
        <DialogContent className="max-w-3xl">
          {selectedInvoiceId && <InvoiceDetail invoiceId={selectedInvoiceId} apiPath="/api/admin/invoices" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
