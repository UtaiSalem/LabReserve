<script setup lang="ts">
import type { Booking } from '~/types/booking'
import { formatDate, formatTimeRange, formatRelative } from '~/utils/date'

const props = defineProps<{
  booking: Booking
  to?: string
  showRequester?: boolean
}>()

const link = computed(() => props.to || `/requester/bookings/${props.booking.id}`)
</script>

<template>
  <NuxtLink
    :to="link"
    class="block rounded-xl border border-(--ui-border) bg-(--ui-bg) p-4 hover:border-(--ui-primary)/40 hover:shadow-sm transition-all"
  >
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-(--ui-text-highlighted) truncate">
          {{ booking.tool }}
        </p>
        <p v-if="showRequester" class="text-xs text-(--ui-text-muted) truncate">
          {{ booking.requester }} · {{ booking.department }}
        </p>
      </div>
      <BookingStatusBadge :booking="booking" size="sm" />
    </div>
    <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
      <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
      <span>{{ formatDate(booking.start) }}</span>
      <span>·</span>
      <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
      <span>{{ formatTimeRange(booking.start, booking.end) }}</span>
    </div>
    <p
      v-if="booking.status === 'rejected' && booking.rejection_reason"
      class="text-xs text-red-600 dark:text-red-400 mt-2"
    >
      เหตุผล: {{ booking.rejection_reason }}
    </p>
    <p
      v-else-if="booking.status === 'pending'"
      class="text-xs text-(--ui-text-muted) mt-2"
    >
      ส่งคำขอ {{ formatRelative(booking.start) }}
    </p>
  </NuxtLink>
</template>
