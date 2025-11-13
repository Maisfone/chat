import React from "react";

export function IconSearch({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
    </svg>
  );
}

export function IconChevronLeft({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function IconChevronRight({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function IconX({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function IconEllipsis({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export function IconEmoji({ className = "w-5 h-5" }) {
  // Use a simple emoji glyph for consistent rendering without extra deps
  return (
    <span className={className} role="img" aria-label="emoji">
      😊
    </span>
  );
}

export function IconStar({ className = "w-4 h-4", filled = false }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l1.63 3.918 4.254.372c1.164.102 1.636 1.545.749 2.32l-3.244 2.76 1.003 4.135c.274 1.127-.964 1.997-1.96 1.4L12 15.64 8.356 18.116c-.996.598-2.234-.273-1.96-1.4l1.003-4.135-3.244-2.76c-.887-.775-.415-2.218.749-2.32l4.254-.372 1.63-3.918z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.48 3.499a.562.562 0 011.04 0l1.4 3.36a.562.562 0 00.46.345l3.633.314a.562.562 0 01.32.98l-2.77 2.357a.562.562 0 00-.182.536l.82 3.493a.562.562 0 01-.84.61l-3.1-1.87a.562.562 0 00-.586 0l-3.1 1.87a.562.562 0 01-.84-.61l.82-3.493a.562.562 0 00-.182-.536l-2.77-2.357a.562.562 0 01.32-.98l3.633-.314a.562.562 0 00.46-.345l1.4-3.36z" />
    </svg>
  );
}
