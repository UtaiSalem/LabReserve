<script setup lang="ts">
import type { StaffStatus } from '~/types/booking'

const props = defineProps<{
  currentStatus: StaffStatus
  loading?: boolean
}>()

const emit = defineEmits(['update'])

const options: { label: string; value: StaffStatus; color: string; icon: string }[] = [
  { label: 'รอดำเนินการ', value: 'waiting', color: 'neutral', icon: 'i-lucide-clock' },
  { label: 'พร้อมใช้', value: 'ready', color: 'success', icon: 'i-lucide-check-circle' },
  { label: 'ติดปัญหา', value: 'issue', color: 'error', icon: 'i-lucide-alert-triangle' },
  { label: 'รอสอบเทียบ', value: 'calibrate', color: 'warning', icon: 'i-lucide-wrench' }
]
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <UButton
      v-for="opt in options"
      :key="opt.value"
      :color="opt.value === currentStatus ? (opt.color as any) : 'neutral'"
      :variant="opt.value === currentStatus ? 'solid' : 'ghost'"
      :icon="opt.icon"
      size="xs"
      :loading="loading && opt.value === currentStatus"
      :disabled="loading"
      @click="emit('update', opt.value)"
    >
      {{ opt.label }}
    </UButton>
  </div>
</template>
