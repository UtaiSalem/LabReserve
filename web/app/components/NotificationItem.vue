<script setup lang="ts">
import type { Notification } from '~/types/booking'

const props = defineProps<{
  notification: Notification
}>()

const emit = defineEmits(['click'])

const iconMap: Record<string, string> = {
  'booking.created': 'i-lucide-plus-circle',
  'booking.approved': 'i-lucide-check-circle',
  'booking.rejected': 'i-lucide-x-circle',
  'booking.staff_status': 'i-lucide-info',
  'staff.remind': 'i-lucide-bell-ring',
  'security.login_failed': 'i-lucide-shield-alert',
  'user.password_changed': 'i-lucide-key'
}

const colorMap: Record<string, string> = {
  info: 'primary',
  warning: 'warning',
  critical: 'error'
}

const icon = computed(() => iconMap[props.notification.category || ''] || 'i-lucide-bell')
const color = computed(() => colorMap[props.notification.severity || 'info'] || 'primary')
</script>

<template>
  <div
    class="flex gap-3 p-3 rounded-xl transition-colors cursor-pointer group"
    :class="notification.read ? 'opacity-60 grayscale-[0.5] hover:bg-(--ui-bg-elevated)' : 'bg-(--ui-primary)/5 hover:bg-(--ui-primary)/10'"
    @click="emit('click')"
  >
    <div 
      class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
      :class="`bg-${color}-500/10 text-${color}-500`"
    >
      <UIcon :name="icon" class="w-5 h-5" />
    </div>

    <div class="flex-1 min-w-0 space-y-0.5">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-bold text-(--ui-text-highlighted) truncate">
          {{ notification.title }}
        </p>
        <span v-if="!notification.read" class="w-2 h-2 shrink-0 rounded-full bg-primary-500" />
      </div>
      <p class="text-xs text-(--ui-text-muted) line-clamp-2 leading-relaxed">
        {{ notification.message }}
      </p>
      <p class="text-[10px] text-(--ui-text-muted) flex items-center gap-1 pt-0.5">
        <UIcon name="i-lucide-clock" class="w-3 h-3" />
        {{ notification.created_at || 'เมื่อสักครู่' }}
      </p>
    </div>
  </div>
</template>
