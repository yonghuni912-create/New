'use client';

import dynamic from 'next/dynamic';

const AuditLogViewer = dynamic(() => import('@/components/AuditLogViewer'), { 
  ssr: false,
  loading: () => (
    <div className="text-center py-12 text-gray-500">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4" />
      Loading audit logs...
    </div>
  )
});

export default function AdminAuditSection() {
  return (
    <section id="audit" className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>📋</span> Audit Logs
      </h2>
      <div className="bg-white shadow rounded-lg p-6">
        <AuditLogViewer limit={100} />
      </div>
    </section>
  );
}
