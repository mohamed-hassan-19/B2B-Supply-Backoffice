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
import { useNavigate } from 'react-router-dom';

export default function QuotesPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = role === 'super_admin' || role === 'sales' || role === 'operator';
  const queryClient = useQueryClient();
  
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string; quotedPrice: string; purchaseUnit: 'single' | 'dozen'; dozenSize: number | null; discountPercentage: string }[]>([{ productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '' }]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState('');



  // Group 12 Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [startDate, endDate, clientFilter, typeFilter]);

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

  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['adminQuotes', startDate, endDate, clientFilter, page, typeFilter],
    queryFn: async () => {
      let url = `/api/admin/quotes?page=${page}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (clientFilter) url += `client_id=${clientFilter}&`;
      if (typeFilter !== 'all') url += `quote_type=${typeFilter}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const quotes = quotesData?.items || [];
  const total = quotesData?.total || 0;

  const sendMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/quotes/${id}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminQuotes'] })
  });

  const draftMutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/admin/quotes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuotes'] });
      setIsDraftModalOpen(false);
      setClientId('');
      setValidUntil('');
      setItems([{ productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '' }]);
    }
  });

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/api/admin/quotes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuotes'] });
      setIsEditModalOpen(false);
      setEditingQuote(null);
    }
  });

  const handleDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      clientId: parseInt(clientId),
      items: items.map(i => ({
        productId: parseInt(i.productId),
        quantity: parseInt(i.quantity),
        quotedPrice: parseFloat(i.quotedPrice),
        purchase_unit: i.purchaseUnit,
        dozen_size_at_purchase: i.dozenSize,
        discount_percentage: i.discountPercentage ? parseFloat(i.discountPercentage) : null
      }))
    };
    if (validUntil) {
      payload.valid_until = new Date(validUntil).toISOString();
    }
    draftMutation.mutate(payload);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote) return;
    const payload: any = {
      items: items.map(i => ({
        productId: parseInt(i.productId),
        quantity: parseInt(i.quantity),
        quotedPrice: parseFloat(i.quotedPrice),
        purchase_unit: i.purchaseUnit,
        dozen_size_at_purchase: i.dozenSize,
        discount_percentage: i.discountPercentage ? parseFloat(i.discountPercentage) : null
      }))
    };
    if (validUntil) {
      payload.valid_until = new Date(validUntil).toISOString();
    } else {
      payload.valid_until = null;
    }
    if (discountPercentage !== '') {
      payload.discount_percentage = parseFloat(discountPercentage);
    } else {
      payload.discount_percentage = null;
    }
    updateQuoteMutation.mutate({ id: editingQuote.id, data: payload });
  };

  const handleExport = async () => {
    let url = `/api/admin/quotes?export=true&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    if (clientFilter) url += `client_id=${clientFilter}&`;
      if (typeFilter !== 'all') url += `quote_type=${typeFilter}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((q: any) => ({
      'Quote ID': q.id,
      'Type': q.parent_quote_id ? 'Revision' : 'New',
      'Client Name': q.Client?.company_name || q.client_id,
      'Date': new Date(q.createdAt).toLocaleDateString(),
      'Valid Until': q.valid_until ? new Date(q.valid_until).toLocaleDateString() : 'No Expiry',
      'Order ID': q.order_id || 'N/A',
      'Status': q.status
    }));
    exportToExcel(exportData, 'quotes');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sales Quotes</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            Export to Excel
          </Button>
          {canWrite && (
            <Button onClick={() => setIsDraftModalOpen(true)}>
              + Draft Quote
            </Button>
          )}
        </div>
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
          <div className="space-y-1">
            <Label>Type</Label>
            <select 
              className="flex h-9 w-48 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="new">New Quote</option>
              <option value="revision">Order Update</option>
              <option value="custom">Custom Request</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : quotes.map((q: any) => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/quotes/${q.id}`)}>
                <TableCell>
                  #{q.id}
                  {q.parent_quote_id && <div className="text-xs text-gray-500">Rev of #{q.parent_quote_id}</div>}
                </TableCell>
                <TableCell>
                    {q.is_custom_request ? (
                      <Badge variant="outline">Custom Request</Badge>
                    ) : q.related_order_id ? (
                      <Badge variant="outline">
                        Order Update <span className="ml-1 text-xs text-gray-500">(Order #{q.related_order_id})</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline">New Quote</Badge>
                    )}
                  </TableCell>
                <TableCell className="font-medium">{q.Client?.company_name || `Client #${q.client_id}`}</TableCell>
                <TableCell>{new Date(q.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={
                    q.status === 'accepted' ? 'default' : 
                    q.status === 'rejected' ? 'destructive' : 
                    q.status === 'expired' ? 'outline' : 'secondary'
                  }>
                    {q.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/quotes/${q.id}`)}>
                      View Details
                    </Button>
                    {q.status === 'pending' && canWrite && (
                      <Button variant="outline" size="sm" onClick={() => sendMutation.mutate(q.id)}>
                        Send to Client
                      </Button>
                    )}
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {quotes.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={quotes.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Quote #{editingQuote?.id}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Discount Percentage</Label>
                <Input type="number" min="0" max="100" step="0.01" placeholder="e.g. 10" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '' }])}>
                  Add Item
                </Button>
              </div>
              {items.map((item, index) => {
                const displayQuantity = item.purchaseUnit === 'dozen' && item.dozenSize 
                  ? (parseFloat(item.quantity || '0') / item.dozenSize).toString() 
                  : item.quantity;
                const displayPrice = item.purchaseUnit === 'dozen' && item.dozenSize 
                  ? (parseFloat(item.quotedPrice || '0') * item.dozenSize).toString() 
                  : item.quotedPrice;

                return (
                <div key={index} className="flex gap-2 items-start bg-gray-50 p-2 rounded-md">
                  <div className="flex-1 space-y-2">
                    <select
                      required
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={item.productId}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].productId = e.target.value;
                        const p = (productsData?.items || productsData || []).find((p: any) => p.id === parseInt(e.target.value));
                        newItems[index].dozenSize = p?.dozen_quantity ? parseInt(p.dozen_quantity) : null;
                        if (!newItems[index].dozenSize) newItems[index].purchaseUnit = 'single';
                        setItems(newItems);
                      }}
                    >
                      <option value="" disabled>Select Product...</option>
                      {(productsData?.items || []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_level}) - £{p.price}</option>
                      ))}
                    </select>
                    <div className="flex gap-2 items-center">
                      <Input
                        required
                        type="number"
                        min="0"
                        step="any"
                        placeholder={item.purchaseUnit === 'dozen' ? "Qty (Dozens)" : "Qty"}
                        value={displayQuantity === 'NaN' ? '' : displayQuantity}
                        onChange={e => {
                          const newItems = [...items];
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            if (item.purchaseUnit === 'dozen' && item.dozenSize) {
                               newItems[index].quantity = (val * item.dozenSize).toString();
                            } else {
                               newItems[index].quantity = val.toString();
                            }
                          } else {
                             newItems[index].quantity = '';
                          }
                          setItems(newItems);
                        }}
                      />
                      <Input
                        required
                        type="number"
                        min="0"
                        step="any"
                        placeholder={item.purchaseUnit === 'dozen' ? "Quoted Dozen Price (£)" : "Quoted Unit Price (£)"}
                        value={displayPrice === 'NaN' ? '' : displayPrice}
                        onChange={e => {
                          const newItems = [...items];
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            if (item.purchaseUnit === 'dozen' && item.dozenSize) {
                               newItems[index].quotedPrice = (val / item.dozenSize).toString();
                            } else {
                               newItems[index].quotedPrice = val.toString();
                            }
                          } else {
                             newItems[index].quotedPrice = '';
                          }
                          setItems(newItems);
                        }}
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        placeholder="Discount %"
                        value={item.discountPercentage}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].discountPercentage = e.target.value;
                          setItems(newItems);
                        }}
                      />
                      {item.dozenSize && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => {
                            const newItems = [...items];
                            newItems[index].purchaseUnit = item.purchaseUnit === 'single' ? 'dozen' : 'single';
                            setItems(newItems);
                          }}
                        >
                          Buy by: {item.purchaseUnit === 'single' ? 'Single' : 'Dozen'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => {
                      const newItems = [...items];
                      newItems.splice(index, 1);
                      setItems(newItems);
                    }}
                  >
                    X
                  </Button>
                </div>
              )})}
            </div>

            <Button type="submit" className="w-full mt-4" disabled={updateQuoteMutation.isPending}>
              {updateQuoteMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDraftModalOpen} onOpenChange={setIsDraftModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Draft New Quote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDraftSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                >
                  <option value="" disabled>Select Client...</option>
                  {(clientsData || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Valid Until (Optional)</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label>Items</Label>
              {items.map((item, idx) => {
                const displayQuantity = item.purchaseUnit === 'dozen' && item.dozenSize 
                  ? (parseFloat(item.quantity || '0') / item.dozenSize).toString() 
                  : item.quantity;
                const displayPrice = item.purchaseUnit === 'dozen' && item.dozenSize 
                  ? (parseFloat(item.quotedPrice || '0') * item.dozenSize).toString() 
                  : item.quotedPrice;

                return (
                <div key={idx} className="flex gap-2 items-center flex-wrap">
                  <select 
                    required
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm md:w-1/3"
                    value={item.productId}
                    onChange={(e: any) => {
                      const newItems = [...items];
                      newItems[idx].productId = e.target.value;
                      const p = (productsData?.items || productsData || []).find((p: any) => p.id === parseInt(e.target.value));
                      newItems[idx].dozenSize = p?.dozen_quantity ? parseInt(p.dozen_quantity) : null;
                      if (!newItems[idx].dozenSize) newItems[idx].purchaseUnit = 'single';
                      setItems(newItems);
                    }}
                  >
                    <option value="" disabled>Select Item...</option>
                    {(productsData?.items || productsData || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  
                  <Input required placeholder={item.purchaseUnit === 'dozen' ? "Qty (Dozens)" : "Qty"} type="number" min="0" step="any" value={displayQuantity === 'NaN' ? '' : displayQuantity} onChange={(e: any) => {
                    const newItems = [...items];
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      if (item.purchaseUnit === 'dozen' && item.dozenSize) {
                         newItems[idx].quantity = (val * item.dozenSize).toString();
                      } else {
                         newItems[idx].quantity = val.toString();
                      }
                    } else {
                       newItems[idx].quantity = '';
                    }
                    setItems(newItems);
                  }} className="md:flex-1" />
                  
                  <Input required placeholder={item.purchaseUnit === 'dozen' ? "Custom Dozen Price (£)" : "Custom Price (£)"} type="number" min="0" step="any" value={displayPrice === 'NaN' ? '' : displayPrice} onChange={(e: any) => {
                    const newItems = [...items];
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      if (item.purchaseUnit === 'dozen' && item.dozenSize) {
                         newItems[idx].quotedPrice = (val / item.dozenSize).toString();
                      } else {
                         newItems[idx].quotedPrice = val.toString();
                      }
                    } else {
                       newItems[idx].quotedPrice = '';
                    }
                    setItems(newItems);
                  }} className="md:flex-1" />
                  
                  <Input 
                    placeholder="Discount %" 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="any" 
                    value={item.discountPercentage} 
                    onChange={(e: any) => {
                      const newItems = [...items];
                      newItems[idx].discountPercentage = e.target.value;
                      setItems(newItems);
                    }} 
                    className="md:w-24" 
                  />

                  {item.dozenSize && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => {
                        const newItems = [...items];
                        newItems[idx].purchaseUnit = item.purchaseUnit === 'single' ? 'dozen' : 'single';
                        setItems(newItems);
                      }}
                    >
                      Buy by: {item.purchaseUnit === 'single' ? 'Single' : 'Dozen'}
                    </Button>
                  )}
                  
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => {
                      const newItems = [...items];
                      newItems.splice(idx, 1);
                      setItems(newItems);
                    }}
                  >
                    X
                  </Button>
                </div>
              )})}
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '' }])}>
                + Add Item
              </Button>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={draftMutation.isPending}>
              {draftMutation.isPending ? 'Drafting...' : 'Draft Quote'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
