import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - List all vendors
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  try {
    const where: any = { isActive: true };
    
    if (country) where.country = country;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

// POST - Create a new vendor
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, category, country, city, address, phone, email, website, notes, contacts } = body;

    if (!name || !category || !country) {
      return NextResponse.json({ error: 'Name, category, and country are required' }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
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
        contacts: contacts?.length ? {
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
      include: { contacts: true }
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}
