import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { exportToExcel, exportMultipleSheetsToExcel } from '../lib/exportToExcel';
import { Star } from 'lucide-react';

function ClientOrdersHistory({ clientId }: { clientId: number }) {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['adminClientOrders', clientId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/orders?client_id=${clientId}`);
      return res.data;
    }
  });
  const orders = ordersData?.items || ordersData || [];
  if (isLoading) return <div>Loading order history...</div>;
  if (!orders || orders.length === 0) return <div className="text-gray-500 text-sm">No orders found.</div>;
  return (
    <div className="border rounded-md mt-4 max-h-64 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell>#{o.id}</TableCell>
              <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
              <TableCell>£{Number(o.total_amount).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientQuotesHistory({ clientId }: { clientId: number }) {
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['adminClientQuotes', clientId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/quotes?client_id=${clientId}`);
      return res.data;
    }
  });
  const quotes = quotesData?.items || quotesData || [];
  if (isLoading) return <div>Loading quote history...</div>;
  if (!quotes || quotes.length === 0) return <div className="text-gray-500 text-sm">No quotes found.</div>;
  return (
    <div className="border rounded-md mt-4 max-h-64 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q: any) => (
            <TableRow key={q.id}>
              <TableCell>#{q.id}</TableCell>
              <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientInvoicesHistory({ clientId }: { clientId: number }) {
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['adminClientInvoices', clientId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/invoices?client_id=${clientId}`);
      return res.data;
    }
  });
  const invoices = invoicesData?.items || invoicesData || [];
  if (isLoading) return <div>Loading invoice history...</div>;
  if (!invoices || invoices.length === 0) return <div className="text-gray-500 text-sm">No invoices found.</div>;
  return (
    <div className="border rounded-md mt-4 max-h-64 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell>{i.invoice_number}</TableCell>
              <TableCell>{new Date(i.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>£{Number(i.amount).toFixed(2)}</TableCell>
              <TableCell><Badge variant="outline">{i.payment_status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ClientsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [activeClient, setActiveClient] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditData, setCreditData] = useState({ credit_limit: '', credit_terms: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [startDate, endDate]);

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['adminClients', startDate, endDate, page],
    queryFn: async () => {
      let url = `/api/admin/clients?page=${page}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const clients = clientsData?.items || [];
  const total = clientsData?.total || 0;

  const { data: activeClientDetails } = useQuery({
    queryKey: ['adminClientDetails', activeClient?.id],
    queryFn: async () => {
      if (!activeClient?.id) return null;
      const res = await api.get(`/api/admin/clients/${activeClient.id}`);
      return res.data;
    },
    enabled: !!activeClient?.id
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => 
      api.patch(`/api/admin/clients/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminClients'] })
  });

  const creditMutation = useMutation({
    mutationFn: (data: any) => 
      api.patch(`/api/admin/clients/${activeClient.id}/credit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminClients'] });
      setIsCreditModalOpen(false);
    }
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/api/admin/clients/${activeClient.id}/documents`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminClientDetails'] });
      setDocumentFile(null);
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => api.delete(`/api/admin/clients/documents/${docId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminClientDetails'] })
  });

  const remindMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/clients/${id}/remind`),
    onSuccess: () => {
      alert('Reminder email sent successfully!');
    }
  });

  const priorityMutation = useMutation({
    mutationFn: ({ id, is_priority }: { id: number, is_priority: boolean }) => api.patch(`/api/admin/clients/${id}/priority`, { is_priority }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminClients'] })
  });

  const handleExport = async () => {
    let url = `/api/admin/clients?export=true&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((c: any) => ({
      'ID': c.id,
      'Company Name': c.company_name,
      'Email': c.email,
      'Status': c.status,
      'Credit Limit': Number(c.credit_limit || 0),
      'Credit Terms': c.credit_terms || '',
      'Days Since Last Order': c.days_since_last_order !== null ? c.days_since_last_order : 'N/A'
    }));
    exportToExcel(exportData, 'clients');
  };

  const handleExportClientHistory = async (clientId: number, companyName: string) => {
    const [ordersRes, quotesRes, invoicesRes] = await Promise.all([
      api.get(`/api/admin/orders?export=true&client_id=${clientId}`),
      api.get(`/api/admin/quotes?export=true&client_id=${clientId}`),
      api.get(`/api/admin/invoices?export=true&client_id=${clientId}`)
    ]);

    const ordersData = (ordersRes.data.items || ordersRes.data || []).map((o: any) => ({
      'Order ID': o.id, 'Date': new Date(o.createdAt).toLocaleDateString(), 'Status': o.status, 'Total': o.total_amount
    }));
    const quotesData = (quotesRes.data.items || quotesRes.data || []).map((q: any) => ({
      'Quote ID': q.id, 'Date': new Date(q.createdAt).toLocaleDateString(), 'Status': q.status
    }));
    const invoicesData = (invoicesRes.data.items || invoicesRes.data || []).map((i: any) => ({
      'Invoice #': i.invoice_number, 'Date': new Date(i.createdAt).toLocaleDateString(), 'Amount': i.amount, 'Status': i.payment_status
    }));

    exportMultipleSheetsToExcel([
      { name: 'Orders', data: ordersData },
      { name: 'Quotes', data: quotesData },
      { name: 'Invoices', data: invoicesData }
    ], `Client_${companyName.replace(/\s+/g, '_')}_History`);
  };

  const canApprove = role === 'super_admin' || role === 'sales';
  const canCredit = role === 'super_admin' || role === 'finance';
  const canUpload = role === 'super_admin' || role === 'sales';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Clients</h2>
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
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : clients.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.id}</TableCell>
                <TableCell className="font-medium">{c.company_name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>
                  <Badge variant={c.status === 'approved' ? 'default' : c.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {c.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  {c.days_since_last_order !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{c.days_since_last_order} days ago</span>
                      {canApprove && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-6 text-xs px-2"
                          onClick={() => remindMutation.mutate(c.id)}
                          disabled={remindMutation.isPending}
                        >
                          Remind
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {role === 'super_admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => priorityMutation.mutate({ id: c.id, is_priority: !c.is_priority })}
                      className={`px-2 ${c.is_priority ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-gray-500'}`}
                    >
                      <Star className="h-4 w-4" fill={c.is_priority ? "currentColor" : "none"} />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => {
                    setActiveClient(c);
                    setIsViewModalOpen(true);
                  }}>
                    View Details
                  </Button>
                  {canCredit && c.status === 'approved' && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setActiveClient(c);
                      setCreditData({ credit_limit: c.credit_limit || '', credit_terms: c.credit_terms || '' });
                      setIsCreditModalOpen(true);
                    }}>
                      Credit
                    </Button>
                  )}
                  {canApprove && c.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: c.id, status: 'approved' })}>Approve</Button>
                      <Button variant="destructive" size="sm" onClick={() => statusMutation.mutate({ id: c.id, status: 'rejected' })}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {clients.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={clients.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Details: {activeClient?.company_name} {activeClient?.is_priority && <Badge className="ml-2 bg-yellow-500">Priority</Badge>}</DialogTitle>
          </DialogHeader>
          {activeClientDetails && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md border">
                <div><span className="font-semibold">Email:</span> {activeClientDetails.email}</div>
                <div><span className="font-semibold">Phone:</span> {activeClientDetails.contact_details?.phone || 'N/A'}</div>
                <div><span className="font-semibold">Contact Name:</span> {activeClientDetails.contact_details?.contact_name || 'N/A'}</div>
                <div><span className="font-semibold">Address:</span> {activeClientDetails.contact_details?.address || 'N/A'}</div>
                <div><span className="font-semibold">CR:</span> {activeClientDetails.commercial_registration || 'N/A'}</div>
                <div><span className="font-semibold">Tax ID:</span> {activeClientDetails.tax_registration || 'N/A'}</div>
                <div><span className="font-semibold">Status:</span> {activeClientDetails.status}</div>
                <div><span className="font-semibold">Payment:</span> {activeClientDetails.payment_method || 'N/A'}</div>
                <div><span className="font-semibold">Credit Limit:</span> £{activeClientDetails.credit_limit || 0}</div>
                <div><span className="font-semibold">Terms:</span> {activeClientDetails.credit_terms || 0} Days</div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Documents</h3>
                {activeClientDetails.ClientDocuments?.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {activeClientDetails.ClientDocuments.map((doc: any) => (
                      <li key={doc.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                        <span className="text-sm font-medium">{doc.file_name}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={`${API_BASE_URL}${doc.file_url}`} target="_blank" rel="noreferrer">View</a>
                          </Button>
                          {canUpload && (
                            <Button variant="destructive" size="sm" onClick={() => deleteDocMutation.mutate(doc.id)}>Delete</Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">No documents uploaded.</p>
                )}
                
                {canUpload && (
                  <div className="flex gap-2 items-center">
                    <Input type="file" onChange={e => setDocumentFile(e.target.files?.[0] || null)} className="max-w-xs" />
                    <Button 
                      onClick={() => documentFile && uploadDocMutation.mutate(documentFile)}
                      disabled={!documentFile || uploadDocMutation.isPending}
                    >
                      {uploadDocMutation.isPending ? 'Uploading...' : 'Upload Doc'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <h3 className="font-semibold">History</h3>
                <Button variant="outline" size="sm" onClick={() => handleExportClientHistory(activeClient.id, activeClient.company_name)}>
                  Export Client History
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Orders</h4>
                  <ClientOrdersHistory clientId={activeClient.id} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Quotes</h4>
                  <ClientQuotesHistory clientId={activeClient.id} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Invoices</h4>
                  <ClientInvoicesHistory clientId={activeClient.id} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Credit Modal */}
      <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credit Line</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            creditMutation.mutate({
              credit_limit: parseFloat(creditData.credit_limit),
              credit_terms: parseInt(creditData.credit_terms)
            });
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Credit Limit (£)</Label>
              <Input required type="number" step="0.01" value={creditData.credit_limit} onChange={e => setCreditData({...creditData, credit_limit: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Terms (Days)</Label>
              <Input required type="number" value={creditData.credit_terms} onChange={e => setCreditData({...creditData, credit_terms: e.target.value})} />
            </div>
            <Button type="submit" className="w-full">Save Credit Info</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
