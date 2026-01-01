import { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

export function LazyImage({ src, alt, className }: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Don't observe if src is empty or null
    if (!src || src.trim() === '') {
      setCurrentSrc(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Load the image when it enters viewport
            setCurrentSrc(src);
          }
        });
      },
      {
        rootMargin: '400px', // Start loading 400px before entering viewport
        threshold: 0,
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [src]);

  // Don't render if src is empty or null
  if (!src || src.trim() === '') {
    return null;
  }

  // Render placeholder div for IntersectionObserver until image loads
  if (!currentSrc) {
    return (
      <div 
        ref={imgRef as any}
        className={className}
        style={{ minHeight: '1px', display: 'inline-block' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      ref={imgRef}
      src={currentSrc || undefined}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={() => setIsLoaded(true)}
      style={{
        opacity: isLoaded || !currentSrc ? 1 : 0.5,
        transition: 'opacity 0.2s ease-in-out',
      }}
    />
  );
}

