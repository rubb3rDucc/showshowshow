export const flags = {
  reviews: import.meta.env.VITE_ENABLE_REVIEWS === 'true',
  // When on, /lineup renders the single-timeline scheduling workspace (ProtoSchedule)
  // instead of the legacy QueueBuilderCalendar. Off-path keeps the old builder.
  // scheduleV2: import.meta.env.VITE_ENABLE_SCHEDULE_V2 === 'false',
};
