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

export default function QuotesPage() {
  const queryClient = useQueryClient();
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: '', quotedPrice: '' }]);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['adminQuotes'],
    queryFn: async () => {
      const res = await api.get('/api/admin/quotes');
      return res.data;
    }
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/quotes/${id}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminQuotes'] })
  });

  const draftMutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/admin/quotes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuotes'] });
      setIsDraftModalOpen(false);
    }
  });

  const handleDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    draftMutation.mutate({
      clientId: parseInt(clientId),
      items: items.map(i => ({
        productId: parseInt(i.productId),
        quantity: parseInt(i.quantity),
        quotedPrice: parseFloat(i.quotedPrice)
      }))
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sales Quotes</h2>
        <Button onClick={() => {
          setClientId('');
          setItems([{ productId: '', quantity: '', quotedPrice: '' }]);
          setIsDraftModalOpen(true);
        }}>
          + Draft Quote
        </Button>
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote ID</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : quotes?.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell>#{q.id}</TableCell>
                <TableCell>{q.client_id}</TableCell>
                <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{q.order_id ? `#${q.order_id}` : '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{q.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {q.status === 'pending' && (
                    <Button size="sm" onClick={() => sendMutation.mutate(q.id)}>Send to Client</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDraftModalOpen} onOpenChange={setIsDraftModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draft New Quote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDraftSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input required type="number" value={clientId} onChange={e => setClientId(e.target.value)} />
            </div>
            
            <div className="pt-4 border-t">
              <Label className="mb-2 block">Line Items</Label>
              {items.map((item, idx) => (
                <div key={idx} className="flex space-x-2 mb-2">
                  <Input required placeholder="Product ID" type="number" value={item.productId} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].productId = e.target.value;
                    setItems(newItems);
                  }} />
                  <Input required placeholder="Qty" type="number" value={item.quantity} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].quantity = e.target.value;
                    setItems(newItems);
                  }} />
                  <Input required placeholder="Custom Price ($)" type="number" step="0.01" value={item.quotedPrice} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].quotedPrice = e.target.value;
                    setItems(newItems);
                  }} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { productId: '', quantity: '', quotedPrice: '' }])}>
                + Add Item
              </Button>
            </div>

            <Button type="submit" className="w-full mt-4">Draft Quote</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
