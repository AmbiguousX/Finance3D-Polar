import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';
import { api } from './convex/_generated/api';

// Routes that require authentication but not subscription
const isAuthOnlyRoute = createRouteMatcher(['/profile(.*)', '/settings(.*)'])

// Routes that require both authentication and subscription
const isSubscriptionRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {

  const token = (await (await auth()).getToken({ template: "convex" }))


  const { hasActiveSubscription } = await fetchQuery(api.subscriptions.getUserSubscriptionStatus, {
  }, {
    token: token!,
  });

  // Check if the current route requires subscription
  const requiresSubscription = isSubscriptionRoute(req)

  // Check if the current route requires only authentication
  const requiresAuthOnly = isAuthOnlyRoute(req)

  // If route requires subscription but user doesn't have one, redirect to pricing
  if (requiresSubscription && !hasActiveSubscription) {
    const pricingUrl = new URL('/pricing', req.nextUrl.origin)
    return NextResponse.redirect(pricingUrl);
  }

  // Protect all routes that require either authentication or subscription
  if (requiresAuthOnly || requiresSubscription) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}