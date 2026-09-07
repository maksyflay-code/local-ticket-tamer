import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "IVI Telecom — ERP de Gestão" },
      { name: "description", content: "ERP da IVI Telecom: chamados, clientes e relatórios em um só lugar." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "IVI Telecom — ERP de Gestão" },
      { property: "og:description", content: "ERP da IVI Telecom: chamados, clientes e relatórios em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "IVI Telecom — ERP de Gestão" },
      { name: "twitter:description", content: "ERP da IVI Telecom: chamados, clientes e relatórios em um só lugar." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/8FGOkBh7vxWysK2zBtcw6NHwmUI3/social-images/social-1777982430185-WhatsApp_Image_2026-03-27_at_23.40.40.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/8FGOkBh7vxWysK2zBtcw6NHwmUI3/social-images/social-1777982430185-WhatsApp_Image_2026-03-27_at_23.40.40.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster
        theme="dark"
        richColors
        position="top-right"
        duration={3500}
        visibleToasts={3}
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "group !rounded-md !border !border-border !bg-card/95 !backdrop-blur-sm !shadow-lg !text-sm !py-2 !px-3 !min-h-0",
            title: "!text-xs !font-semibold !leading-tight",
            description: "!text-[11px] !text-muted-foreground !leading-snug",
            closeButton:
              "!bg-transparent !border-0 !text-muted-foreground hover:!text-foreground",
          },
        }}
      />
    </AuthProvider>
  );
}
