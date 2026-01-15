'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { X, MessageCircle, CheckSquare, Send, Trash2, Plus, Check, Square, User } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface ChecklistItem {
  id: string;
  content: string;
  isCompleted: boolean;
  order: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TaskEditModalProps {
  task: any;
  isOpen?: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: any) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

export default function TaskEditModal({ task, isOpen = true, onClose, onSave, onDelete }: TaskEditModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'checklist'>('details');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState(task?.status || 'NOT_STARTED');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || '');
  const [policy, setPolicy] = useState<'THIS_ONLY' | 'CASCADE_LATER' | 'CASCADE_ALL'>('THIS_ONLY');
  const [loading, setLoading] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  
  // Users for assignee dropdown
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setAssigneeId(task.assigneeId || '');
      setStartDate(
        task.startDate || task.start_date
          ? format(new Date(task.startDate || task.start_date), 'yyyy-MM-dd')
          : ''
      );
      setDueDate(
        task.dueDate || task.due_date
          ? format(new Date(task.dueDate || task.due_date), 'yyyy-MM-dd')
          : ''
      );
      setStatus(task.status || 'NOT_STARTED');
      setPriority(task.priority || 'MEDIUM');
      fetchComments();
      fetchChecklist();
    }
  }, [task]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const fetchComments = async () => {
    if (!task?.id) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      if (res.ok) {
        setComments(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    }
    setLoadingComments(false);
  };

  const fetchChecklist = async () => {
    if (!task?.id) return;
    setLoadingChecklist(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist`);
      if (res.ok) {
        setChecklist(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch checklist:', e);
    }
    setLoadingChecklist(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task?.id) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        const comment = await res.json();
        setComments([comment, ...comments]);
        setNewComment('');
      }
    } catch (e) {
      console.error('Failed to add comment:', e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments?commentId=${commentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim() || !task?.id) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newChecklistItem })
      });
      if (res.ok) {
        const item = await res.json();
        setChecklist([...checklist, item]);
        setNewChecklistItem('');
      }
    } catch (e) {
      console.error('Failed to add checklist item:', e);
    }
  };

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, isCompleted: !item.isCompleted })
      });
      if (res.ok) {
        setChecklist(checklist.map(i => 
          i.id === item.id ? { ...i, isCompleted: !i.isCompleted } : i
        ));
      }
    } catch (e) {
      console.error('Failed to toggle checklist item:', e);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklist?itemId=${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setChecklist(checklist.filter(i => i.id !== itemId));
      }
    } catch (e) {
      console.error('Failed to delete checklist item:', e);
    }
  };

  if (!isOpen || !task) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(task.id, {
        title,
        description,
        startDate,
        dueDate,
        status,
        priority,
        assigneeId: assigneeId || null,
        reschedulePolicy: policy
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const completedCount = checklist.filter(i => i.isCompleted).length;
  const checklistProgress = checklist.length > 0 
    ? Math.round((completedCount / checklist.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold truncate pr-4">{task.title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'details' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'comments' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('comments')}
          >
            <MessageCircle className="w-4 h-4" />
            Comments {comments.length > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{comments.length}</span>}
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'checklist' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('checklist')}
          >
            <CheckSquare className="w-4 h-4" />
            Checklist {checklist.length > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{completedCount}/{checklist.length}</span>}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="block mb-1">Task Name</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description" className="block mb-1">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Add a description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status" className="block mb-1">Status</Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="priority" className="block mb-1">Priority</Label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="assignee" className="block mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Assignee (담당자)
                </Label>
                <select
                  id="assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">미지정</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
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
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate" className="block mb-1">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <Label className="block mb-2 text-gray-700">Reschedule Policy</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="policy"
                      value="THIS_ONLY"
                      checked={policy === 'THIS_ONLY'}
                      onChange={() => setPolicy('THIS_ONLY')}
                      className="text-orange-500"
                    />
                    <span className="text-sm">This task only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="policy"
                      value="CASCADE_LATER"
                      checked={policy === 'CASCADE_LATER'}
                      onChange={() => setPolicy('CASCADE_LATER')}
                      className="text-orange-500"
                    />
                    <span className="text-sm">Cascade to later tasks</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="policy"
                      value="CASCADE_ALL"
                      checked={policy === 'CASCADE_ALL'}
                      onChange={() => setPolicy('CASCADE_ALL')}
                      className="text-orange-500"
                    />
                    <span className="text-sm">Cascade to all linked tasks</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* New comment input */}
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {/* Comments list */}
              {loadingComments ? (
                <div className="text-center py-8 text-gray-500">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{comment.user.name}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-4">
              {/* Progress bar */}
              {checklist.length > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span>{checklistProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* New checklist item input */}
              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add a checklist item..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                  className="flex-1"
                />
                <Button onClick={handleAddChecklistItem} disabled={!newChecklistItem.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Checklist items */}
              {loadingChecklist ? (
                <div className="text-center py-8 text-gray-500">Loading checklist...</div>
              ) : checklist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No checklist items. Add one above!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 ${item.isCompleted ? 'bg-green-50' : ''}`}
                    >
                      <button
                        onClick={() => handleToggleChecklistItem(item)}
                        className={`flex-shrink-0 ${item.isCompleted ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {item.isCompleted ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-gray-400' : ''}`}>
                        {item.content}
                      </span>
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
