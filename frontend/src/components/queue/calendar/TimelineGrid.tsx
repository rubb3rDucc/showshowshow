import { Box } from '@mantine/core';

export function TimelineGrid() {
  return (
    <>
      {Array.from({ length: 24 * 4 }, (_, i) => {
        const minutesFromMidnight = i * 15;
        const pixelsPerHour = 120;
        const pixelsPerMinute = pixelsPerHour / 60;
        const topPixels = 12 + (minutesFromMidnight * pixelsPerMinute);
        
        const isHourly = minutesFromMidnight % 60 === 0;
        
        return (
          <Box
            key={`grid-${i}`}
            style={{
              position: 'absolute',
              top: `${topPixels}px`,
              left: '40px',
              right: 0,
              height: '1px',
              backgroundColor: isHourly ? '#d0d0d0' : '#f0f0f0',
              pointerEvents: 'none',
              opacity: isHourly ? 1 : 0.5,
            }}
          />
        );
      })}
    </>
  );
}

