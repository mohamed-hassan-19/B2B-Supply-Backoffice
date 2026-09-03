import { useState, useRef, useEffect } from 'react';
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
import { exportToExcel } from '../lib/exportToExcel';

export default function ProductsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const [stockAdjustment, setStockAdjustment] = useState('');
  
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    category_id: '', 
    price: '', 
    original_price: '',
    image_url: '',
    stock_level: '',
    low_stock_threshold: ''
  });

  const [categoryData, setCategoryData] = useState({ name: '', description: '' });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState(''); // New filter state
  const [showLowStockOnly, setShowLowStockOnly] = useState(false); // Low stock filter

  useEffect(() => { setPage(1); }, [startDate, endDate, categoryFilter, showLowStockOnly]);

  const { data: categoriesData } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: async () => {
      const res = await api.get('/api/admin/categories');
      return res.data;
    }
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['adminProducts', startDate, endDate, page],
    queryFn: async () => {
      let url = `/api/admin/products?page=${page}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      const res = await api.get(url);
      return res.data;
    }
  });

  const products = productsData?.items || [];
  const total = productsData?.total || 0;

  const handleExport = async () => {
    let url = `/api/admin/products?export=true&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    const res = await api.get(url);
    const allData = res.data.items || res.data;

    const exportData = (allData || []).map((p: any) => ({
      'ID': p.id,
      'Name': p.name,
      'Category': p.Category?.name || '',
      'Price': Number(p.price),
      'Original Price': p.original_price ? Number(p.original_price) : null,
      'Stock Level': Number(p.stock_level),
      'Status': p.is_active ? 'Active' : 'Inactive'
    }));
    exportToExcel(exportData, 'products');
  };

  // Local filtering combining Search + Category ID + Low Stock filtering
  const filteredProducts = products.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.Category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter ? p.category_id?.toString() === categoryFilter : true;
    const matchesLowStock = showLowStockOnly ? p.stock_level <= p.low_stock_threshold : true;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const openEdit = (product?: any) => {
    if (product) {
      setActiveProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        category_id: product.category_id || '',
        price: product.price,
        original_price: product.original_price || '',
        image_url: (product.images && product.images.length > 0) ? product.images[0] : '',
        stock_level: product.stock_level?.toString() || '0',
        low_stock_threshold: product.low_stock_threshold?.toString() || '0'
      });
    } else {
      setActiveProduct(null);
      setFormData({ 
        name: '', description: '', category_id: '', price: '', original_price: '', 
        image_url: '', stock_level: '0', low_stock_threshold: '0' 
      });
    }
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsEditModalOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      const price = parseFloat(data.price);
      if (data.original_price && parseFloat(data.original_price) <= price) {
        throw new Error("Original price must be strictly greater than the current price.");
      }

      let finalImageUrl = formData.image_url;
      if (selectedFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', selectedFile);
        const uploadRes = await api.post('/api/admin/products/upload-image', formDataUpload);
        finalImageUrl = uploadRes.data.url;
      }

      const payload: any = {
        name: formData.name,
        description: formData.description,
        price,
        images: finalImageUrl ? [finalImageUrl] : []
      };
      
      if (formData.category_id) {
        payload.category_id = parseInt(formData.category_id.toString());
      }

      if (formData.stock_level !== '') {
        payload.stock_level = parseInt(formData.stock_level.toString());
      }
      
      if (formData.low_stock_threshold !== '') {
        payload.low_stock_threshold = parseInt(formData.low_stock_threshold.toString());
      }

      if (data.original_price) {
        payload.original_price = parseFloat(data.original_price);
      } else {
        payload.original_price = null;
      }

      if (activeProduct) {
        return api.put(`/api/admin/products/${activeProduct.id}`, payload);
      } else {
        return api.post('/api/admin/products', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || "An error occurred");
    }
  });

  const categoryMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/admin/categories', {
        name: categoryData.name,
        description: categoryData.description
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      setIsCategoryModalOpen(false);
      setCategoryData({ name: '', description: '' });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || "An error occurred");
    }
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, level }: { id: number, level: number }) => 
      api.patch(`/api/admin/products/${id}/stock`, { stock_level: level }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsStockModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminProducts'] })
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editMutation.mutate(formData);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    categoryMutation.mutate();
  };



  const canEdit = role === 'super_admin' || role === 'content';
  const canStock = role === 'super_admin' || role === 'warehouse' || role === 'content';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Products</h2>
        <div className="flex items-center gap-3">
          <Input 
            placeholder="Search within page..." 
            className="w-48 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="outline" onClick={handleExport}>
            Export to Excel
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
                + New Category
              </Button>
              <Button onClick={() => openEdit()}>
                + New Product
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-md border shadow-sm mb-4">
        <div className="space-y-1">
          <Label>Category Filter (Local)</Label>
          <select 
            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categoriesData?.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" className="h-9" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input type="date" className="h-9" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1 pb-1">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="lowStockFilter" 
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
            />
            <Label htmlFor="lowStockFilter" className="text-sm cursor-pointer">Highlight Low Stock Only</Label>
          </div>
        </div>
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
              <TableRow key={p.id} className={p.stock_level <= p.low_stock_threshold ? "bg-red-50" : ""}>
                <TableCell>{p.id}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.Category?.name || 'N/A'}</TableCell>
                <TableCell>
                  £{Number(p.price).toFixed(2)}
                  {p.original_price && (
                    <span className="text-muted-foreground line-through ml-2 text-xs">
                      £{Number(p.original_price).toFixed(2)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={p.stock_level <= p.low_stock_threshold ? "destructive" : "secondary"}>
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
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {filteredProducts.length} of {total}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={products.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
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
              <select 
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.category_id} 
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
              >
                <option value="">Select a category</option>
                {categoriesData?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Stock Level</Label>
                <Input type="number" min="0" value={formData.stock_level} onChange={e => setFormData({...formData, stock_level: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert Threshold</Label>
                <Input type="number" min="0" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Product Image</Label>
              {formData.image_url && !selectedFile && (
                <div className="mb-2">
                  <img src={formData.image_url.startsWith('http') || formData.image_url.startsWith('/uploads') ? (formData.image_url.startsWith('http') ? formData.image_url : `${API_BASE_URL}${formData.image_url}`) : formData.image_url} alt="Current" className="h-16 w-16 object-cover rounded" />
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

      {/* New Category Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input required value={categoryData.name} onChange={e => setCategoryData({...categoryData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input value={categoryData.description} onChange={e => setCategoryData({...categoryData, description: e.target.value})} />
            </div>
            <Button type="submit" className="w-full" disabled={categoryMutation.isPending}>
              {categoryMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
