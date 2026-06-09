<script setup lang="ts">
import type { Booking } from '~/types/booking'
import { formatDateTime } from '~/utils/date'

const props = defineProps<{
  booking: Booking
  loading?: boolean
}>()

const emit = defineEmits(['approve', 'reject'])

const dateOnly = computed(() => props.booking.start.split('T')[0]!)
</script>

<template>
  <div class="h-full flex flex-col bg-(--ui-bg)">
    <div class="p-6 space-y-8 overflow-y-auto flex-1">
      <!-- Header Info -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <UBadge color="warning" variant="subtle" size="md" icon="i-lucide-clock">รอการอนุมัติ</UBadge>
          <span class="text-xs text-(--ui-text-muted)">ID: {{ booking.id.split('-')[0] }}</span>
        </div>
        <h2 class="text-3xl font-extrabold text-(--ui-text-highlighted) tracking-tight">
          {{ booking.tool }}
        </h2>
        <div class="flex items-center gap-2 text-(--ui-text-muted)">
          <UAvatar :alt="booking.requester" size="xs" />
          <span class="font-medium text-(--ui-text-highlighted)">{{ booking.requester }}</span>
          <span>&middot;</span>
          <span>{{ booking.department }}</span>
        </div>
      </div>

      <!-- Detail Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-(--ui-bg-elevated) p-5 rounded-2xl border border-(--ui-border)">
          <p class="text-[10px] text-(--ui-text-muted) uppercase font-bold tracking-wider mb-2">ช่วงเวลาที่ขอใช้</p>
          <div class="space-y-1">
            <p class="text-lg font-bold text-(--ui-primary)">{{ formatDateTime(booking.start) }}</p>
            <p class="text-sm text-(--ui-text-muted) flex items-center gap-1">
              <UIcon name="i-lucide-arrow-down" class="w-3 h-3" />
              ถึง {{ formatDateTime(booking.end) }}
            </p>
          </div>
        </div>

        <div class="bg-(--ui-bg-elevated) p-5 rounded-2xl border border-(--ui-border)">
          <p class="text-[10px] text-(--ui-text-muted) uppercase font-bold tracking-wider mb-2">วัตถุประสงค์</p>
          <p class="text-base leading-relaxed text-(--ui-text-highlighted)">{{ booking.purpose }}</p>
        </div>
      </div>

      <!-- Timeline/Conflicts -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold flex items-center gap-2 text-(--ui-text-highlighted)">
            <UIcon name="i-lucide-calendar-range" class="text-(--ui-primary)" />
            ตารางการจองเครื่องนี้ ({{ dateOnly }})
          </h3>
        </div>
        
        <ConflictTimeline :tool="booking.tool" :date="dateOnly" :exclude-id="booking.id" />
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="p-4 border-t border-(--ui-border) bg-(--ui-bg) flex gap-3 sm:justify-end">
      <UButton
        color="neutral"
        variant="ghost"
        label="ไม่อนุมัติ"
        icon="i-lucide-x"
        size="xl"
        class="flex-1 sm:flex-none"
        :disabled="loading"
        @click="emit('reject')"
      />
      <UButton
        color="primary"
        label="อนุมัติคำขอ"
        icon="i-lucide-check"
        size="xl"
        class="flex-1 sm:flex-none"
        :loading="loading"
        @click="emit('approve')"
      />
    </div>
  </div>
</template>
