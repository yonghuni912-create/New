'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FileText, Plus, Save, Eye, Trash2, Edit, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface ManualIngredient {
  no: number;
  name: string;
  koreanName: string;
  weight: string;
  unit: string;
  ingredientId?: string;
  price?: number | null;
}

interface SavedManual {
  id: string;
  name: string;
  nameKo?: string;
  yield?: number;
  isDeleted?: boolean;
  ingredients?: any[];
}

export default function TemplatesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'editor' | 'manuals'>('manuals');
  const [savedManuals, setSavedManuals] = useState<SavedManual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuName, setMenuName] = useState('');
  const [menuNameKo, setMenuNameKo] = useState('');
  const [menuYield, setMenuYield] = useState<number>(1);
  const [ingredients, setIngredients] = useState<ManualIngredient[]>([]);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchManuals();
  }, []);

  const fetchManuals = async () => {
    try {
      const res = await fetch('/api/manuals');
      if (res.ok) {
        const data = await res.json();
        setSavedManuals(Array.isArray(data) ? data : data.manuals || []);
      }
    } catch (error) {
      console.error('Failed to fetch manuals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveManual = async () => {
    if (!menuName.trim()) {
      alert('Menu name is required');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingManualId ? '/api/manuals/' + editingManualId : '/api/manuals';
      const method = editingManualId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: menuName,
          koreanName: menuNameKo,
          yield: menuYield,
          ingredients: ingredients.map((ing, idx) => ({
            name: ing.name || ing.koreanName,
            koreanName: ing.koreanName,
            quantity: parseFloat(ing.weight) || 0,
            unit: ing.unit,
            ingredientId: ing.ingredientId,
            sortOrder: idx
          }))
        })
      });

      if (res.ok) {
        alert(editingManualId ? 'Manual updated!' : 'Manual saved!');
        clearForm();
        fetchManuals();
        setActiveTab('manuals');
      } else {
        alert('Failed to save manual');
      }
    } catch (error) {
      console.error('Error saving manual:', error);
      alert('Failed to save manual');
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    setMenuName('');
    setMenuNameKo('');
    setMenuYield(1);
    setIngredients([]);
    setEditingManualId(null);
  };

  const editManual = (manual: SavedManual) => {
    setEditingManualId(manual.id);
    setMenuName(manual.name);
    setMenuNameKo(manual.nameKo || '');
    setMenuYield(manual.yield || 1);
    setIngredients(
      (manual.ingredients || []).map((ing: any, idx: number) => ({
        no: idx + 1,
        name: ing.name || '',
        koreanName: ing.nameKo || ing.koreanName || '',
        weight: String(ing.quantity || ''),
        unit: ing.unit || 'g',
        ingredientId: ing.ingredientId
      }))
    );
    setActiveTab('editor');
  };

  const deleteManual = async (id: string) => {
    if (!confirm('Are you sure you want to delete this manual?')) return;

    try {
      const res = await fetch('/api/manuals/' + id, { method: 'DELETE' });
      if (res.ok) {
        fetchManuals();
      }
    } catch (error) {
      console.error('Error deleting manual:', error);
    }
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      { no: ingredients.length + 1, name: '', koreanName: '', weight: '', unit: 'g' }
    ]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof ManualIngredient, value: string) => {
    const updated = [...ingredients];
    (updated[index] as any)[field] = value;
    setIngredients(updated);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Manual Templates</h1>
          <p className="text-slate-500 mt-1">
            {editingManualId ? 'Editing manual...' : 'Create and manage kitchen manuals'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'editor' && (
            <>
              {editingManualId && (
                <Button variant="outline" onClick={clearForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button onClick={saveManual} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : editingManualId ? 'Update' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('editor')}
            className={'px-4 py-2 font-medium border-b-2 ' + (activeTab === 'editor' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500')}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Manual Editor
          </button>
          <button
            onClick={() => setActiveTab('manuals')}
            className={'px-4 py-2 font-medium border-b-2 ' + (activeTab === 'manuals' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500')}
          >
            Saved Manuals ({savedManuals.filter(m => !m.isDeleted).length})
          </button>
        </nav>
      </div>

      {activeTab === 'editor' && (
        <Card>
          <CardHeader>
            <CardTitle>{editingManualId ? 'Edit Manual' : 'New Manual'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Menu Name (English)</Label>
                <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Menu name" />
              </div>
              <div>
                <Label>Menu Name (Korean)</Label>
                <Input value={menuNameKo} onChange={(e) => setMenuNameKo(e.target.value)} placeholder="메뉴 이름" />
              </div>
              <div>
                <Label>Yield</Label>
                <Input type="number" value={menuYield} onChange={(e) => setMenuYield(Number(e.target.value))} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Ingredients</Label>
                <Button size="sm" onClick={addIngredient}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              <table className="w-full border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Korean</th>
                    <th className="p-2 text-left">Weight</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2">
                        <Input value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <Input value={ing.koreanName} onChange={(e) => updateIngredient(idx, 'koreanName', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <Input value={ing.weight} onChange={(e) => updateIngredient(idx, 'weight', e.target.value)} />
                      </td>
                      <td className="p-2">
                        <select
                          value={ing.unit}
                          onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                          className="border rounded p-1"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="L">L</option>
                          <option value="ea">ea</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="ghost" onClick={() => removeIngredient(idx)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'manuals' && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Manuals</CardTitle>
          </CardHeader>
          <CardContent>
            {savedManuals.filter(m => !m.isDeleted).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No manuals saved yet. Create one in the editor tab.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Korean Name</th>
                    <th className="p-3 text-left">Yield</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedManuals.filter(m => !m.isDeleted).map((manual) => (
                    <tr key={manual.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{manual.name}</td>
                      <td className="p-3">{manual.nameKo || '-'}</td>
                      <td className="p-3">{manual.yield || '-'}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => editManual(manual)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteManual(manual.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}