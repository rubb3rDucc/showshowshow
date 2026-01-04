import { Button } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface ScheduleHeaderProps {
  selectedDate: Date | null
  onDateChange: (date: Date | null) => void
  onClearDay: () => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
}

export function ScheduleHeader({
  selectedDate,
  onDateChange,
}: ScheduleHeaderProps) {
  const handlePrevDay = () => {
    if (selectedDate) {
      const prev = new Date(selectedDate)
      prev.setDate(prev.getDate() - 1)
      onDateChange(prev)
    }
  }
  const handleNextDay = () => {
    if (selectedDate) {
      const next = new Date(selectedDate)
      next.setDate(next.getDate() + 1)
      onDateChange(next)
    }
  }

  const handleDatePickerChange = (value: string | Date | null) => {
    if (!value) {
      onDateChange(null)
      return
    }
    
    // Mantine DatePickerInput can return Date or string
    if (value instanceof Date) {
      onDateChange(value)
    } else if (typeof value === 'string') {
      // Parse string date (YYYY-MM-DD format)
      const dateObj = new Date(value + 'T00:00:00')
      if (!isNaN(dateObj.getTime())) {
        onDateChange(dateObj)
      }
    }
  }
  return (
    <div className="mb-8">
      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 p-2 shadow-sm">
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<ChevronLeft size={16} />}
          onClick={handlePrevDay}
          className="font-light"
        >
          Prev Day
        </Button>

        <DatePickerInput
          value={selectedDate}
          onChange={handleDatePickerChange}
          variant="unstyled"
          size="sm"
          leftSection={<CalendarIcon size={16} className="text-gray-400" />}
          styles={{
            input: {
              textAlign: 'center',
              fontWeight: 500,
              cursor: 'pointer',
            },
          }}
        />

        <Button
          variant="subtle"
          color="gray"
          size="sm"
          rightSection={<ChevronRight size={16} />}
          onClick={handleNextDay}
          className="font-light"
        >
          Next Day
        </Button>
      </div>
    </div>
  )
}

