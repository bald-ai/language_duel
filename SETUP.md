# Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_convex_deployment
```

## Getting Started

1. **Clerk Setup**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - Copy the Publishable Key and Secret Key to your .env.local

2. **Convex Setup**
   - Install Convex CLI: `npm i -g convex`
   - Initialize Convex: `npx convex dev`
   - Follow the prompts to set up your backend
   - Copy the provided URLs to your .env.local

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Tech Stack

- **Next.js**: 16.0.5 (App Router)
- **React**: 19.2.0
- **TypeScript**: 5.x (strict mode)
- **Tailwind CSS**: 4.x (via PostCSS)
- **Clerk**: Authentication
- **Convex**: Backend-as-a-Service
