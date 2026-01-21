import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApiErrors } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  const { id } = await params;

  try {
    const period = await prisma.inventoryPeriod.findUnique({
      where: { id },
      include: {
        group: true,
        items: {
          include: {
            ingredient: true,
          },
          orderBy: {
            ingredient: {
              englishName: 'asc',
            },
          },
        },
      },
    });

    if (!period) {
      return ApiErrors.notFound('Period');
    }

    return NextResponse.json(period);
  } catch (error: unknown) {
    console.error('Error fetching inventory period details:', error);
    return ApiErrors.serverError(error);
  }
}
