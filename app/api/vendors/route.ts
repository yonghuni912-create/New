import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auditLog';

export const dynamic = 'force-dynamic';

// GET - List all vendors with optional filters
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const country = searchParams.get('country');
  const category = searchParams.get('category');

  try {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
        { notes: { contains: search } }
      ];
    }

    if (country) {
      where.country = country;
    }

    if (category) {
      where.category = category;
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { name: 'asc' }
          ]
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(vendors);
  } catch (error: any) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({
      error: 'Failed to fetch vendors',
      details: error?.message
    }, { status: 500 });
  }
}

// POST - Create new vendor
export async function POST(request: NextRequest) {
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
      contacts // Optional array of contacts
    } = body;

    if (!name || !category) {
      return NextResponse.json({
        error: 'Missing required fields: name, category'
      }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        category,
        country: country || 'CA',
        city,
        address,
        phone,
        email,
        website,
        notes,
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

    await createAuditLog({
      userId: (session.user as { id: string }).id,
      action: 'VENDOR_CREATE',
      entityType: 'Vendor',
      entityId: vendor.id,
      newValue: { name, category, country }
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({
      error: 'Failed to create vendor',
      details: error?.message
    }, { status: 500 });
  }
}
