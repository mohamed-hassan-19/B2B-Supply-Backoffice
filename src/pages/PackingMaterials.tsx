import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

export default function PackingMaterialsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    stock_quantity: 0,
    low_stock_threshold: 20
  });

  const { data: materials, isLoading } = useQuery({
    queryKey: ['packing-materials'],
    queryFn: async () => {
      const res = await api.get('/api/admin/packing-materials');
      return res.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMaterial) {
        return api.patch(`/api/admin/packing-materials/${editingMaterial.id}`, data);
      }
      return api.post('/api/admin/packing-materials', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-materials'] });
      alert(`Packing material ${editingMaterial ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'An error occurred');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', category: 'General', stock_quantity: 0, low_stock_threshold: 20 });
    setEditingMaterial(null);
  };

  const handleOpenModal = (material?: any) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({
        name: material.name,
        category: material.category,
        stock_quantity: material.stock_quantity,
        low_stock_threshold: material.low_stock_threshold || 0
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Packing Materials</h2>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials?.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">#{m.id}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.category}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {m.stock_quantity}
                    {m.low_stock_threshold !== null && m.stock_quantity <= m.low_stock_threshold && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">Low Stock</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{m.low_stock_threshold}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(m)}>
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!materials || materials.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                  No packing materials found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? 'Edit Packing Material' : 'Add Packing Material'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                required 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g., Medium Cardboard Box"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input 
                required 
                value={formData.category} 
                onChange={e => setFormData({ ...formData, category: e.target.value })} 
                placeholder="e.g., Boxes"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input 
                  type="number" 
                  required 
                  min="0"
                  value={formData.stock_quantity} 
                  onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <Input 
                  type="number" 
                  min="0"
                  value={formData.low_stock_threshold} 
                  onChange={e => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
