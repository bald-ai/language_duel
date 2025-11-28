# Fresh Product

A modern Next.js application built with the latest tech stack.

## Tech Stack

- **Next.js** 16.0.5 (App Router)
- **React** 19.2.0
- **TypeScript** 5.x (strict mode)
- **Tailwind CSS** 4.x (via PostCSS)
- **Clerk** - Complete user authentication
- **Convex** - Real-time backend-as-a-service

## Getting Started

### Prerequisites

1. **Node.js** (latest version)
2. **Clerk Account** - Sign up at [clerk.com](https://clerk.com)
3. **Convex Account** - Sign up at [convex.dev](https://convex.dev)

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd fresh-product
   npm install
   ```

2. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   # Convex Backend
   NEXT_PUBLIC_CONVEX_URL=your_convex_url
   CONVEX_DEPLOYMENT=your_convex_deployment
   ```

3. **Configure Clerk**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - Copy the Publishable Key and Secret Key to your `.env.local`

4. **Configure Convex**
   ```bash
   npx convex dev
   ```
   - Follow the prompts to set up your backend
   - The URLs will be automatically added to your `.env.local`

### Development

Start both the Next.js and Convex development servers:

```bash
# Terminal 1 - Start Next.js
npm run dev

# Terminal 2 - Start Convex
npx convex dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

## Project Structure

```
fresh-product/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── auth.tsx           # Authentication buttons
│   └── convex-provider.tsx # Convex + Clerk provider
├── convex/               # Convex backend
│   ├── schema.ts         # Database schema
│   ├── users.ts          # User functions
│   └── _generated/       # Generated types
├── public/               # Static assets
└── README.md
```

## Features

- ✅ **Authentication** - Sign up, sign in, user management with Clerk
- ✅ **Real-time Database** - Convex backend with automatic sync
- ✅ **Type Safety** - Full TypeScript support in strict mode
- ✅ **Modern UI** - Beautiful design with Tailwind CSS 4
- ✅ **Responsive Design** - Mobile-first approach

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Deploy

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new).

1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy!

For Convex deployment, run:
```bash
npx convex deploy
```
