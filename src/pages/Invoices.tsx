import { useState, useEffect } from 'react';
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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function InvoicesPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

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

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['adminInvoices', startDate, endDate, clientFilter, page],
    queryFn: async () => {
      let url = `/api/admin/invoices?page=${page}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (clientFilter) url += `client_id=${clientFilter}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const invoices = invoicesData?.items || [];
  const total = invoicesData?.total || 0;

  const paymentMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => 
      api.patch(`/api/admin/invoices/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      setIsViewModalOpen(false);
    }
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);

  const handleDownloadPdf = async (id: number) => {
    try {
      setIsGeneratingPdf(id);
      const res = await api.get(`/api/admin/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const pdfUrl = window.URL.createObjectURL(blob);
      window.open(pdfUrl, '_blank');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const handleExport = async () => {
    let url = `/api/admin/invoices?export=true&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (clientFilter) url += `client_id=${clientFilter}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((i: any) => ({
      'Invoice #': i.invoice_number,
      'Order ID': i.order_id,
      'Client': i.Order?.Client?.company_name || 'N/A',
      'Date': new Date(i.createdAt).toLocaleDateString(),
      'Due Date': i.due_date ? new Date(i.due_date).toLocaleDateString() : 'N/A',
      'Amount': Number(i.grand_total || i.amount),
      'Status': i.payment_status
    }));
    exportToExcel(exportData, 'invoices');
  };

  const canMarkPaid = role === 'super_admin' || role === 'finance';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Invoices</h2>
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
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : invoices.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.invoice_number}</TableCell>
                <TableCell>{i.Order?.Client?.company_name}</TableCell>
                <TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>£{Number(i.grand_total || i.amount).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={i.payment_status === 'paid' ? 'default' : i.payment_status === 'overdue' ? 'destructive' : 'secondary'}>
                    {i.payment_status.toUpperCase()}
                  </Badge>
                </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setActiveInvoice(i);
                      setIsViewModalOpen(true);
                    }}>
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadPdf(i.id)}
                      disabled={isGeneratingPdf === i.id}
                    >
                      {isGeneratingPdf === i.id ? 'Generating...' : 'PDF'}
                    </Button>
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {invoices.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={invoices.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {activeInvoice && (
            <div className="py-4 space-y-6">
              <InvoiceDetail invoiceId={activeInvoice.id} apiPath="/api/admin/invoices" />
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                {canMarkPaid && activeInvoice.payment_status !== 'paid' && (
                  <Button 
                    onClick={() => paymentMutation.mutate({ id: activeInvoice.id })}
                    disabled={paymentMutation.isPending}
                  >
                    Mark as Paid
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => handleDownloadPdf(activeInvoice.id)}
                  disabled={isGeneratingPdf === activeInvoice.id}
                >
                  {isGeneratingPdf === activeInvoice.id ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
