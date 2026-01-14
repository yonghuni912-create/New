
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

interface InventoryGroup {
  id: string;
  name: string;
}

interface MenuManual {
  id: string;
  name: string;
  koreanName?: string;
}

interface PosLink {
  id: string;
  posMenuName: string;
  menuManual: MenuManual;
}

export default function PosLinkSettingsPage() {
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [manuals, setManuals] = useState<MenuManual[]>([]);
  const [links, setLinks] = useState<PosLink[]>([]);
  
  // 입력 폼 상태
  const [newPosName, setNewPosName] = useState('');
  const [selectedManualId, setSelectedManualId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 초기 로딩 (그룹 & 매뉴얼 목록)
  useEffect(() => {
    fetchGroups();
    fetchManuals();
  }, []);

  // 2. 그룹 선택 시 링크 목록 조회
  useEffect(() => {
    if (selectedGroupId) {
      fetchLinks(selectedGroupId);
    } else {
      setLinks([]);
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/inventory/groups');
      const data = await res.json();
      setGroups(data);
      if (data.length > 0) setSelectedGroupId(data[0].id);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchManuals = async () => {
    try {
      const res = await fetch('/api/manuals/simple-list');
      const data = await res.json();
      setManuals(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLinks = async (groupId: string) => {
    try {
      const res = await fetch(`/api/inventory/pos-links?groupId=${groupId}`);
      const data = await res.json();
      setLinks(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !newPosName || !selectedManualId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/pos-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          posMenuName: newPosName,
          menuManualId: selectedManualId,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('Link saved successfully');
      setNewPosName(''); // 입력창 초기화
      fetchLinks(selectedGroupId); // 목록 갱신
    } catch (error) {
      toast.error('Failed to save link');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;
    try {
      await fetch(`/api/inventory/pos-links?id=${id}`, { method: 'DELETE' });
      fetchLinks(selectedGroupId);
      toast.success('Link deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">POS Menu Linking</h1>
        <p className="text-gray-500">Connect your POS menu items to system recipes for automatic tracking.</p>
      </div>

      {/* 그룹 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Store Group</label>
        <div className="flex space-x-2">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                selectedGroupId === group.id
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-medium mb-4">Add New Link</h2>
        <form onSubmit={handleAddLink} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">POS Menu Name</label>
            <Input 
              placeholder="e.g. Half & Half Chicken" 
              value={newPosName}
              onChange={(e) => setNewPosName(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">System Recipe</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedManualId}
              onChange={(e) => setSelectedManualId(e.target.value)}
              required
            >
              <option value="">Select a recipe...</option>
              {manuals.map((manual) => (
                <option key={manual.id} value={manual.id}>
                  {manual.name} {manual.koreanName ? `(${manual.koreanName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Link'}
          </Button>
        </form>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POS Menu Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Recipe</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {links.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                  No links found. Add your first POS menu link above.
                </td>
              </tr>
            ) : (
              links.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {link.posMenuName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {link.menuManual.name}
                    <span className="text-gray-400 text-xs ml-2">{link.menuManual.koreanName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDelete(link.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
