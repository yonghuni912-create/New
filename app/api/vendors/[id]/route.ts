import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// GET - Get single vendor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { name: 'asc' }
          ]
        }
      }
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error: any) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json({
      error: 'Failed to fetch vendor',
      details: error?.message
    }, { status: 500 });
  }
}

// PUT - Update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      category,
      country,
      city,
      address,
      phone,
      email,
      website,
      notes,
      isActive,
      contacts
    } = body;

    // Get existing vendor for audit
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: { contacts: true }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Update vendor and contacts in transaction
    const vendor = await prisma.$transaction(async (tx) => {
      // If contacts are provided, delete existing and create new
      if (contacts !== undefined) {
        await tx.vendorContact.deleteMany({
          where: { vendorId: params.id }
        });
      }

      return tx.vendor.update({
        where: { id: params.id },
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
          isActive,
          contacts: contacts && contacts.length > 0 ? {
            create: contacts.map((c: any) => ({
              name: c.name,
              position: c.position,
              phone: c.phone,
              mobile: c.mobile,
              email: c.email,
              isPrimary: c.isPrimary || false,
              notes: c.notes
            }))
          } : undefined
        },
        include: {
          contacts: true
        }
      });
    });

    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'VENDOR_UPDATE',
      entityType: 'Vendor',
      entityId: vendor.id,
      oldValue: { name: existingVendor.name, isActive: existingVendor.isActive },
      newValue: { name, isActive }
    });

    return NextResponse.json(vendor);
  } catch (error: any) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({
      error: 'Failed to update vendor',
      details: error?.message
    }, { status: 500 });
  }
}

// DELETE - Delete vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: params.id }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Cascade delete handles contacts
    await prisma.vendor.delete({
      where: { id: params.id }
    });

    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'VENDOR_DELETE',
      entityType: 'Vendor',
      entityId: params.id,
      oldValue: { name: existingVendor.name, category: existingVendor.category }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({
      error: 'Failed to delete vendor',
      details: error?.message
    }, { status: 500 });
  }
}
