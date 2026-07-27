This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Contact Form Email Setup

Contact form is available at `/contact` and sends email to `dragan.papic.czv@gmail.com` by default.

Required environment variables:

```bash
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

Optional environment variables:

```bash
SMTP_SECURE=false
CONTACT_FROM_EMAIL=no-reply@your-domain.com
CONTACT_TO_EMAIL=dragan.papic.czv@gmail.com
```

Route handler location: `src/app/api/contact/route.ts`.

## Recipe Types

- Each recipe now supports multiple types (for example: `pizze` + `vegetarijanska hrana`).
- Type badges with custom colors are shown on recipe cards and recipe details.
- Admin users can add new recipe types (name + hex color) from add/edit recipe pages.

## Troubleshooting (Windows ENOENT in `.next/static/development/_buildManifest.js.tmp.*`)

If you see repeated `ENOENT` errors for `_buildManifest.js.tmp.*` on Windows:

1. Stop any running dev server.
2. Remove the `.next` folder.
3. Start again with the default compiler (`npm run dev`).

PowerShell steps:

```powershell
cd "C:\projects\New folder\apps\web"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

If you still want Turbopack, use:

```powershell
cd "C:\projects\New folder\apps\web"
npm run dev:turbo
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
