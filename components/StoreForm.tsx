'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Timezone data by country
const TIMEZONES_BY_COUNTRY: Record<string, Array<{ value: string; label: string; utc: string }>> = {
  CA: [
    { value: 'America/Vancouver', label: 'Vancouver – Pacific Standard', utc: 'UTC-8' },
    { value: 'America/Edmonton', label: 'Calgary – Mountain Standard', utc: 'UTC-7' },
    { value: 'America/Winnipeg', label: 'Winnipeg – Central Standard', utc: 'UTC-6' },
    { value: 'America/Toronto', label: 'Toronto – Eastern Standard', utc: 'UTC-5' },
    { value: 'America/Halifax', label: 'Halifax – Atlantic Standard', utc: 'UTC-4' },
    { value: 'America/St_Johns', label: 'St. Johns – Newfoundland', utc: 'UTC-3:30' },
  ],
  MX: [
    { value: 'America/Tijuana', label: 'Tijuana – Pacific', utc: 'UTC-8' },
    { value: 'America/Hermosillo', label: 'Hermosillo – Mountain', utc: 'UTC-7' },
    { value: 'America/Chihuahua', label: 'Chihuahua – Mountain', utc: 'UTC-6' },
    { value: 'America/Mexico_City', label: 'Mexico City – Central', utc: 'UTC-6' },
    { value: 'America/Cancun', label: 'Cancun – Eastern', utc: 'UTC-5' },
  ],
  CO: [
    { value: 'America/Bogota', label: 'Bogotá – Colombia', utc: 'UTC-5' },
  ],
  PE: [
    { value: 'America/Lima', label: 'Lima – Peru', utc: 'UTC-5' },
  ],
  CL: [
    { value: 'America/Santiago', label: 'Santiago – Chile', utc: 'UTC-4/-3' },
    { value: 'Pacific/Easter', label: 'Easter Island', utc: 'UTC-6/-5' },
  ],
  AR: [
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', utc: 'UTC-3' },
    { value: 'America/Argentina/Cordoba', label: 'Córdoba', utc: 'UTC-3' },
    { value: 'America/Argentina/Mendoza', label: 'Mendoza', utc: 'UTC-3' },
  ],
  BR: [
    { value: 'America/Noronha', label: 'Fernando de Noronha', utc: 'UTC-2' },
    { value: 'America/Sao_Paulo', label: 'São Paulo – Brasília', utc: 'UTC-3' },
    { value: 'America/Manaus', label: 'Manaus – Amazon', utc: 'UTC-4' },
    { value: 'America/Rio_Branco', label: 'Rio Branco – Acre', utc: 'UTC-5' },
  ],
  EC: [
    { value: 'America/Guayaquil', label: 'Guayaquil – Ecuador', utc: 'UTC-5' },
    { value: 'Pacific/Galapagos', label: 'Galápagos', utc: 'UTC-6' },
  ],
  GT: [
    { value: 'America/Guatemala', label: 'Guatemala City', utc: 'UTC-6' },
  ],
  PA: [
    { value: 'America/Panama', label: 'Panama City', utc: 'UTC-5' },
  ],
  CR: [
    { value: 'America/Costa_Rica', label: 'San José', utc: 'UTC-6' },
  ],
};

interface Country {
  id: string;
  code: string;
  name: string;
  currency: string;
  timezone: string;
}

interface Store {
  id?: string;
  tempName?: string | null;
  officialName?: string | null;
  country: string;
  city?: string | null;
  address?: string | null;
  timezone: string;
  storePhone?: string | null;
  storeEmail?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerAddress?: string | null;
  status: string;
  plannedOpenDate?: Date | string | null;
  openDateReason?: string | null;
}

interface Props {
  countries: Country[];
  userId: string;
  store?: Store;
}

export default function StoreForm({ countries, userId, store }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(
    store?.country || countries[0]?.code || ''
  );
  const [selectedTimezone, setSelectedTimezone] = useState(
    store?.timezone || TIMEZONES_BY_COUNTRY[store?.country || 'CA']?.[0]?.value || 'America/Toronto'
  );

  const selectedCountryData = countries.find((c) => c.code === selectedCountry);
  const availableTimezones = TIMEZONES_BY_COUNTRY[selectedCountry] || [];

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    // Auto-select first timezone for the new country
    const newTimezones = TIMEZONES_BY_COUNTRY[countryCode] || [];
    if (newTimezones.length > 0) {
      setSelectedTimezone(newTimezones[0].value);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const url = store?.id
        ? `/api/stores/${store.id}`
        : '/api/stores';
      
      const method = store?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          createdBy: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save store');
      }

      const savedStore = await response.json();
      toast.success(
        store?.id ? 'Store updated successfully!' : 'Store created successfully!'
      );
      router.push(`/dashboard/stores/${savedStore.id}`);
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temporary Name
              </label>
              <input
                type="text"
                name="tempName"
                defaultValue={store?.tempName || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="BBQ Mexico City Centro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Official Name
              </label>
              <input
                type="text"
                name="officialName"
                defaultValue={store?.officialName || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="BBQ Chicken Mexico City Centro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country *
              </label>
              <select
                name="country"
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone *
              </label>
              {availableTimezones.length > 0 ? (
                <select
                  name="timezone"
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {availableTimezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.utc})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="timezone"
                  value={selectedCountryData?.timezone || ''}
                  readOnly
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                defaultValue={store?.city || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Mexico City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                name="status"
                defaultValue={store?.status || 'PLANNING'}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="PLANNING">Planning</option>
                <option value="CONTRACT_SIGNED">Contract Signed</option>
                <option value="CONSTRUCTION">Construction</option>
                <option value="PRE_OPENING">Pre-Opening</option>
                <option value="OPEN">Open</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                defaultValue={store?.address || ''}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="123 Main Street, Centro..."
              />
            </div>
          </div>
        </div>

        {/* Store Contact */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Store Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Phone
              </label>
              <input
                type="tel"
                name="storePhone"
                defaultValue={store?.storePhone || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="+52-555-1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Email
              </label>
              <input
                type="email"
                name="storeEmail"
                defaultValue={store?.storeEmail || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="store@bbqchicken.com"
              />
            </div>
          </div>
        </div>

        {/* Owner Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Owner Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Name
              </label>
              <input
                type="text"
                name="ownerName"
                defaultValue={store?.ownerName || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Juan Rodriguez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Phone
              </label>
              <input
                type="tel"
                name="ownerPhone"
                defaultValue={store?.ownerPhone || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="+52-555-9876543"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Email
              </label>
              <input
                type="email"
                name="ownerEmail"
                defaultValue={store?.ownerEmail || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="owner@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Address
              </label>
              <input
                type="text"
                name="ownerAddress"
                defaultValue={store?.ownerAddress || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="456 Residential Street"
              />
            </div>
          </div>
        </div>

        {/* Planned Open Date */}
        {!store?.id && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Opening Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planned Open Date
                </label>
                <input
                  type="date"
                  name="plannedOpenDate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  name="openDateReason"
                  defaultValue="Initial planned date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Initial planned date"
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? 'Saving...'
              : store?.id
              ? 'Update Store'
              : 'Create Store'}
          </button>
        </div>
      </div>
    </form>
  );
}
