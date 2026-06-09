<script setup lang="ts">
import type { Booking } from '~/types/booking'
import { formatTimeRange } from '~/utils/date'

const props = defineProps<{
  tool: string
  date: string
  excludeId?: string
}>()

const { all: allBookings } = useBookings()

const list = computed(() => {
  if (!props.tool || !props.date) return []
  return allBookings.value
    .filter(b => b.tool === props.tool && b.id !== props.excludeId && b.status !== 'rejected')
    .filter(b => b.start.startsWith(props.date))
    .sort((a, b) => a.start.localeCompare(b.start))
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="list.length === 0" class="text-sm text-(--ui-text-muted) py-6 text-center border-2 border-dashed border-(--ui-border) rounded-xl">
      <UIcon name="i-lucide-calendar-check" class="w-8 h-8 mx-auto mb-2 opacity-20" />
      ไม่มีการจองอื่นในวันนี้
    </div>
    <div v-else class="space-y-2">
      <div 
        v-for="c in list" 
        :key="c.id"
        class="flex items-center justify-between p-3 rounded-lg bg-(--ui-bg-elevated) text-sm border border-(--ui-border)"
      >
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full" :class="c.status === 'approved' ? 'bg-(--color-success-500)' : 'bg-(--color-warning-500)'" />
          <span class="font-mono font-bold">{{ formatTimeRange(c.start, c.end) }}</span>
          <span class="text-(--ui-text-muted) truncate max-w-[120px]">{{ c.requester }}</span>
        </div>
        <UBadge 
          :color="c.status === 'approved' ? 'success' : 'warning'" 
          variant="subtle" 
          size="xs"
        >
          {{ c.status === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ' }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
