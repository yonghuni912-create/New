import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ComingSoonPage({
  title,
  description,
  backLink,
}: {
  title: string;
  description: string;
  backLink: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={backLink} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{description}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Coming Soon
        </h2>
        <p className="text-gray-600 mb-6">
          This feature is under development and will be available soon.
        </p>
        <Link
          href={backLink}
          className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          Go Back
        </Link>
      </div>
    </div>
  );
}
