<script setup lang="ts">
import type { Booking, StaffStatus } from '~/types/booking'
import { formatTimeRange } from '~/utils/date'

const props = defineProps<{
  booking: Booking
  loading?: boolean
}>()

const emit = defineEmits(['update-status'])
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm font-bold text-(--ui-primary)">
            {{ formatTimeRange(booking.start, booking.end) }}
          </span>
          <span class="text-xs text-(--ui-text-muted)">•</span>
          <span class="text-sm font-medium truncate">{{ booking.requester }}</span>
        </div>
        <h3 class="text-base font-bold text-(--ui-text-highlighted) truncate">
          {{ booking.tool }}
        </h3>
        <p class="text-xs text-(--ui-text-muted) truncate">
          {{ booking.purpose }}
        </p>
      </div>

      <div class="shrink-0">
        <ReadinessButtons
          :current-status="booking.staffStatus"
          :loading="loading"
          @update="val => emit('update-status', val)"
        />
      </div>
    </div>
  </UCard>
</template>
