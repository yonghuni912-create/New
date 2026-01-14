import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get single vendor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
        }
      }
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor' }, { status: 500 });
  }
}

// PUT - Update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, category, country, city, address, phone, email, website, notes, isActive, contacts } = body;

    // Update vendor
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name,
        category,
        country,
        city,
        address,
        phone,
        email,
        website,
        notes,
        isActive
      }
    });

    // Update contacts if provided
    if (contacts) {
      // Delete existing contacts
      await prisma.vendorContact.deleteMany({ where: { vendorId: id } });
      
      // Create new contacts
      if (contacts.length > 0) {
        await prisma.vendorContact.createMany({
          data: contacts.map((c: any) => ({
            vendorId: id,
            name: c.name,
            position: c.position,
            phone: c.phone,
            mobile: c.mobile,
            email: c.email,
            isPrimary: c.isPrimary || false,
            notes: c.notes
          }))
        });
      }
    }

    // Fetch updated vendor with contacts
    const updatedVendor = await prisma.vendor.findUnique({
      where: { id },
      include: { contacts: true }
    });

    return NextResponse.json(updatedVendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

// DELETE - Delete vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.vendor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}
