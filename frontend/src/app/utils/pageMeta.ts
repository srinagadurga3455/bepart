import { useEffect } from 'react';

// Tiny SEO helper — sets document title + meta description per public page.
// No new dependencies; used by landing and participant public pages.
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} · BePart`;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', description);
  }, [title, description]);
}
