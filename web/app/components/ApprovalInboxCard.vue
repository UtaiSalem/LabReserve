<script setup lang="ts">
import type { Booking } from '~/types/booking'
import { formatRelative, formatDateTime } from '~/utils/date'

const props = defineProps<{
  booking: Booking
  active?: boolean
  urgency: 'urgent' | 'overdue' | 'normal'
}>()

const urgencyColor = computed(() => {
  if (props.urgency === 'urgent') return 'error'
  if (props.urgency === 'overdue') return 'warning'
  return 'neutral'
})

const urgencyLabel = computed(() => {
  if (props.urgency === 'urgent') return 'ด่วน - ใช้เร็วๆ นี้'
  if (props.urgency === 'overdue') return 'ค้างพิจารณา'
  return ''
})
</script>

<template>
  <UCard
    :class="[
      'cursor-pointer transition-all border-l-4',
      active ? 'ring-2 ring-(--ui-primary) border-l-(--ui-primary)' : 'hover:bg-(--ui-bg-elevated) border-l-transparent'
    ]"
    :ui="{ body: 'p-3 sm:p-4' }"
  >
    <div class="flex justify-between items-start gap-2">
      <div class="space-y-1 min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-sm truncate">{{ booking.requester }}</span>
          <UBadge v-if="urgencyLabel" :color="urgencyColor" variant="subtle" size="xs">
            {{ urgencyLabel }}
          </UBadge>
        </div>
        <h3 class="text-base font-semibold truncate text-(--ui-primary)">
          {{ booking.tool }}
        </h3>
        <p class="text-xs text-(--ui-text-muted) flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
          {{ formatDateTime(booking.start) }}
        </p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="text-[10px] text-(--ui-text-muted) uppercase">ส่งเมื่อ</p>
        <p class="text-xs font-medium">{{ formatRelative(new Date(booking.created_at * 1000).toISOString()) }}</p>
      </div>
    </div>
  </UCard>
</template>
