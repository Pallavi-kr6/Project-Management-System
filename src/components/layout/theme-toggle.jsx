"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
    const [dark, setDark] = useState(false);
    useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
    function toggle() {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        }
        catch {
            /* storage unavailable (private mode): theme just won't persist */
        }
        setDark(next);
    }
    return (<Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
    </Button>);
}
