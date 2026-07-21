/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#EAECF1",
        content: "#F5F6F9",
        panel: "#FFFFFF",
        ink: "#111826",
        muted: "#6B7686",
        faint: "#9AA3B2",
        line: "#EDEFF3",
        line2: "#E3E6EC",
        pill: "#F3F5F8",
        brand: "#2563EB",
        brand2: "#7C5CFC",
        brandbg: "#EAF1FE",
        good: "#16A34A",
        goodbg: "#E4F6EA",
        warn: "#F59E0B",
        warnbg: "#FDF3DE",
        bad: "#E5484D",
        dup: "#7C5CFC",
        chip: "#1B2431",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,38,.05)",
        lift: "0 1px 2px rgba(17,24,38,.04), 0 6px 20px rgba(17,24,38,.06)",
      },
      borderRadius: { xl2: "18px", xl3: "24px" },
    },
  },
  plugins: [],
};
