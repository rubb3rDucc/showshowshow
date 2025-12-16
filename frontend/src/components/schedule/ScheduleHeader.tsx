import { Text, Button } from '@mantine/core'
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
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <Text
            size="xs"
            c="dimmed"
            fw={500}
            className="uppercase tracking-widest mb-1"
          >
            Your Schedule
          </Text>
          <Text size="3xl" fw={300} className="text-gray-900 tracking-tight">
            {selectedDate?.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </div>

        {/* <Group>
          <div className="bg-gray-100 p-1 rounded-lg flex items-center">
            <ActionIcon
              variant={viewMode === 'grid' ? 'white' : 'transparent'}
              color="dark"
              size="md"
              radius="md"
              className={viewMode === 'grid' ? 'shadow-sm' : ''}
              onClick={() => onViewModeChange('grid')}
            >
              <LayoutGrid size={16} />
            </ActionIcon>
            <ActionIcon
              variant={viewMode === 'list' ? 'white' : 'transparent'}
              color="dark"
              size="md"
              radius="md"
              className={viewMode === 'list' ? 'shadow-sm' : ''}
              onClick={() => onViewModeChange('list')}
            >
              <List size={16} />
            </ActionIcon>
          </div>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="light" color="gray" size="lg" radius="md">
                <MoreHorizontal size={18} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Actions</Menu.Label>
              <Menu.Item
                leftSection={<CalendarIcon size={14} />}
                onClick={handleToday}
              >
                Jump to Today
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={onClearDay}
              >
                Clear Day
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group> */}
      </div>

      {/* Navigation Bar */}
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

