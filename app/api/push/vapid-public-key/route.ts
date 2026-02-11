import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// VAPID public key endpoint for push notification subscription
// In production, generate VAPID keys using web-push library:
// const webpush = require('web-push');
// const vapidKeys = webpush.generateVAPIDKeys();

export async function GET(request: NextRequest) {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 
    // Fallback development key (replace with real key in production)
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

  return NextResponse.json({
    vapidPublicKey,
  });
}
