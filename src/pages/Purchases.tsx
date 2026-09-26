import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Form State
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const { data: purchasesData } = useQuery({
    queryKey: ['adminPurchases'],
    queryFn: async () => {
      const res = await api.get('/api/admin/purchases');
      return res.data;
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ['adminProductsList'],
    queryFn: async () => {
      const res = await api.get('/api/admin/products?limit=1000');
      return res.data.items || res.data;
    }
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: async () => {
      const res = await api.get('/api/admin/categories');
      return res.data;
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        quantityPurchased,
        unitCost,
        supplierName,
        purchaseDate,
        notes
      };

      if (mode === 'existing') {
        payload.productId = parseInt(productId);
      } else {
        payload.productName = productName;
        payload.categoryId = parseInt(categoryId);
      }

      return api.post('/api/admin/purchases', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPurchases'] });
      queryClient.invalidateQueries({ queryKey: ['adminProductsList'] });
      setIsModalOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setProductId('');
    setProductName('');
    setCategoryId('');
    setSupplierName('');
    setQuantityPurchased(1);
    setUnitCost(0);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Purchases (Cost Tracking)</h2>
        <Button onClick={() => setIsModalOpen(true)}>Record Purchase</Button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(purchasesData || []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.purchase_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{p.Product?.name || `Product #${p.product_id}`}</TableCell>
                <TableCell>{p.supplier_name || '-'}</TableCell>
                <TableCell>{p.quantity_purchased}</TableCell>
                <TableCell>EGP {Number(p.unit_cost).toFixed(2)}</TableCell>
                <TableCell className="font-semibold text-gray-900">EGP {Number(p.total_cost).toFixed(2)}</TableCell>
                <TableCell>{p.AdminUser?.name || '-'}</TableCell>
              </TableRow>
            ))}
            {(!purchasesData || purchasesData.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-6">No purchases recorded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record New Purchase</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); purchaseMutation.mutate(); }} className="space-y-4 py-4">
            
            <div className="flex gap-4 p-1 bg-gray-100 rounded-md mb-4 w-fit">
              <button 
                type="button" 
                className={`px-4 py-2 text-sm font-medium rounded-md ${mode === 'existing' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
                onClick={() => setMode('existing')}
              >
                Add to Existing Catalog
              </button>
              <button 
                type="button" 
                className={`px-4 py-2 text-sm font-medium rounded-md ${mode === 'new' ? 'bg-white shadow' : 'text-gray-500 hover:text-gray-900'}`}
                onClick={() => setMode('new')}
              >
                Draft New Product
              </button>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-2">
                <Label>Select Product *</Label>
                <select 
                  required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                >
                  <option value="" disabled>Select Catalog Item...</option>
                  {(productsData || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock_level})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Product Name *</Label>
                  <Input required placeholder="Enter product name" value={productName} onChange={e => setProductName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <select 
                    required
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                  >
                    <option value="" disabled>Select Category...</option>
                    {(categoriesData || []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Quantity Purchased *</Label>
                <Input required type="number" min="1" value={quantityPurchased} onChange={e => setQuantityPurchased(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost (EGP) *</Label>
                <Input required type="number" min="0" step="any" value={unitCost} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Total Cost</Label>
                <Input disabled value={`EGP ${(quantityPurchased * unitCost).toFixed(2)}`} className="bg-gray-50 font-semibold" />
              </div>
              <div className="space-y-2">
                <Label>Purchase Date *</Label>
                <Input required type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Supplier Name (Optional)</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier Ltd." />
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="PO #12345" />
              </div>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={purchaseMutation.isPending}>
              {purchaseMutation.isPending ? 'Saving...' : 'Record Purchase'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
