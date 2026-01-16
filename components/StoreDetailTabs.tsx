'use client';

import { useState, useEffect } from 'react';
import StoreForm from './StoreForm';
import CalendarView from './CalendarView';
import GanttChart from './GanttChart';
import OpeningReadiness from './OpeningReadiness';
import TaskEditModal from './TaskEditModal';
import TaskCreateModal from './TaskCreateModal';
import { Calendar, BarChart3, Target, CheckSquare, FileText, Flag, Download, Eye } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  phase?: string;
  priority?: string;
}

interface Props {
  store: any;
  countries: any[];
  userId: string;
  userRole: string;
}

export default function StoreDetailTabs({
  store,
  countries,
  userId,
  userRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'readiness' | 'edit'>('overview');
  const [viewMode, setViewMode] = useState<'calendar' | 'gantt'>('calendar');
  const [tasks, setTasks] = useState<Task[]>(store.tasks || []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'tasks' | 'files' | 'gallery'>('tasks');
  const [currentTime, setCurrentTime] = useState(new Date());

  const canEdit = ['ADMIN', 'PM', 'CONTRIBUTOR'].includes(userRole);
  
  // Filter images for gallery
  const galleryImages = store.files?.filter((f: any) => 
    f.fileType?.startsWith('image/') || f.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  ) || [];

  // Update timezone clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for timezone
  const getTimezoneTime = () => {
    try {
      return currentTime.toLocaleTimeString('en-US', {
        timeZone: store.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return currentTime.toLocaleTimeString('en-US', { hour12: false });
    }
  };

  // Calendar event handlers
  const handleEventDrop = async ({ event, start, end }: { event: any; start: Date; end: Date }) => {
    const taskId = event.id || event.resource?.id;
    if (!taskId) return;
    
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(),
          dueDate: end.toISOString(),
          reschedulePolicy: 'THIS_ONLY'
        })
      });
      
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, startDate: start.toISOString(), dueDate: end.toISOString() }
          : t
      ));
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleEventClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditModalOpen(true);
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch(`/api/stores/${store.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('readiness')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${
              activeTab === 'readiness'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Target className="w-4 h-4" />
            Readiness
          </button>
          {canEdit && (
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'edit'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Edit
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Owner & Store Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  Owner Information
                  <span className="ml-2 text-sm font-normal text-gray-500">Name {store.ownerName || '-'}</span>
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Email</div>
                      <div className="text-sm font-medium">{store.ownerEmail || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Phone</div>
                      <div className="text-sm font-medium">{store.ownerPhone || '-'}</div>
                    </div>
                  </div>
                  {store.ownerEmail && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Email</div>
                      <div className="text-sm font-medium">{store.ownerEmail}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500 mb-1">Address</div>
                      <div className="text-sm font-medium">{store.address || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">City</div>
                      <div className="text-sm font-medium">{store.city || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Country</div>
                      <div className="text-sm font-medium">{store.country}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Timezone</div>
                      <div className="text-sm font-medium">{store.timezone}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Store Phone</div>
                      <div className="text-sm font-medium">{store.storePhone || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Stats Buttons & Interactive Panel */}
            <div className="space-y-6">
              {/* 3 Buttons Row */}
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setActivePanel('tasks')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    activePanel === 'tasks'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <CheckSquare className={`w-6 h-6 ${activePanel === 'tasks' ? 'text-orange-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{tasks.length}</div>
                  <div className={`text-xs ${activePanel === 'tasks' ? 'text-orange-600' : 'text-gray-500'}`}>Tasks</div>
                </button>

                <button
                  onClick={() => setActivePanel('files')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    activePanel === 'files'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <FileText className={`w-6 h-6 ${activePanel === 'files' ? 'text-blue-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{store.files?.length || 0}</div>
                  <div className={`text-xs ${activePanel === 'files' ? 'text-blue-600' : 'text-gray-500'}`}>Files</div>
                </button>

                <button
                  onClick={() => setActivePanel('gallery')}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    activePanel === 'gallery'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-green-200'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <Flag className={`w-6 h-6 ${activePanel === 'gallery' ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{galleryImages.length}</div>
                  <div className={`text-xs ${activePanel === 'gallery' ? 'text-green-600' : 'text-gray-500'}`}>Gallery</div>
                </button>
              </div>

              {/* Interactive Panel */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-gray-900">
                    {activePanel === 'tasks' && <CheckSquare className="w-5 h-5 text-orange-500" />}
                    {activePanel === 'files' && <FileText className="w-5 h-5 text-blue-500" />}
                    {activePanel === 'gallery' && <Flag className="w-5 h-5 text-green-500" />}
                    <h3 className="text-lg font-bold">
                      {activePanel === 'tasks' && `Recent Tasks (${tasks.length})`}
                      {activePanel === 'files' && `Files (${store.files?.length || 0})`}
                      {activePanel === 'gallery' && `Gallery (${galleryImages.length})`}
                    </h3>
                  </div>
                  {activePanel === 'tasks' && (
                    <button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 px-3 py-1.5 rounded transition-colors font-medium"
                    >
                      + Add Task
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Tasks List */}
                  {activePanel === 'tasks' && (
                    tasks.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <p>No tasks found.</p>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <div 
                          key={task.id}
                          onClick={() => handleEventClick(task)}
                          className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 cursor-pointer transition-colors border border-gray-100"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900 mb-1">{task.title}</div>
                              {task.dueDate && (
                                <div className="text-xs text-gray-500">
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded border ${
                              task.status === 'COMPLETED' 
                                ? 'bg-green-50 border-green-100 text-green-700' 
                                : 'bg-white border-gray-200 text-gray-600'
                            }`}>
                              {task.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  )}

                  {/* Files List */}
                  {activePanel === 'files' && (
                    store.files?.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <p>No files uploaded.</p>
                      </div>
                    ) : (
                      store.files.map((file: any) => (
                        <div 
                          key={file.id}
                          className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors border border-gray-100 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">{file.fileName}</div>
                              <div className="text-xs text-gray-500">
                                {(file.fileSize / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <a 
                            href={file.filePath}
                            download
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      ))
                    )
                  )}

                  {/* Gallery Grid */}
                  {activePanel === 'gallery' && (
                    galleryImages.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <p>No images found in files.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {galleryImages.map((file: any) => (
                          <div 
                            key={file.id}
                            className="aspect-square bg-black/20 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                            onClick={() => window.open(file.filePath, '_blank')}
                          >
                            <img 
                              src={file.filePath} 
                              alt={file.fileName}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Area - Calendar & Gantt */}
          <div className="bg-white rounded-lg shadow p-4 mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Task Schedule</h3>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('gantt')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'gantt'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Gantt
                </button>
              </div>
            </div>
            
            {viewMode === 'calendar' ? (
              <CalendarView
                tasks={tasks}
                onEventDrop={handleEventDrop}
                onEventClick={handleEventClick}
              />
            ) : (
              <GanttChart
                tasks={tasks as any}
                onTaskClick={(task) => handleEventClick(task as any)}
              />
            )}
          </div>
        </div>
      ) : activeTab === 'readiness' ? (
        <div className="space-y-6">
          <OpeningReadiness
            tasks={tasks as any}
            targetOpenDate={store.targetOpenDate}
            storeName={store.storeName || store.storeCode || 'Store'}
          />
        </div>
      ) : (
        <div className="max-w-4xl">
          <StoreForm countries={countries} userId={userId} store={store} />
        </div>
      )}

      {/* Task Edit Modal */}
      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleTaskUpdate}
        />
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        storeId={store.id}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleTaskCreate}
      />
    </div>
  );
}
