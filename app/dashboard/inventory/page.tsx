'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface InventoryGroup {
  id: string;
  name: string;
  _count: { periods: number };
}

interface InventoryPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string;
  _count: { items: number };
}

export default function InventoryDashboardPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [periods, setPeriods] = useState<InventoryPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchPeriods(selectedGroupId);
    } else {
      setPeriods([]);
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/inventory/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        if (data.length > 0) {
          setSelectedGroupId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPeriods = async (groupId: string) => {
    try {
      const res = await fetch('/api/inventory/periods?groupId=' + groupId);
      if (res.ok) {
        const data = await res.json();
        setPeriods(data);
      }
    } catch (error) {
      console.error('Failed to fetch periods:', error);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <Button onClick={() => router.push('/dashboard/inventory/new')}>
          New Inventory Period
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-gray-500">No groups found</p>
            ) : (
              <ul className="space-y-2">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className={'p-2 rounded cursor-pointer ' + (selectedGroupId === group.id ? 'bg-orange-100 border-orange-500' : 'hover:bg-gray-100')}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    {group.name} ({group._count?.periods || 0} periods)
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Inventory Periods</CardTitle>
          </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <p className="text-gray-500">No periods found for this group</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Period</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id} className="border-b hover:bg-gray-50 cursor-pointer">
                      <td className="p-2">{period.startDate} - {period.endDate}</td>
                      <td className="p-2">{period.status}</td>
                      <td className="p-2">{period._count?.items || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}