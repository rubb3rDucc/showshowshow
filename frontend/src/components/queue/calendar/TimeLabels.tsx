import { Box, Text } from '@mantine/core';

export function TimeLabels() {
  return (
    <Box
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '50px',
        height: '100%',
        borderRight: '1px solid #e0e0e0',
        backgroundColor: 'white',
        zIndex: 1,
      }}
    >
      {Array.from({ length: 24 }, (_, i) => {
        const hour = i;
        const time = new Date();
        time.setHours(hour, 0, 0, 0);
        const topPercent = (i / 24) * 100;
        
        return (
          <Box
            key={hour}
            style={{
              position: 'absolute',
              top: `${topPercent}%`,
              left: '8px',
              transform: 'translateY(0)',
            }}
          >
            <Text size="xs" fw={500} c="dimmed">
              {time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

