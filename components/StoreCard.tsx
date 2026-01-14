'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  User,
  Phone,
  Mail,
} from 'lucide-react';

interface Store {
  id: string;
  tempName: string | null;
  officialName: string | null;
  country: string;
  city: string | null;
  address: string | null;
  timezone: string;
  storePhone: string | null;
  storeEmail: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAddress: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  plannedOpenDates: Array<{
    id: string;
    date: Date;
    reason: string | null;
  }>;
}

export default function StoreCard({ store }: { store: Store }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const storeName = store.officialName || store.tempName || 'Unnamed Store';
  const latestOpenDate = store.plannedOpenDates[0];

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-6">
        {/* Collapsed View */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link
              href={`/dashboard/stores/${store.id}`}
              className="text-xl font-semibold text-gray-900 hover:text-orange-600 transition-colors"
            >
              {storeName}
            </Link>
            <div className="mt-2 space-y-1">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                {store.city}, {store.country}
              </div>
              {latestOpenDate && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Planned Open: {formatDate(latestOpenDate.date)}
                </div>
              )}
              {store.ownerName && (
                <div className="flex items-center text-sm text-gray-600">
                  <User className="w-4 h-4 mr-2" />
                  {store.ownerName}
                </div>
              )}
              {store.ownerPhone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  {store.ownerPhone}
                </div>
              )}
            </div>
          </div>

          <div className="ml-4 flex flex-col items-end space-y-2">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                store.status === 'PLANNING'
                  ? 'bg-blue-100 text-blue-800'
                  : store.status === 'CONTRACT_SIGNED'
                  ? 'bg-purple-100 text-purple-800'
                  : store.status === 'CONSTRUCTION'
                  ? 'bg-yellow-100 text-yellow-800'
                  : store.status === 'PRE_OPENING'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {store.status.replace(/_/g, ' ')}
            </span>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Store Information
                </h4>
                <dl className="space-y-1">
                  {store.tempName && (
                    <div>
                      <dt className="text-xs text-gray-500">Temp Name:</dt>
                      <dd className="text-sm text-gray-900">{store.tempName}</dd>
                    </div>
                  )}
                  {store.officialName && (
                    <div>
                      <dt className="text-xs text-gray-500">Official Name:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.officialName}
                      </dd>
                    </div>
                  )}
                  {store.address && (
                    <div>
                      <dt className="text-xs text-gray-500">Address:</dt>
                      <dd className="text-sm text-gray-900">{store.address}</dd>
                    </div>
                  )}
                  {store.storePhone && (
                    <div>
                      <dt className="text-xs text-gray-500">Store Phone:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.storePhone}
                      </dd>
                    </div>
                  )}
                  {store.storeEmail && (
                    <div>
                      <dt className="text-xs text-gray-500">Store Email:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.storeEmail}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Owner Information
                </h4>
                <dl className="space-y-1">
                  {store.ownerName && (
                    <div>
                      <dt className="text-xs text-gray-500">Name:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.ownerName}
                      </dd>
                    </div>
                  )}
                  {store.ownerPhone && (
                    <div>
                      <dt className="text-xs text-gray-500">Phone:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.ownerPhone}
                      </dd>
                    </div>
                  )}
                  {store.ownerEmail && (
                    <div>
                      <dt className="text-xs text-gray-500">Email:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.ownerEmail}
                      </dd>
                    </div>
                  )}
                  {store.ownerAddress && (
                    <div>
                      <dt className="text-xs text-gray-500">Address:</dt>
                      <dd className="text-sm text-gray-900">
                        {store.ownerAddress}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Created: {formatDate(store.createdAt)}
              </div>
              <Link
                href={`/dashboard/stores/${store.id}`}
                className="text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                View Details →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
