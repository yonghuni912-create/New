'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import TaskCommentsModal from './TaskCommentsModal';

interface RecentComment {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string; email: string } | null;
  task: {
    id: string;
    title: string;
    store: { storeName: string; id: string } | null;
  } | null;
}

interface RecentCommentsSectionProps {
  comments: RecentComment[];
  currentUserId?: string;
}

export default function RecentCommentsSection({ comments, currentUserId }: RecentCommentsSectionProps) {
  const [selectedTask, setSelectedTask] = useState<{ id: string; title: string } | null>(null);

  const handleCommentClick = (comment: RecentComment) => {
    if (comment.task) {
      setSelectedTask({
        id: comment.task.id,
        title: comment.task.title,
      });
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            💬 최근 댓글
          </h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
          {comments.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              아직 댓글이 없습니다. 태스크에서 팀원들과 소통해보세요!
            </div>
          ) : (
            comments.map((comment) => (
              <button 
                key={comment.id} 
                onClick={() => handleCommentClick(comment)}
                className="block w-full text-left px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm flex-shrink-0">
                    {comment.user?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.user?.name || '익명'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {comment.task?.title} • {comment.task?.store?.storeName}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Comments Modal */}
      {selectedTask && (
        <TaskCommentsModal
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          currentUserId={currentUserId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
