import { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function LazyImage({ src, alt, className }: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
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

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={currentSrc}
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

