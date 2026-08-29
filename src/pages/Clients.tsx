import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

function ClientOrdersHistory({ clientId }: { clientId: number }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['adminClientOrders', clientId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/orders?client_id=${clientId}`);
      return res.data;
    }
  });

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
              <TableCell>${Number(o.total_amount).toFixed(2)}</TableCell>
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

  const { data: clients, isLoading } = useQuery({
    queryKey: ['adminClients'],
    queryFn: async () => {
      const res = await api.get('/api/admin/clients');
      return res.data;
    }
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

  const canApprove = role === 'super_admin' || role === 'sales';
  const canCredit = role === 'super_admin' || role === 'finance';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : clients?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.id}</TableCell>
                <TableCell className="font-medium">{c.company_name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>
                  <Badge variant={c.status === 'approved' ? 'secondary' : c.status === 'rejected' ? 'destructive' : 'outline'}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell>${c.credit_limit || 0}</TableCell>
                <TableCell className="text-right space-x-2">
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
      </div>

      {/* View Details Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Client Details: {activeClient?.company_name}</DialogTitle>
          </DialogHeader>
          {activeClient && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Email:</span> {activeClient.email}</div>
                <div><span className="font-semibold">Phone:</span> {activeClient.contact_phone}</div>
                <div><span className="font-semibold">Tax ID:</span> {activeClient.tax_id}</div>
                <div><span className="font-semibold">Status:</span> {activeClient.status}</div>
                <div><span className="font-semibold">Credit Limit:</span> ${activeClient.credit_limit || 0}</div>
                <div><span className="font-semibold">Terms:</span> {activeClient.credit_terms || 0} Days</div>
              </div>
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Order History</h3>
                <ClientOrdersHistory clientId={activeClient.id} />
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
              <Label>Credit Limit ($)</Label>
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
