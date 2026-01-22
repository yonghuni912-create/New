export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          {/* Spinner */}
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        <p className="text-gray-600 font-medium">Loading...</p>
        <p className="text-sm text-gray-400 mt-1">잠시만 기다려주세요</p>
      </div>
    </div>
  );
}
