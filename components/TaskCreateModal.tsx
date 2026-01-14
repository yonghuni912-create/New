'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { X } from 'lucide-react';

interface TaskCreateModalProps {
  storeId: string;
  phases?: string[];
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSave?: (task: any) => void;
}

const DEFAULT_PHASES = ['Pre-Launch', 'Site Selection', 'Legal & Contracts', 'Construction', 'Equipment & Setup', 'Grand Opening', 'Ad-hoc'];

export default function TaskCreateModal({ storeId, phases, isOpen = true, onClose, onSuccess, onSave }: TaskCreateModalProps) {
  const availablePhases = phases && phases.length > 0 ? phases : DEFAULT_PHASES;
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState(availablePhases[0]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/stores/${storeId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          phase,
          startDate,
          dueDate
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        if (onSave) {
          onSave(newTask);
        }
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        // Reset form
        setTitle('');
        setPhase(availablePhases[0]);
        setStartDate('');
        setDueDate('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create task');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create New Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="block mb-1">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <Label htmlFor="phase" className="block mb-1">Phase</Label>
            <select
              id="phase"
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              {availablePhases.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="block mb-1">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dueDate" className="block mb-1">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
