'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import toast from 'react-hot-toast';

interface Country {
  id: string;
  code: string;
  name: string;
}

export default function NewStorePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    storeCode: '',
    storeName: '',
    countryId: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    franchiseeEmail: '',
    franchiseeName: '',
    franchiseePhone: '',
    plannedOpenDate: '',
    estimatedRevenue: '',
    initialInvestment: '',
    notes: '',
  });

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/stores?countriesOnly=true');
      if (res.ok) {
        const data = await res.json();
        setCountries(data);
      }
    } catch (error) {
      toast.error('Failed to load countries');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const store = await res.json();
        toast.success('Store created successfully!');
        router.push(`/dashboard/stores/${store.id}`);
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to create store');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create New Store</h1>

      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storeCode">Store Code *</Label>
                <Input
                  id="storeCode"
                  name="storeCode"
                  value={formData.storeCode}
                  onChange={handleChange}
                  required
                  placeholder="BBQ-US-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name *</Label>
                <Input
                  id="storeName"
                  name="storeName"
                  value={formData.storeName}
                  onChange={handleChange}
                  required
                  placeholder="BBQ Manhattan Downtown"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="countryId">Country *</Label>
                <Select
                  id="countryId"
                  name="countryId"
                  value={formData.countryId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plannedOpenDate">Planned Open Date</Label>
                <Input
                  id="plannedOpenDate"
                  name="plannedOpenDate"
                  type="date"
                  value={formData.plannedOpenDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="font-semibold">Address</h3>
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Franchisee Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Franchisee Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="franchiseeName">Franchisee Name</Label>
                  <Input
                    id="franchiseeName"
                    name="franchiseeName"
                    value={formData.franchiseeName}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="franchiseeEmail">Email</Label>
                  <Input
                    id="franchiseeEmail"
                    name="franchiseeEmail"
                    type="email"
                    value={formData.franchiseeEmail}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="franchiseePhone">Phone</Label>
                  <Input
                    id="franchiseePhone"
                    name="franchiseePhone"
                    type="tel"
                    value={formData.franchiseePhone}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Financial Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimatedRevenue">Estimated Revenue</Label>
                  <Input
                    id="estimatedRevenue"
                    name="estimatedRevenue"
                    type="number"
                    step="0.01"
                    value={formData.estimatedRevenue}
                    onChange={handleChange}
                    placeholder="500000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialInvestment">Initial Investment</Label>
                  <Input
                    id="initialInvestment"
                    name="initialInvestment"
                    type="number"
                    step="0.01"
                    value={formData.initialInvestment}
                    onChange={handleChange}
                    placeholder="300000"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Additional notes about the store..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Store'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
