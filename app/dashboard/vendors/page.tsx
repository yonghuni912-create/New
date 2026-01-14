'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Building2, Plus, Phone, Mail, MapPin, User, Search, X, Edit, Trash2, Globe } from 'lucide-react';

interface VendorContact {
  id?: string;
  name: string;
  position?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  isPrimary: boolean;
  notes?: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  isActive: boolean;
  contacts: VendorContact[];
}

const CATEGORIES = [
  'Equipment',
  'Food & Ingredients', 
  'Construction',
  'Packaging',
  'Marketing',
  'IT & POS',
  'Furniture',
  'Cleaning',
  'Logistics',
  'Other'
];

const COUNTRIES = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
  { code: 'MX', name: 'Mexico' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'CL', name: 'Chile' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brazil' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'PA', name: 'Panama' },
];

export default function VendorsPage() {
  const { data: session, status } = useSession();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Equipment',
    country: 'CA',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    notes: ''
  });
  const [contacts, setContacts] = useState<VendorContact[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login');
  }, [status]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        setVendors(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = { ...formData, contacts };
      
      const res = editingVendor
        ? await fetch(`/api/vendors/${editingVendor.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/vendors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (res.ok) {
        fetchVendors();
        closeModal();
      }
    } catch (error) {
      console.error('Failed to save vendor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 거래처를 삭제하시겠습니까?')) return;
    
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchVendors();
      }
    } catch (error) {
      console.error('Failed to delete vendor:', error);
    }
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      category: vendor.category,
      country: vendor.country,
      city: vendor.city || '',
      address: vendor.address || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      website: vendor.website || '',
      notes: vendor.notes || ''
    });
    setContacts(vendor.contacts.map(c => ({ ...c })));
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      category: 'Equipment',
      country: 'CA',
      city: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      notes: ''
    });
    setContacts([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
  };

  const addContact = () => {
    setContacts([...contacts, { name: '', isPrimary: contacts.length === 0 }]);
  };

  const updateContact = (index: number, field: keyof VendorContact, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    
    // If setting as primary, unset others
    if (field === 'isPrimary' && value) {
      updated.forEach((c, i) => {
        if (i !== index) c.isPrimary = false;
      });
    }
    
    setContacts(updated);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    if (filterCountry && v.country !== filterCountry) return false;
    if (filterCategory && v.category !== filterCategory) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        v.name.toLowerCase().includes(search) ||
        v.city?.toLowerCase().includes(search) ||
        v.contacts.some(c => c.name.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // Group by category
  const groupedVendors = filteredVendors.reduce((acc, vendor) => {
    if (!acc[vendor.category]) acc[vendor.category] = [];
    acc[vendor.category].push(vendor);
    return acc;
  }, {} as Record<string, Vendor[]>);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-600 mt-1">거래처 및 담당자 연락처 관리</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors or contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Countries</option>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Vendor List */}
      {Object.keys(groupedVendors).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors found</h3>
          <p className="text-gray-500">Add your first vendor to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedVendors).sort().map(([category, categoryVendors]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                {category} ({categoryVendors.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryVendors.map(vendor => (
                  <div key={vendor.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="p-4 border-b">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {COUNTRIES.find(c => c.code === vendor.country)?.name}
                            {vendor.city && `, ${vendor.city}`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(vendor)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vendor.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Vendor contact info */}
                      <div className="mt-3 space-y-1 text-sm">
                        {vendor.phone && (
                          <a href={`tel:${vendor.phone}`} className="flex items-center text-gray-600 hover:text-orange-600">
                            <Phone className="w-3 h-3 mr-2" />
                            {vendor.phone}
                          </a>
                        )}
                        {vendor.email && (
                          <a href={`mailto:${vendor.email}`} className="flex items-center text-gray-600 hover:text-orange-600">
                            <Mail className="w-3 h-3 mr-2" />
                            {vendor.email}
                          </a>
                        )}
                        {vendor.website && (
                          <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center text-gray-600 hover:text-orange-600">
                            <Globe className="w-3 h-3 mr-2" />
                            {vendor.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* Contacts */}
                    {vendor.contacts.length > 0 && (
                      <div className="p-4 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 mb-2">CONTACTS</p>
                        <div className="space-y-2">
                          {vendor.contacts.map(contact => (
                            <div key={contact.id} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-2 text-gray-400" />
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{contact.name}</span>
                                  {contact.position && (
                                    <span className="text-xs text-gray-500 ml-1">({contact.position})</span>
                                  )}
                                  {contact.isPrimary && (
                                    <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Primary</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {contact.mobile && (
                                  <a href={`tel:${contact.mobile}`} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title={contact.mobile}>
                                    <Phone className="w-4 h-4" />
                                  </a>
                                )}
                                {contact.email && (
                                  <a href={`mailto:${contact.email}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title={contact.email}>
                                    <Mail className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Company Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="https://"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Contacts</h3>
                  <button
                    type="button"
                    onClick={addContact}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Contact
                  </button>
                </div>
                
                {contacts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed rounded-lg">
                    No contacts added yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((contact, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg relative">
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                            <input
                              type="text"
                              required
                              value={contact.name}
                              onChange={(e) => updateContact(index, 'name', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
                            <input
                              type="text"
                              value={contact.position || ''}
                              onChange={(e) => updateContact(index, 'position', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Mobile</label>
                            <input
                              type="tel"
                              value={contact.mobile || ''}
                              onChange={(e) => updateContact(index, 'mobile', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                            <input
                              type="email"
                              value={contact.email || ''}
                              onChange={(e) => updateContact(index, 'email', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded text-sm"
                            />
                          </div>
                          <div className="col-span-2 flex items-center">
                            <input
                              type="checkbox"
                              id={`primary-${index}`}
                              checked={contact.isPrimary}
                              onChange={(e) => updateContact(index, 'isPrimary', e.target.checked)}
                              className="mr-2"
                            />
                            <label htmlFor={`primary-${index}`} className="text-sm text-gray-700">
                              Primary Contact
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  {editingVendor ? 'Update Vendor' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
