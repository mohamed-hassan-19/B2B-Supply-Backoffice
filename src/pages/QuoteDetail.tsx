import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = role === 'super_admin' || role === 'sales' || role === 'operator';

  const { data: quote, isLoading } = useQuery({
    queryKey: ['adminQuote', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/quotes/${id}`);
      return res.data;
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ['adminProducts', 'all'],
    queryFn: async () => {
      const res = await api.get(`/api/admin/products?limit=1000`);
      return res.data;
    }
  });

  const sendMutation = useMutation({
    mutationFn: (quoteId: number) => api.post(`/api/admin/quotes/${quoteId}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuote', id] });
    }
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [validUntil, setValidUntil] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [items, setItems] = useState<any[]>([]);

  const updateQuoteMutation = useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: number; data: any }) => api.patch(`/api/admin/quotes/${quoteId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuote', id] });
      setIsEditModalOpen(false);
    }
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    const payload: any = {
      items: items.map(i => ({
        productId: i.isCustom ? null : parseInt(i.productId),
        quantity: parseInt(i.quantity),
        quotedPrice: i.quotedPrice ? parseFloat(i.quotedPrice) : 0,
        purchase_unit: i.purchaseUnit,
        dozen_size_at_purchase: i.dozenSize,
        discount_percentage: i.discountPercentage ? parseFloat(i.discountPercentage) : null,
        custom_item_name: i.customItemName,
        custom_item_description: i.customItemDescription,
        is_cancelled: i.isCancelled,
        original_order_item_id: i.originalOrderItemId
      }))
    };
    if (validUntil) {
      payload.valid_until = new Date(validUntil).toISOString();
    } else {
      payload.valid_until = null;
    }
    if (discountPercentage) {
      payload.discount_percentage = parseFloat(discountPercentage);
    } else {
      payload.discount_percentage = null;
    }
    updateQuoteMutation.mutate({ quoteId: quote.id, data: payload });
  };

  const openEditModal = () => {
    if (!quote) return;
    setValidUntil(quote.valid_until ? new Date(quote.valid_until).toISOString().split('T')[0] : '');
    setDiscountPercentage(quote.discount_percentage ? quote.discount_percentage.toString() : '');
    if (quote.QuoteItems && quote.QuoteItems.length > 0) {
      setItems(quote.QuoteItems.map((qi: any) => ({
        productId: qi.product_id ? qi.product_id.toString() : '',
        quantity: qi.requested_quantity ? qi.requested_quantity.toString() : '',
        quotedPrice: qi.quoted_price ? qi.quoted_price.toString() : '',
        purchaseUnit: qi.purchase_unit || 'single',
        dozenSize: qi.dozen_size_at_purchase || null,
        discountPercentage: qi.discount_percentage ? qi.discount_percentage.toString() : '',
        customItemName: qi.custom_item_name || '',
        customItemDescription: qi.custom_item_description || '',
        isCustom: !!qi.custom_item_name,
        isCancelled: !!qi.is_cancelled,
        originalOrderItemId: qi.original_order_item_id || null
      })));
    } else {
      setItems([{ productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', customItemName: '', customItemDescription: '', isCustom: false, isCancelled: false, originalOrderItemId: null }]);
    }
    setIsEditModalOpen(true);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Quote Details...</div>;
  if (!quote) return <div className="p-8 text-center text-red-500">Quote not found.</div>;

  const typeLabel = quote.is_custom_request ? 'Custom Request' : (quote.related_order_id ? 'Order Update' : 'New Quote');

  // Build Diff map for Order Update
  const originalItemsMap = new Map();
  if (quote.related_order_id && quote.RelatedOrder && quote.RelatedOrder.OrderItems) {
    quote.RelatedOrder.OrderItems.forEach((oi: any) => {
      originalItemsMap.set(oi.id, oi);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Quote #{quote.id}
          <Badge variant="outline" className="text-sm">
            {typeLabel} {quote.related_order_id && `(Order #${quote.related_order_id})`}
          </Badge>
          <Badge variant={
            quote.status === 'accepted' ? 'default' :
            quote.status === 'rejected' ? 'destructive' :
            quote.status === 'expired' ? 'outline' : 'secondary'
          }>
            {quote.status.toUpperCase()}
          </Badge>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-md shadow-sm border space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Client Information</h2>
          <div><span className="font-medium">Company:</span> {quote.Client?.company_name || `Client #${quote.client_id}`}</div>
          <div><span className="font-medium">Contact:</span> {quote.Client?.email || 'N/A'}</div>
          {quote.Client?.is_priority && <Badge variant="default" className="bg-orange-500 mt-2">Priority Client</Badge>}
        </div>

        <div className="bg-white p-6 rounded-md shadow-sm border space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Quote Meta</h2>
          <div><span className="font-medium">Created:</span> {new Date(quote.createdAt).toLocaleDateString()}</div>
          <div><span className="font-medium">Valid Until:</span> {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'No Expiry'}</div>
          {quote.attachment_url && (
            <div>
              <span className="font-medium">Attachment:</span>{' '}
              <a href={quote.attachment_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {quote.attachment_name || 'Download File'}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-md shadow-sm border space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-xl font-semibold">Line Items {quote.related_order_id && '(Diff against Order)'}</h2>
          <div className="flex gap-2">
            {(quote.status === 'pending' || quote.status === 'sent') && canWrite && (
              <Button variant="outline" onClick={openEditModal}>Edit Items</Button>
            )}
            {quote.status === 'pending' && canWrite && (
              <Button onClick={() => sendMutation.mutate(quote.id)} disabled={sendMutation.isPending}>
                {sendMutation.isPending ? 'Sending...' : 'Send to Client'}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {quote.related_order_id ? (
            // Diff Table
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Item</th>
                  <th className="p-2 border bg-red-50 text-red-800">Original State (Order)</th>
                  <th className="p-2 border bg-green-50 text-green-800">Proposed State (Quote)</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Process QuoteItems (Added or Modified/Unchanged) */}
                {quote.QuoteItems?.map((qi: any) => {
                  const original = qi.original_order_item_id ? originalItemsMap.get(qi.original_order_item_id) : null;
                  let diffStatus = 'ADDED';
                  if (original) {
                    if (original.quantity !== qi.requested_quantity || original.unit_price !== qi.quoted_price || original.discount_percentage !== qi.discount_percentage || original.is_cancelled !== qi.is_cancelled) {
                      diffStatus = 'MODIFIED';
                    } else {
                      diffStatus = 'UNCHANGED';
                    }
                    originalItemsMap.delete(qi.original_order_item_id);
                  }

                  return (
                    <tr key={qi.id} className="border-b">
                      <td className="p-2">
                        <Badge variant="outline" className={diffStatus === 'ADDED' ? 'bg-green-100 text-green-800' : diffStatus === 'MODIFIED' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                          {diffStatus}
                        </Badge>
                      </td>
                      <td className="p-2 font-medium">
                        {qi.custom_item_name || qi.Product?.name}
                        {qi.custom_item_description && <div className="text-xs text-gray-500 font-normal mt-1">{qi.custom_item_description}</div>}
                      </td>
                      <td className="p-2 border-x bg-red-50">
                        {original ? (
                          <div className={original.is_cancelled ? 'line-through text-gray-400' : ''}>
                            Qty: {original.quantity} &times; £{original.unit_price} /{original.purchase_unit}
                            {original.discount_percentage > 0 && ` (-${original.discount_percentage}%)`}
                          </div>
                        ) : <span className="text-gray-400 italic">None</span>}
                      </td>
                      <td className="p-2 bg-green-50">
                        <div className={qi.is_cancelled ? 'line-through text-gray-400' : ''}>
                          Qty: {qi.requested_quantity} &times; £{qi.quoted_price} /{qi.purchase_unit}
                          {qi.discount_percentage > 0 && ` (-${qi.discount_percentage}%)`}
                        </div>
                        {qi.is_cancelled && <span className="text-xs text-red-600 font-bold ml-2">(Already Cancelled)</span>}
                      </td>
                    </tr>
                  );
                })}
                
                {/* 2. Process remaining originalItems (Removed) */}
                {Array.from(originalItemsMap.values()).map((oi: any) => (
                  <tr key={`removed-${oi.id}`} className="border-b">
                    <td className="p-2">
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">REMOVED</Badge>
                    </td>
                    <td className="p-2 font-medium text-gray-500">
                      {oi.custom_item_name || oi.Product?.name || `Product #${oi.product_id}`}
                    </td>
                    <td className="p-2 border-x bg-red-50 text-gray-500">
                      <div className={oi.is_cancelled ? 'line-through text-gray-400' : ''}>
                        Qty: {oi.quantity} &times; £{oi.unit_price} /{oi.purchase_unit}
                      </div>
                    </td>
                    <td className="p-2 bg-green-50 text-gray-400 italic">
                      Removed from quote
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Standard Table
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border-b">Item</th>
                  <th className="p-2 border-b">Unit Price</th>
                  <th className="p-2 border-b">Qty</th>
                  <th className="p-2 border-b">Discount</th>
                  <th className="p-2 border-b text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quote.QuoteItems?.map((qi: any) => (
                  <tr key={qi.id} className={`border-b ${qi.is_cancelled ? 'opacity-50' : ''}`}>
                    <td className="p-2">
                      <div className={qi.is_cancelled ? 'line-through font-medium text-gray-500' : 'font-medium'}>
                        {qi.custom_item_name || qi.Product?.name}
                      </div>
                      {qi.custom_item_description && <div className="text-xs text-gray-500 mt-1">{qi.custom_item_description}</div>}
                      {qi.is_cancelled && <Badge variant="outline" className="text-red-500 mt-1">Already Cancelled</Badge>}
                    </td>
                    <td className="p-2">£{qi.quoted_price} /{qi.purchase_unit}</td>
                    <td className="p-2">{qi.requested_quantity}</td>
                    <td className="p-2">{qi.discount_percentage ? `${qi.discount_percentage}%` : '-'}</td>
                    <td className="p-2 text-right font-medium">
                      {qi.is_cancelled ? '-' : `£${(qi.quoted_price * qi.requested_quantity * (1 - (qi.discount_percentage || 0) / 100)).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end pt-6">
          <div className="w-64 space-y-3">
            <div className="flex justify-between font-medium">
              <span>Order Discount:</span>
              <span>{quote.discount_percentage ? `${quote.discount_percentage}%` : '-'}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Subtracted Discount:</span>
              <span>£{quote.discount_amount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Quote #{quote.id}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Order-Level Discount %</Label>
                <Input type="number" min="0" max="100" step="0.01" value={discountPercentage} onChange={e => setDiscountPercentage(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Items</Label>
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border p-4 rounded-md relative">
                  {item.isCustom ? (
                    <div className="col-span-12 space-y-2 mb-2 border-b pb-4">
                      <Badge variant="outline">Custom Item</Badge>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Item Name</Label>
                          <Input value={item.customItemName} onChange={e => {
                            const newItems = [...items];
                            newItems[index].customItemName = e.target.value;
                            setItems(newItems);
                          }} placeholder="Custom product name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input value={item.customItemDescription} onChange={e => {
                            const newItems = [...items];
                            newItems[index].customItemDescription = e.target.value;
                            setItems(newItems);
                          }} placeholder="Details..." />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <select 
                        required
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm"
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].productId = e.target.value;
                          setItems(newItems);
                        }}
                      >
                        <option value="" disabled>Select...</option>
                        {(productsData?.items || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} - £{p.price}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm"
                      value={item.purchaseUnit}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].purchaseUnit = e.target.value;
                        setItems(newItems);
                      }}
                    >
                      <option value="single">Single</option>
                      <option value="dozen">Dozen</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      required 
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].quantity = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit Price (£)</Label>
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      required 
                      value={item.quotedPrice}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].quotedPrice = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Discount %</Label>
                    <Input 
                      type="number" 
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 5"
                      value={item.discountPercentage}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].discountPercentage = e.target.value;
                        setItems(newItems);
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center pb-1">
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm"
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
                  <div className="col-span-12 mt-2 flex justify-between">
                    <label className="flex items-center space-x-2 text-sm text-red-600 font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={item.isCancelled}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].isCancelled = e.target.checked;
                          setItems(newItems);
                        }}
                      />
                      <span>Cancel Item</span>
                    </label>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', customItemName: '', customItemDescription: '', isCustom: false, isCancelled: false, originalOrderItemId: null }])}>
                  + Add Item
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { productId: '', quantity: '', quotedPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', customItemName: '', customItemDescription: '', isCustom: true, isCancelled: false, originalOrderItemId: null }])}>
                  + Add Custom Item
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={updateQuoteMutation.isPending}>
              {updateQuoteMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
