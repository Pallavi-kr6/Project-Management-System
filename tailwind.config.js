const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

const config = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: token("card"),
        muted: token("muted"),
        "muted-foreground": token("muted-foreground"),
        border: token("border"),
        input: token("input"),
        primary: token("primary"),
        "primary-foreground": token("primary-foreground"),
        destructive: token("destructive"),
        "destructive-foreground": token("destructive-foreground"),
        ring: token("ring"),
        sidebar: token("sidebar"),
        "sidebar-foreground": token("sidebar-foreground"),
        "sidebar-accent": token("sidebar-accent"),
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: { lg: "0.625rem", md: "0.5rem", sm: "0.375rem" },
      boxShadow: { card: "0 1px 2px hsl(var(--shadow) / 0.06), 0 1px 1px hsl(var(--shadow) / 0.04)" },
    },
  },
  plugins: [],
};

module.exports = config;
