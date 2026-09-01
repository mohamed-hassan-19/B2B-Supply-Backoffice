import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { exportToExcel } from '../lib/exportToExcel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

export default function ProductsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category: '', 
    price: '', 
    original_price: '',
    image_url: '' 
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['adminProducts'],
    queryFn: async () => {
      const res = await api.get('/api/admin/products');
      return res.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminProducts'] })
  });
  
  const stockMutation = useMutation({
    mutationFn: ({ id, level }: { id: number, level: number }) => 
      api.patch(`/api/admin/products/${id}/stock`, { stock_level: level }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsStockModalOpen(false);
    }
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => activeProduct 
      ? api.put(`/api/admin/products/${activeProduct.id}`, data)
      : api.post(`/api/admin/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsEditModalOpen(false);
    }
  });

  const openEdit = (p?: any) => {
    setActiveProduct(p || null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    setFormData({ 
      name: p?.name || '', 
      description: p?.description || '', 
      category: p?.category || '', 
      price: p?.price?.toString() || '', 
      original_price: p?.original_price?.toString() || '',
      image_url: p?.images?.[0] || '' 
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalImageUrl = formData.image_url;

    if (selectedFile) {
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      try {
        const res = await api.post('/api/admin/products/upload-image', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalImageUrl = res.data.url;
      } catch (err) {
        alert("Failed to upload image");
        return;
      }
    }

    const price = parseFloat(formData.price);
    const original_price = formData.original_price ? parseFloat(formData.original_price) : undefined;
    
    // Quick validation for original price
    if (original_price && original_price <= price) {
      alert("Original price must be strictly greater than the actual price!");
      return;
    }

    const payload: any = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price,
      images: finalImageUrl ? [finalImageUrl] : []
    };

    if (original_price) {
      payload.original_price = original_price;
    }

    editMutation.mutate(payload);
  };

  const handleExport = () => {
    const exportData = filteredProducts.map((p: any) => ({
      'ID': p.id,
      'Name': p.name,
      'Category': p.category,
      'Price': Number(p.price),
      'Original Price': p.original_price ? Number(p.original_price) : null,
      'Stock Level': Number(p.stock_level),
      'Status': p.is_active ? 'Active' : 'Inactive'
    }));
    exportToExcel(exportData, 'products');
  };

  const filteredProducts = products?.filter((p: any) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const canEdit = role === 'super_admin' || role === 'content';
  const canStock = role === 'super_admin' || role === 'warehouse' || role === 'content';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Input 
            placeholder="Search products..." 
            className="max-w-sm bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="outline" onClick={handleExport}>
            Export to Excel
          </Button>
        </div>
        {canEdit && (
          <Button onClick={() => openEdit()}>
            + New Product
          </Button>
        )}
      </div>

      <div className="bg-white rounded-md border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredProducts.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.id}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell>
                  £{Number(p.price).toFixed(2)}
                  {p.original_price && (
                    <span className="text-muted-foreground line-through ml-2 text-xs">
                      £{Number(p.original_price).toFixed(2)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={p.stock_level > 0 ? "secondary" : "destructive"}>
                    {p.stock_level}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "outline" : "destructive"}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {canStock && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setActiveProduct(p);
                      setStockAdjustment(p.stock_level.toString());
                      setIsStockModalOpen(true);
                    }}>
                      Stock
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                  )}
                  {canEdit && p.is_active && (
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(p.id)}>
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Stock Adjustment Modal */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {activeProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Stock Level</Label>
              <Input 
                type="number" 
                value={stockAdjustment} 
                onChange={(e) => setStockAdjustment(e.target.value)} 
              />
            </div>
            <Button onClick={() => stockMutation.mutate({ id: activeProduct.id, level: parseInt(stockAdjustment) })}>
              Save Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeProduct ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Original Price (Optional)</Label>
                <Input type="number" step="0.01" value={formData.original_price} onChange={e => setFormData({...formData, original_price: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Product Image</Label>
              {formData.image_url && !selectedFile && (
                <div className="mb-2">
                  <img src={formData.image_url.startsWith('http') || formData.image_url.startsWith('/uploads') ? (formData.image_url.startsWith('http') ? formData.image_url : `http://localhost:3000${formData.image_url}`) : formData.image_url} alt="Current" className="h-16 w-16 object-cover rounded" />
                </div>
              )}
              <Input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }} 
              />
            </div>
            <Button type="submit" className="w-full" disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving...' : 'Save Product'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
