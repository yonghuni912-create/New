import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import AdminAuditSection from '@/components/AdminAuditSection';

// 중남미 및 북미 타임존 목록
const TIMEZONES = [
  // Canada
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)', region: 'Canada' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)', region: 'Canada' },
  { value: 'America/Edmonton', label: 'Edmonton (MST/MDT)', region: 'Canada' },
  { value: 'America/Winnipeg', label: 'Winnipeg (CST/CDT)', region: 'Canada' },
  { value: 'America/Halifax', label: 'Halifax (AST/ADT)', region: 'Canada' },
  { value: 'America/St_Johns', label: "St. John's (NST/NDT)", region: 'Canada' },
  // Mexico
  { value: 'America/Mexico_City', label: 'Mexico City (CST)', region: 'Mexico' },
  { value: 'America/Tijuana', label: 'Tijuana (PST)', region: 'Mexico' },
  { value: 'America/Cancun', label: 'Cancun (EST)', region: 'Mexico' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)', region: 'Mexico' },
  // Central America
  { value: 'America/Guatemala', label: 'Guatemala (CST)', region: 'Central America' },
  { value: 'America/El_Salvador', label: 'El Salvador (CST)', region: 'Central America' },
  { value: 'America/Tegucigalpa', label: 'Honduras (CST)', region: 'Central America' },
  { value: 'America/Managua', label: 'Nicaragua (CST)', region: 'Central America' },
  { value: 'America/Costa_Rica', label: 'Costa Rica (CST)', region: 'Central America' },
  { value: 'America/Panama', label: 'Panama (EST)', region: 'Central America' },
  { value: 'America/Belize', label: 'Belize (CST)', region: 'Central America' },
  // Caribbean
  { value: 'America/Havana', label: 'Cuba (CST)', region: 'Caribbean' },
  { value: 'America/Santo_Domingo', label: 'Dominican Republic (AST)', region: 'Caribbean' },
  { value: 'America/Port-au-Prince', label: 'Haiti (EST)', region: 'Caribbean' },
  { value: 'America/Jamaica', label: 'Jamaica (EST)', region: 'Caribbean' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico (AST)', region: 'Caribbean' },
  // South America
  { value: 'America/Bogota', label: 'Colombia (COT)', region: 'South America' },
  { value: 'America/Lima', label: 'Peru (PET)', region: 'South America' },
  { value: 'America/Guayaquil', label: 'Ecuador (ECT)', region: 'South America' },
  { value: 'America/Caracas', label: 'Venezuela (VET)', region: 'South America' },
  { value: 'America/La_Paz', label: 'Bolivia (BOT)', region: 'South America' },
  { value: 'America/Santiago', label: 'Chile (CLT)', region: 'South America' },
  { value: 'America/Buenos_Aires', label: 'Argentina (ART)', region: 'South America' },
  { value: 'America/Sao_Paulo', label: 'Brazil (BRT)', region: 'South America' },
  { value: 'America/Montevideo', label: 'Uruguay (UYT)', region: 'South America' },
  { value: 'America/Asuncion', label: 'Paraguay (PYT)', region: 'South America' },
  { value: 'America/Guyana', label: 'Guyana (GYT)', region: 'South America' },
  { value: 'America/Paramaribo', label: 'Suriname (SRT)', region: 'South America' },
];

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as { id: string; role: string };

  if (user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const [users, countries] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.country.findMany({ orderBy: { name: 'asc' } })
  ]);

  // User actions
  async function createUser(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    if (!email || !password || !role) return;

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, name: name || email.split('@')[0], password: hashedPassword, role }
    });
    revalidatePath('/dashboard/admin');
  }

  async function resetPassword(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const newPassword = formData.get('newPassword') as string;
    if (!userId || !newPassword) return;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    revalidatePath('/dashboard/admin');
  }

  async function updateRole(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const newRole = formData.get('newRole') as string;
    if (!userId || !newRole) return;

    await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    revalidatePath('/dashboard/admin');
  }

  async function deleteUser(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    if (!userId) return;
    
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath('/dashboard/admin');
  }

  // Country actions
  async function createCountry(formData: FormData) {
    'use server';
    const code = formData.get('code') as string;
    const name = formData.get('name') as string;
    const currency = formData.get('currency') as string;
    const timezone = formData.get('timezone') as string;

    if (!code || !name || !currency || !timezone) return;

    await prisma.country.create({
      data: { code: code.toUpperCase(), name, currency: currency.toUpperCase(), timezone }
    });
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/stores/new');
  }

  async function updateCountry(formData: FormData) {
    'use server';
    const countryId = formData.get('countryId') as string;
    const name = formData.get('name') as string;
    const currency = formData.get('currency') as string;
    const timezone = formData.get('timezone') as string;

    if (!countryId) return;

    await prisma.country.update({
      where: { id: countryId },
      data: { name, currency: currency?.toUpperCase(), timezone }
    });
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/stores/new');
  }

  async function deleteCountry(formData: FormData) {
    'use server';
    const countryId = formData.get('countryId') as string;
    if (!countryId) return;

    await prisma.country.delete({ where: { id: countryId } });
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/stores/new');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="text-slate-500 mt-1">Manage users, countries, and system settings</p>
      </div>

      {/* Users Section */}
      <section id="users" className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>👤</span> User Management
        </h2>
        
        {/* Create User Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Create New User</h3>
          <form action={createUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                name="role"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="VIEWER">Viewer</option>
                <option value="CONTRIBUTOR">Contributor</option>
                <option value="PM">PM</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Create User
              </button>
            </div>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Users ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <form action={updateRole} className="inline-flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="newRole"
                          defaultValue={u.role}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="CONTRIBUTOR">Contributor</option>
                          <option value="PM">PM</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button type="submit" className="text-xs text-orange-600 hover:text-orange-700">Update</button>
                      </form>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <form action={resetPassword} className="inline-flex items-center gap-1">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="password"
                            name="newPassword"
                            placeholder="New password"
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-28"
                          />
                          <button type="submit" className="text-xs text-blue-600 hover:text-blue-700">Reset</button>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button type="submit" className="text-xs text-red-600 hover:text-red-700">Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Countries Section */}
      <section id="countries" className="space-y-6 pt-8 border-t">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>🌎</span> Country Management
        </h2>
        <p className="text-sm text-gray-500">Add countries for store locations. These will appear in the store creation form.</p>
        
        {/* Create Country Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Country</h3>
          <form action={createCountry} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
              <input
                type="text"
                name="code"
                required
                maxLength={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                placeholder="MX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Name</label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Mexico"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input
                type="text"
                name="currency"
                required
                maxLength={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                placeholder="MXN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                name="timezone"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select timezone...</option>
                {['Canada', 'Mexico', 'Central America', 'Caribbean', 'South America'].map(region => (
                  <optgroup key={region} label={region}>
                    {TIMEZONES.filter(tz => tz.region === region).map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Add Country
              </button>
            </div>
          </form>
        </div>

        {/* Countries List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Countries ({countries.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timezone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {countries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No countries added yet. Add your first country above.
                    </td>
                  </tr>
                ) : (
                  countries.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {c.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{c.currency}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{c.timezone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <form action={deleteCountry}>
                          <input type="hidden" name="countryId" value={c.id} />
                          <button type="submit" className="text-sm text-red-600 hover:text-red-700">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Add Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Quick Add: Latin American Countries</h4>
          <p className="text-sm text-blue-700 mb-3">
            Run this command in terminal to add all Latin American countries:
          </p>
          <code className="block bg-blue-100 p-2 rounded text-xs text-blue-900 overflow-x-auto">
            node prisma/seed-countries.js
          </code>
        </div>
      </section>

      {/* Audit Logs Section */}
      <AdminAuditSection />
    </div>
  );
}
