import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

// GET /api/manuals/[id] - Fetch manual with ingredients
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Get manual
    const manualResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (manualResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    const manual = manualResult.rows[0];
    
    // Get ingredients with master data
    const ingredientsResult = await db.execute({
      sql: `SELECT mi.*, im.englishName as masterName, im.koreanName as masterKoreanName, im.unit as masterUnit
            FROM ManualIngredient mi
            LEFT JOIN IngredientMaster im ON mi.ingredientId = im.id
            WHERE mi.manualId = ?
            ORDER BY mi.sortOrder ASC`,
      args: [id],
    });
    
    // Parse cookingMethod if it's a string
    let cookingMethod = manual.cookingMethod;
    if (typeof cookingMethod === 'string') {
      try {
        cookingMethod = JSON.parse(cookingMethod);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    
    const response = {
      id: manual.id,
      name: manual.name,
      koreanName: manual.koreanName,
      yield: manual.yield,
      yieldUnit: manual.yieldUnit,
      sellingPrice: manual.sellingPrice,
      imageUrl: manual.imageUrl,
      shelfLife: manual.shelfLife,
      cookingMethod: cookingMethod,
      priceTemplateId: manual.priceTemplateId,
      isActive: manual.isActive === 1 || Boolean(manual.isActive),
      isArchived: manual.isArchived === 1 || Boolean(manual.isArchived),
      createdAt: manual.createdAt,
      updatedAt: manual.updatedAt,
      ingredients: ingredientsResult.rows.map(row => ({
        id: row.id,
        manualId: row.manualId,
        ingredientId: row.ingredientId,
        name: row.name,
        koreanName: row.koreanName,
        quantity: row.quantity,
        unit: row.unit,
        sortOrder: row.sortOrder,
        notes: row.notes,
        unitPrice: row.unitPrice,
        baseQuantity: row.baseQuantity,
        ingredientMaster: row.ingredientId ? {
          id: row.ingredientId,
          name: row.masterName,
          koreanName: row.masterKoreanName,
          unit: row.masterUnit
        } : null
      })),
    };
    
    console.log('✅ GET /api/manuals/[id] success:', id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Error fetching manual:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/manuals/[id] - Update manual
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    console.log('📝 PUT /api/manuals/[id] - Received body:', JSON.stringify(body, null, 2));
    
    const db = getDb();
    
    // Check if manual exists
    const existingResult = await db.execute({
      sql: `SELECT id FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    // Build update query dynamically
    const updateFields: string[] = [];
    const updateArgs: any[] = [];
    
    if (body.name !== undefined) { updateFields.push('name = ?'); updateArgs.push(body.name); }
    if (body.koreanName !== undefined) { updateFields.push('koreanName = ?'); updateArgs.push(body.koreanName); }
    if (body.yield !== undefined) { updateFields.push('yield = ?'); updateArgs.push(body.yield); }
    if (body.yieldUnit !== undefined) { updateFields.push('yieldUnit = ?'); updateArgs.push(body.yieldUnit); }
    if (body.sellingPrice !== undefined) { updateFields.push('sellingPrice = ?'); updateArgs.push(body.sellingPrice ? parseFloat(body.sellingPrice) : null); }
    if (body.imageUrl !== undefined) { updateFields.push('imageUrl = ?'); updateArgs.push(body.imageUrl); }
    if (body.shelfLife !== undefined) { updateFields.push('shelfLife = ?'); updateArgs.push(body.shelfLife); }
    if (body.cookingMethod !== undefined) { updateFields.push('cookingMethod = ?'); updateArgs.push(body.cookingMethod ? JSON.stringify(body.cookingMethod) : null); }
    if (body.priceTemplateId !== undefined) { updateFields.push('priceTemplateId = ?'); updateArgs.push(body.priceTemplateId || null); }
    if (body.isActive !== undefined) { updateFields.push('isActive = ?'); updateArgs.push(body.isActive ? 1 : 0); }
    if (body.isArchived !== undefined) { updateFields.push('isArchived = ?'); updateArgs.push(body.isArchived ? 1 : 0); }
    
    // Always update updatedAt
    updateFields.push('updatedAt = ?');
    updateArgs.push(new Date().toISOString());
    updateArgs.push(id);
    
    if (updateFields.length > 1) {
      await db.execute({
        sql: `UPDATE MenuManual SET ${updateFields.join(', ')} WHERE id = ?`,
        args: updateArgs,
      });
    }
    
    // Handle ingredients update
    if (body.ingredients !== undefined) {
      console.log('📝 Updating ingredients:', body.ingredients?.length || 0, 'items');
      
      // Delete existing ingredients
      await db.execute({
        sql: `DELETE FROM ManualIngredient WHERE manualId = ?`,
        args: [id],
      });
      
      // Create new ingredients
      if (body.ingredients && body.ingredients.length > 0) {
        for (let i = 0; i < body.ingredients.length; i++) {
          const ing = body.ingredients[i];
          const ingredientId = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.execute({
            sql: `INSERT INTO ManualIngredient (id, manualId, ingredientId, name, koreanName, quantity, unit, sortOrder, notes, unitPrice, baseQuantity) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              ingredientId,
              id,
              ing.ingredientId || null,
              ing.name || ing.koreanName || 'Unknown',
              ing.koreanName || null,
              parseFloat(ing.quantity) || 0,
              ing.unit || 'g',
              i,
              ing.notes || null,
              ing.unitPrice ?? null,
              ing.baseQuantity ?? null
            ],
          });
        }
      }
    }
    
    // Fetch and return updated manual
    const updatedResult = await db.execute({
      sql: `SELECT * FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    const ingredientsResult = await db.execute({
      sql: `SELECT * FROM ManualIngredient WHERE manualId = ? ORDER BY sortOrder ASC`,
      args: [id],
    });
    
    const manual = updatedResult.rows[0];
    let cookingMethod = manual.cookingMethod;
    if (typeof cookingMethod === 'string') {
      try { cookingMethod = JSON.parse(cookingMethod); } catch { }
    }
    
    const response = {
      ...manual,
      isActive: manual.isActive === 1 || Boolean(manual.isActive),
      isArchived: manual.isArchived === 1 || Boolean(manual.isArchived),
      cookingMethod,
      ingredients: ingredientsResult.rows
    };
    
    console.log('✅ Manual updated successfully:', id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ Error updating manual:', error);
    return NextResponse.json(
      { error: 'Failed to update manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/manuals/[id] - Soft delete (move to Trash)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const db = getDb();
    
    // Check if manual exists
    const existingResult = await db.execute({
      sql: `SELECT id FROM MenuManual WHERE id = ?`,
      args: [id],
    });
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Manual not found' }, { status: 404 });
    }
    
    // Soft delete - set isActive=false, isArchived=false (move to Trash)
    // Trash: isActive=0, isArchived=0
    // Archive: isActive=0, isArchived=1 (only master admin can see)
    await db.execute({
      sql: `UPDATE MenuManual SET isActive = 0, isArchived = 0, updatedAt = ? WHERE id = ?`,
      args: [new Date().toISOString(), id],
    });
    
    console.log('✅ Manual moved to trash:', id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error deleting manual:', error);
    return NextResponse.json(
      { error: 'Failed to delete manual', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}