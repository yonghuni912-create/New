'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string | null;
  user: { id: string; name: string };
  replies?: Comment[];
}

interface TaskFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
}

interface TaskCommentsModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  currentUserId?: string;
}

export default function TaskCommentsModal({
  taskId,
  taskTitle,
  onClose,
  currentUserId,
}: TaskCommentsModalProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'files'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      const data = await res.json();
      const commentsArray = Array.isArray(data) ? data : (data.comments || []);
      
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];
      
      commentsArray.forEach((c: Comment) => {
        commentMap.set(c.id, { ...c, replies: [] });
      });
      
      commentsArray.forEach((c: Comment) => {
        const comment = commentMap.get(c.id)!;
        if (c.parentId && commentMap.has(c.parentId)) {
          commentMap.get(c.parentId)!.replies!.push(comment);
        } else {
          rootComments.push(comment);
        }
      });
      
      rootComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      rootComments.forEach(c => c.replies?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      
      setComments(rootComments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/files`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchComments(), fetchFiles()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);

    try {
      const body: { content: string; parentId?: string } = { content: newComment };
      if (replyTo) body.parentId = replyTo.id;

      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        setNewComment('');
        setReplyTo(null);
        await fetchComments();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async () => {
    if (!editingComment || !editingComment.content.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments?commentId=${editingComment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingComment.content }),
      });
      
      if (res.ok) {
        setEditingComment(null);
        await fetchComments();
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기가 10MB를 초과합니다.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/tasks/${taskId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchFiles();
      } else {
        const err = await res.json();
        alert(err.error || '파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('파일을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/files?fileId=${fileId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchFiles();
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 border-l-2 border-gray-200 pl-3' : ''}`}>
      <div className="bg-gray-50 rounded-lg p-3 mb-2">
        {editingComment?.id === comment.id ? (
          <div className="space-y-2">
            <textarea
              value={editingComment.content}
              onChange={(e) => setEditingComment({ ...editingComment, content: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleEditComment}
                disabled={submitting}
                className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
              >
                저장
              </button>
              <button
                onClick={() => setEditingComment(null)}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">{comment.user.name}</span>
                <span className="text-xs text-gray-500">
                  {format(new Date(comment.createdAt), 'M/d HH:mm')}
                </span>
                {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                  <span className="text-xs text-gray-400">(수정됨)</span>
                )}
              </div>
              {currentUserId === comment.user.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingComment({ id: comment.id, content: comment.content })}
                    className="text-xs text-gray-500 hover:text-blue-600 px-1"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-xs text-gray-500 hover:text-red-600 px-1"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            {!isReply && (
              <button
                onClick={() => setReplyTo({ id: comment.id, userName: comment.user.name })}
                className="mt-2 text-xs text-gray-500 hover:text-orange-600"
              >
                답글 달기
              </button>
            )}
          </>
        )}
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">댓글 & 파일</h3>
          <p className="text-sm text-gray-500">{taskTitle}</p>
          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('comments')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeTab === 'comments'
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              댓글 ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeTab === 'files'
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              파일 ({files.length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">로딩중...</div>
          ) : activeTab === 'comments' ? (
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">아직 댓글이 없습니다.</div>
              ) : (
                comments.map((comment) => renderComment(comment))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {files.length === 0 ? (
                <div className="text-center text-gray-500 py-8">첨부된 파일이 없습니다.</div>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600">
                        {file.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={file.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline truncate block"
                        >
                          {file.originalName}
                        </a>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)} · {file.uploadedBy?.name || 'Unknown'} · {format(new Date(file.createdAt), 'M/d HH:mm')}
                        </p>
                      </div>
                    </div>
                    {(currentUserId === file.uploadedBy?.id) && (
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t">
          {activeTab === 'comments' ? (
            <>
              {replyTo && (
                <div className="flex items-center justify-between bg-orange-50 px-3 py-2 rounded-lg mb-2">
                  <span className="text-sm text-orange-700">@{replyTo.userName}에게 답글 작성 중</span>
                  <button onClick={() => setReplyTo(null)} className="text-xs text-gray-500 hover:text-gray-700">취소</button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 resize-none"
                  rows={2}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300"
                >
                  {submitting ? '...' : '등록'}
                </button>
              </div>
            </>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="*/*"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-500 hover:text-orange-600 disabled:bg-gray-100"
              >
                {uploading ? '업로드 중...' : '파일 선택하기 (최대 10MB)'}
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
