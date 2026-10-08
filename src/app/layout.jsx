import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata = {
    title: { default: "Project Management System", template: "%s · Project Management System" },
    description: "Plan projects, track tasks and see progress at a glance.",
};
export const viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
        { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
    ],
};
// Runs before first paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function RootLayout({ children }) {
    return (<html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }}/>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>);
}
