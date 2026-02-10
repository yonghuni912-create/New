import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const countriesOnly = searchParams.get('countriesOnly') === 'true';

  try {
    if (countriesOnly) {
      const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(countries);
    }

    const stores = await prisma.store.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          select: { status: true }
        }
      }
    });
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    if (!['ADMIN', 'PM'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.storeName) {
      return NextResponse.json({ error: '스토어 이름을 입력해주세요.', message: 'Store name is required' }, { status: 400 });
    }
    
    if (!data.country) {
      return NextResponse.json({ error: '국가를 선택해주세요.', message: 'Country is required' }, { status: 400 });
    }
    
    // Find or create country
    let countryRecord = await prisma.country.findFirst({
      where: {
        OR: [
          { code: data.country },
          { name: data.country }
        ]
      }
    });
    
    if (!countryRecord) {
      // Create the country if it doesn't exist
      countryRecord = await prisma.country.create({
        data: {
          code: data.country.length === 2 ? data.country : 'XX',
          name: data.country.length === 2 ? data.country : data.country,
          currency: 'USD'
        }
      });
    }
    
    // Generate unique store code
    const storeCount = await prisma.store.count();
    const storeCode = data.storeCode || `${countryRecord.code}-${String(storeCount + 1).padStart(3, '0')}`;

    const store = await prisma.store.create({
      data: {
        storeCode,
        storeName: data.storeName,
        countryId: countryRecord.id,
        country: countryRecord.code,
        city: data.city || null,
        address: data.address || null,
        franchiseePhone: data.franchiseePhone || null,
        franchiseeEmail: data.franchiseeEmail || null,
        franchiseeName: data.franchiseeName || null,
        status: data.status || 'PLANNING',
        plannedOpenDate: data.plannedOpenDate ? new Date(data.plannedOpenDate) : null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'Store',
        entityId: store.id,
        action: 'CREATE',
        userId: user.id,
        newValue: JSON.stringify(store),
      },
    });

    // Auto-generate launch tasks if plannedOpenDate is set
    let generatedTaskCount = 0;
    if (store.plannedOpenDate) {
      try {
        // Import generateLaunchTasks dynamically to avoid circular dependencies
        const { generateLaunchTasks } = await import('@/lib/scheduling');
        
        // Get launch templates (try DEFAULT first, then any available)
        let launchTemplates = await prisma.launchTaskTemplate.findMany({
          where: { templateName: 'DEFAULT', isActive: true },
          orderBy: { orderIndex: 'asc' },
        });
        
        // If no DEFAULT template, try to get any template
        if (launchTemplates.length === 0) {
          launchTemplates = await prisma.launchTaskTemplate.findMany({
            where: { isActive: true },
            orderBy: { orderIndex: 'asc' },
            take: 200,
          });
        }

        if (launchTemplates.length > 0) {
          const generatedTasks = generateLaunchTasks(store.plannedOpenDate, launchTemplates);

          // Create tasks in database
          await prisma.$transaction(
            generatedTasks.map((task) =>
              prisma.task.create({
                data: {
                  title: task.title,
                  description: task.subcategory || undefined,
                  startDate: task.startDate,
                  dueDate: task.dueDate,
                  status: 'TODO',
                  priority: task.priority,
                  category: task.category,
                  subcategory: task.subcategory,
                  durationDays: task.durationDays,
                  daysBeforeOpening: task.daysBeforeOpening,
                  orderIndex: task.orderIndex,
                  storeId: store.id,
                  launchTemplateId: task.launchTemplateId,
                },
              })
            )
          );
          generatedTaskCount = generatedTasks.length;
        }
      } catch (taskError) {
        console.error('Error generating launch tasks:', taskError);
        // Don't fail store creation if task generation fails
      }
    }

    return NextResponse.json({
      ...store,
      _generatedTaskCount: generatedTaskCount,
    });
  } catch (error: any) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create store' },
      { status: 500 }
    );
  }
}
