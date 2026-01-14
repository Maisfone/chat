import { useCallback, useEffect, useState } from "react";

const hasDarkClass = () => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  const body = document.body;
  return Boolean(
    (root && root.classList.contains("dark")) ||
      (body && body.classList.contains("dark"))
  );
};

export function useDarkTheme() {
  const [isDark, setIsDark] = useState(() => hasDarkClass());

  const update = useCallback(() => {
    try {
      setIsDark(hasDarkClass());
    } catch {
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }

    const handleMutations = (records) => {
      if (records.some((record) => record.attributeName === "class")) {
        update();
      }
    };

    const observers = [];
    const root = document.documentElement;
    const body = document.body;

    if (root) {
      const observer = new MutationObserver(handleMutations);
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
      observers.push(observer);
    }

    if (body) {
      const observer = new MutationObserver(handleMutations);
      observer.observe(body, { attributes: true, attributeFilter: ["class"] });
      observers.push(observer);
    }

    window.addEventListener("chat:themeChanged", update);
    update();

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("chat:themeChanged", update);
    };
  }, [update]);

  return isDark;
}
