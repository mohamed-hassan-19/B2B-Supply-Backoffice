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
  const [cancelComment, setCancelComment] = useState('');

  const [isCancelItemModalOpen, setIsCancelItemModalOpen] = useState(false);
  const [itemCancelReason, setItemCancelReason] = useState('');
  const [itemCancelComment, setItemCancelComment] = useState('');
  const [activeItemToCancel, setActiveItemToCancel] = useState<any>(null);

  // Group 12 filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [startDate, endDate, clientFilter]);

const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);
const [moClientId, setMoClientId] = useState('');
const [moItems, setMoItems] = useState<any[]>([{ productId: '', customItemName: '', customItemDescription: '', quantity: '', unitPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', isCustom: false }]);
const [moPaymentMethod, setMoPaymentMethod] = useState<'COD' | 'Credit'>('COD');
const [moDiscountPercentage, setMoDiscountPercentage] = useState('');
const [moSource, setMoSource] = useState('whatsapp');
const [moNotes, setMoNotes] = useState('');
const [moConsent, setMoConsent] = useState(false);

const manualOrderMutation = useMutation({
  mutationFn: async () => {
    const payload = {
      clientId: parseInt(moClientId),
      paymentMethod: moPaymentMethod,
      discountPercentage: moDiscountPercentage ? parseFloat(moDiscountPercentage) : undefined,
      source: moSource,
      notes: moNotes,
      items: moItems.map(i => {
        let qty = parseFloat(i.quantity);
        if (i.purchaseUnit === 'dozen' && i.dozenSize) qty = qty * i.dozenSize;
        if (i.isCustom) {
          return {
            customItemName: i.customItemName,
            customItemDescription: i.customItemDescription,
            quantity: qty,
            purchaseUnit: i.purchaseUnit,
            unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : 0,
            discountPercentage: i.discountPercentage ? parseFloat(i.discountPercentage) : undefined
          };
        } else {
          return {
            productId: parseInt(i.productId),
            quantity: qty,
            purchaseUnit: i.purchaseUnit,
            discountPercentage: i.discountPercentage ? parseFloat(i.discountPercentage) : undefined
          };
        }
      })
    };
    return api.post('/api/admin/orders/create-manual', payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    setIsManualOrderOpen(false);
    setMoItems([{ productId: '', customItemName: '', customItemDescription: '', quantity: '', unitPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', isCustom: false }]);
    setMoClientId('');
    setMoNotes('');
    setMoConsent(false);
  }
});

  const { data: productsData } = useQuery({ 
    queryKey: ['adminProductsList'], 
    queryFn: async () => {
      const res = await api.get('/api/admin/products?limit=1000');
      return res.data.items || res.data;
    }
  });

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

  const { data: packingMaterials } = useQuery({
    queryKey: ['packing-materials'],
    queryFn: async () => {
      const res = await api.get('/api/admin/packing-materials');
      return res.data;
    }
  });

  const [selectedPackingMaterial, setSelectedPackingMaterial] = useState('');
  const [packingMaterialQuantity, setPackingMaterialQuantity] = useState(1);

  const packingMaterialMutation = useMutation({
    mutationFn: ({ id, packing_material_id, quantity_used }: { id: number, packing_material_id: number, quantity_used: number }) => 
      api.post(`/api/admin/orders/${id}/packing-materials`, { packing_material_id, quantity_used }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails', activeOrder?.id] });
      if (res.data?.warning) {
        alert('⚠️ ' + res.data.warning);
      } else {
        alert('Packing material recorded successfully');
      }
      setSelectedPackingMaterial('');
      setPackingMaterialQuantity(1);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to record packing material');
    }
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

  const [discountInput, setDiscountInput] = useState('');
  const [itemDiscounts, setItemDiscounts] = useState<Record<number, string>>({});
  const canWrite = role === 'super_admin';

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

  const cancelItemMutation = useMutation({
    mutationFn: ({ id, itemId, reason }: { id: number, itemId: number, reason: string }) => 
      api.patch(`/api/admin/orders/${id}/items/${itemId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
      setIsCancelItemModalOpen(false);
      setItemCancelReason('');
      setActiveItemToCancel(null);
    }
  });

  const discountMutation = useMutation({
    mutationFn: ({ id, discount_percentage }: { id: number, discount_percentage: number }) =>
      api.patch(`/api/admin/orders/${id}/discount`, { discount_percentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
      alert('Discount applied successfully!');
      setDiscountInput('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to apply discount');
    }
  });

  const itemDiscountMutation = useMutation({
    mutationFn: ({ id, itemId, discount_percentage }: { id: number, itemId: number, discount_percentage: number }) =>
      api.patch(`/api/admin/orders/${id}/items/${itemId}/discount`, { discount_percentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to apply item discount');
    }
  });

  const reviseMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/orders/${id}/revise`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrderDetails'] });
      alert('Revision quote created successfully. Quote ID: ' + res.data.quote_id);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create revision quote');
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
          <div className="flex gap-2">
            {(role === 'super_admin' || role === 'sales') && (
              <Button onClick={() => setIsManualOrderOpen(true)}>Create Manual Order</Button>
            )}
            <Button variant="outline" onClick={handleExport}>
              Export to Excel
            </Button>
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
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="details">Order Details</TabsTrigger>
                <TabsTrigger value="packing-materials">Packing Materials</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Client</span> {activeOrderDetails.client?.company_name}</div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Date</span> {new Date(activeOrderDetails.order.createdAt).toLocaleString()}</div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Status</span> <Badge variant={getStatusBadge(activeOrderDetails.order.status)}>{activeOrderDetails.order.status.toUpperCase()}</Badge></div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Total</span> £{Number(activeOrderDetails.order.total_amount).toFixed(2)}</div>
                  <div><span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-1">Discount</span> {activeOrderDetails.order.discount_percentage ? `${Number(activeOrderDetails.order.discount_percentage).toFixed(2)}%` : '0%'} (£{Number(activeOrderDetails.order.discount_amount || 0).toFixed(2)})</div>
                  
                  {(role === 'super_admin' || role === 'sales' || role === 'operator') && (activeOrderDetails.order.status === 'pending' || activeOrderDetails.order.status === 'approved') && (
                    <div className="col-span-2 border-t pt-2 mt-2">
                      <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wider mb-2">Apply Discount Percentage</span>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="Percentage (e.g. 10)"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          className="w-48"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (activeOrder && discountInput !== '') {
                              discountMutation.mutate({ id: activeOrder.id, discount_percentage: parseFloat(discountInput) });
                            }
                          }}
                          disabled={discountMutation.isPending}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}

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
                        <TableHead>Product ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount %</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrderDetails.items?.map((item: any) => {
                        const isDozen = item.purchase_unit === 'dozen' && item.dozen_size_at_purchase;
                        const displayQty = isDozen 
                          ? `${item.quantity / item.dozen_size_at_purchase} dozens (${item.quantity} units)`
                          : item.quantity;
                        const displayPrice = isDozen
                          ? `£${Number(item.unit_price * item.dozen_size_at_purchase).toFixed(2)} / dz`
                          : `£${Number(item.unit_price).toFixed(2)}`;

                        const itemTotal = Number(item.unit_price) * item.quantity;
                        const discountedTotal = itemTotal - (Number(item.discount_amount) || 0);
                        const hasDiscount = Number(item.discount_amount) > 0;
                        
                        const showDiscountInput = canWrite && (activeOrderDetails.order.status === 'pending' || activeOrderDetails.order.status === 'approved') && !item.is_cancelled;
                        const showCancelItemButton = canWrite && (activeOrderDetails.order.status === 'pending' || activeOrderDetails.order.status === 'approved') && !item.is_cancelled;

                        return (
                        <TableRow key={item.id} className={item.is_cancelled ? 'opacity-50' : ''}>
                          <TableCell>#{item.product_id}</TableCell>
                          <TableCell>
                            <span className={item.is_cancelled ? 'line-through text-gray-500' : ''}>
                              {item.product_name || `Product #${item.product_id}`}
                            </span>
                            {item.is_cancelled && <span className="ml-1">(Cancelled)</span>}
                          </TableCell>
                          <TableCell className="text-right">{displayQty}</TableCell>
                          <TableCell className="text-right">{displayPrice}</TableCell>
                          <TableCell className="text-right">
                            {showDiscountInput ? (
                              <div className="flex justify-end gap-2 items-center">
                                <Input 
                                  type="number" 
                                  className="w-20 h-8 text-right" 
                                  min="0" max="100" step="0.01"
                                  value={itemDiscounts[item.id] !== undefined ? itemDiscounts[item.id] : (item.discount_percentage || '')}
                                  onChange={(e) => setItemDiscounts({ ...itemDiscounts, [item.id]: e.target.value })}
                                />
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="h-8 px-2"
                                  onClick={() => {
                                    const val = itemDiscounts[item.id];
                                    if (val !== undefined && val !== '') {
                                      itemDiscountMutation.mutate({ 
                                        id: activeOrder.id, 
                                        itemId: item.id, 
                                        discount_percentage: parseFloat(val) 
                                      });
                                    }
                                  }}
                                  disabled={itemDiscountMutation.isPending}
                                >
                                  Save
                                </Button>
                                {showCancelItemButton && (
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setActiveItemToCancel(item);
                                      setIsCancelItemModalOpen(true);
                                    }}
                                  >
                                    Cancel Item
                                  </Button>
                                )}
                              </div>
                            ) : (
                              item.discount_percentage && !item.is_cancelled ? `${Number(item.discount_percentage).toFixed(2)}%` : '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.is_cancelled ? (
                              <span className="line-through text-gray-500 text-xs">£{itemTotal.toFixed(2)}</span>
                            ) : hasDiscount ? (
                              <div className="flex flex-col items-end">
                                <span className="line-through text-gray-500 text-xs">£{itemTotal.toFixed(2)}</span>
                                <span className="font-bold text-green-600">£{discountedTotal.toFixed(2)}</span>
                              </div>
                            ) : (
                              `£${discountedTotal.toFixed(2)}`
                            )}
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  {(role === 'super_admin' || role === 'sales' || role === 'operator') && (activeOrderDetails.order.status === 'pending' || activeOrderDetails.order.status === 'approved') && (
                    <Button variant="outline" onClick={() => reviseMutation.mutate(activeOrder.id)} disabled={reviseMutation.isPending}>
                      Propose Revision
                    </Button>
                  )}
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

              <TabsContent value="packing-materials">
                <div className="space-y-6">
                  {(role === 'super_admin' || role === 'operator') && (
                    <div className="bg-white p-4 border rounded-md shadow-sm space-y-4">
                      <h4 className="font-semibold text-sm">Record Packing Material Used</h4>
                      <div className="flex gap-4 items-end">
                        <div className="space-y-1 flex-1">
                          <Label>Material</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
                            value={selectedPackingMaterial}
                            onChange={e => setSelectedPackingMaterial(e.target.value)}
                          >
                            <option value="" disabled>Select material...</option>
                            {packingMaterials?.map((m: any) => (
                              <option key={m.id} value={m.id}>{m.name} (Stock: {m.stock_quantity})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 w-32">
                          <Label>Quantity Used</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            className="h-9" 
                            value={packingMaterialQuantity} 
                            onChange={e => setPackingMaterialQuantity(parseInt(e.target.value) || 1)} 
                          />
                        </div>
                        <Button 
                          onClick={() => packingMaterialMutation.mutate({ 
                            id: activeOrder.id, 
                            packing_material_id: parseInt(selectedPackingMaterial), 
                            quantity_used: packingMaterialQuantity 
                          })}
                          disabled={!selectedPackingMaterial || packingMaterialQuantity < 1 || packingMaterialMutation.isPending}
                        >
                          {packingMaterialMutation.isPending ? 'Recording...' : 'Record Usage'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-md border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Quantity Used</TableHead>
                          <TableHead>Recorded By</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeOrderDetails.packing_material_usages?.length > 0 ? (
                          activeOrderDetails.packing_material_usages.map((usage: any) => (
                            <TableRow key={usage.id}>
                              <TableCell className="font-medium">{usage.PackingMaterial?.name || `Material #${usage.packing_material_id}`}</TableCell>
                              <TableCell>{usage.PackingMaterial?.category}</TableCell>
                              <TableCell>{usage.quantity_used}</TableCell>
                              <TableCell>{usage.AdminUser?.name || `User #${usage.used_by_id}`}</TableCell>
                              <TableCell>{new Date(usage.createdAt).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                              No packing material recorded for this order.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
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
              <select 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Customer requested cancellation">Customer requested cancellation</option>
                <option value="Product no longer required">Product no longer required</option>
                <option value="Product out of stock">Product out of stock</option>
                <option value="Wrong product ordered">Wrong product ordered</option>
                <option value="Wrong quantity ordered">Wrong quantity ordered</option>
                <option value="Duplicate item/order">Duplicate item/order</option>
                <option value="Pricing issue">Pricing issue</option>
                <option value="Customer changed requirements">Customer changed requirements</option>
                <option value="Order entry mistake">Order entry mistake</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Additional Comment {cancelReason !== 'Other' && <span className="text-gray-400 font-normal">(Optional)</span>}</Label>
              <Input 
                value={cancelComment}
                onChange={(e) => setCancelComment(e.target.value)}
                placeholder="Provide more details..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
              <Button 
                variant="destructive" 
                disabled={!cancelReason || (cancelReason === 'Other' && !cancelComment.trim())}
                onClick={() => {
                  if (activeOrder) {
                    const finalReason = cancelComment.trim() ? `${cancelReason} - ${cancelComment.trim()}` : cancelReason;
                    cancelMutation.mutate({ id: activeOrder.id, reason: finalReason });
                  }
                }}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelItemModalOpen} onOpenChange={setIsCancelItemModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Are you sure you want to cancel {activeItemToCancel?.product_name || `Product #${activeItemToCancel?.product_id}`}?
            </p>
            <div className="space-y-2">
              <Label>Cancellation Reason</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                value={itemCancelReason}
                onChange={(e) => setItemCancelReason(e.target.value)}
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Customer requested cancellation">Customer requested cancellation</option>
                <option value="Product no longer required">Product no longer required</option>
                <option value="Product out of stock">Product out of stock</option>
                <option value="Wrong product ordered">Wrong product ordered</option>
                <option value="Wrong quantity ordered">Wrong quantity ordered</option>
                <option value="Duplicate item/order">Duplicate item/order</option>
                <option value="Pricing issue">Pricing issue</option>
                <option value="Customer changed requirements">Customer changed requirements</option>
                <option value="Order entry mistake">Order entry mistake</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Additional Comment {itemCancelReason !== 'Other' && <span className="text-gray-400 font-normal">(Optional)</span>}</Label>
              <Input 
                value={itemCancelComment}
                onChange={(e) => setItemCancelComment(e.target.value)}
                placeholder="Provide more details..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCancelItemModalOpen(false)}>Back</Button>
              <Button 
                variant="destructive" 
                disabled={!itemCancelReason || (itemCancelReason === 'Other' && !itemCancelComment.trim()) || cancelItemMutation.isPending}
                onClick={() => {
                  if (activeOrder && activeItemToCancel) {
                    const finalReason = itemCancelComment.trim() ? `${itemCancelReason} - ${itemCancelComment.trim()}` : itemCancelReason;
                    cancelItemMutation.mutate({ id: activeOrder.id, itemId: activeItemToCancel.id, reason: finalReason });
                  }
                }}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isManualOrderOpen} onOpenChange={setIsManualOrderOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Manual Order (Sales/Phone)</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (moConsent) manualOrderMutation.mutate(); }} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client (Must be approved)</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={moClientId}
                  onChange={e => setMoClientId(e.target.value)}
                >
                  <option value="" disabled>Select Client...</option>
                  {(clientsData || []).filter((c: any) => c.status === 'approved').map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={moPaymentMethod}
                  onChange={e => setMoPaymentMethod(e.target.value as any)}
                >
                  <option value="COD">COD</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Source / Channel</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={moSource}
                  onChange={e => setMoSource(e.target.value)}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Order-Level Discount %</Label>
                <Input 
                  type="number" min="0" max="100" step="any"
                  value={moDiscountPercentage}
                  onChange={e => setMoDiscountPercentage(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              <div className="space-y-2">
                {moItems.map((item, idx) => {
                  let displayQuantity = item.quantity;
                  if (item.purchaseUnit === 'dozen' && item.dozenSize && item.quantity) {
                    displayQuantity = (parseFloat(item.quantity) / item.dozenSize).toString();
                  }

                  return (
                  <div key={idx} className="flex flex-col md:flex-row gap-2 items-start border p-2 rounded relative">
                    <div className="flex-1 space-y-2 w-full">
                      {item.isCustom ? (
                        <>
                          <Input required placeholder="Custom Item Name" value={item.customItemName} onChange={e => {
                            const newItems = [...moItems];
                            newItems[idx].customItemName = e.target.value;
                            setMoItems(newItems);
                          }} />
                          <Input placeholder="Description" value={item.customItemDescription} onChange={e => {
                            const newItems = [...moItems];
                            newItems[idx].customItemDescription = e.target.value;
                            setMoItems(newItems);
                          }} />
                        </>
                      ) : (
                        <select 
                          required
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={item.productId}
                          onChange={e => {
                            const newItems = [...moItems];
                            newItems[idx].productId = e.target.value;
                            const p = (productsData || []).find((p: any) => p.id === parseInt(e.target.value));
                            newItems[idx].dozenSize = p?.dozen_quantity ? parseInt(p.dozen_quantity) : null;
                            if (!newItems[idx].dozenSize) newItems[idx].purchaseUnit = 'single';
                            setMoItems(newItems);
                          }}
                        >
                          <option value="" disabled>Select Catalog Item...</option>
                          {(productsData || []).filter((p: any) => p.is_active).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_level})</option>
                          ))}
                        </select>
                      )}
                      
                      <div className="flex gap-2">
                        <Input required placeholder={item.purchaseUnit === 'dozen' ? "Qty (Dozens)" : "Qty"} type="number" min="0" step="any" value={displayQuantity === 'NaN' ? '' : displayQuantity} onChange={(e: any) => {
                          const newItems = [...moItems];
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
                          setMoItems(newItems);
                        }} className="md:flex-1" />
                        
                        {item.isCustom ? (
                          <Input required placeholder="Price (EGP)" type="number" min="0" step="any" value={item.unitPrice} onChange={(e: any) => {
                            const newItems = [...moItems];
                            newItems[idx].unitPrice = e.target.value;
                            setMoItems(newItems);
                          }} className="md:flex-1" />
                        ) : (
                          <Input disabled placeholder="Catalog Price" className="md:flex-1 bg-gray-100" title="Price is automatically derived from the catalog" />
                        )}
                        
                        <Input 
                          placeholder="Disc. %" 
                          type="number" min="0" max="100" step="any" 
                          value={item.discountPercentage} 
                          onChange={(e: any) => {
                            const newItems = [...moItems];
                            newItems[idx].discountPercentage = e.target.value;
                            setMoItems(newItems);
                          }} 
                          className="w-24" 
                        />

                        {item.dozenSize && (
                          <Button
                            type="button" variant="outline" size="sm" className="whitespace-nowrap h-10"
                            onClick={() => {
                              const newItems = [...moItems];
                              newItems[idx].purchaseUnit = item.purchaseUnit === 'single' ? 'dozen' : 'single';
                              setMoItems(newItems);
                            }}
                          >
                            Buy by: {item.purchaseUnit === 'single' ? 'Single' : 'Dozen'}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      type="button" variant="destructive" size="icon"
                      disabled={moItems.length === 1}
                      onClick={() => {
                        const newItems = [...moItems];
                        newItems.splice(idx, 1);
                        setMoItems(newItems);
                      }}
                    >
                      X
                    </Button>
                  </div>
                )})}
                
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMoItems([...moItems, { productId: '', quantity: '', unitPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', isCustom: false }])}>
                    + Add Catalog Item
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMoItems([...moItems, { productId: '', customItemName: '', customItemDescription: '', quantity: '', unitPrice: '', purchaseUnit: 'single', dozenSize: null, discountPercentage: '', isCustom: true }])}>
                    + Add Custom Item
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input value={moNotes} onChange={e => setMoNotes(e.target.value)} placeholder="Agreed to ship on Monday..." />
            </div>

            <div className="flex items-center gap-2 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <input type="checkbox" id="moConsent" required checked={moConsent} onChange={e => setMoConsent(e.target.checked)} className="w-4 h-4" />
              <Label htmlFor="moConsent" className="text-sm font-semibold cursor-pointer">I confirm the client has agreed to this order and commits to payment.</Label>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={manualOrderMutation.isPending || !moConsent}>
              {manualOrderMutation.isPending ? 'Creating Order...' : 'Create Manual Order'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}