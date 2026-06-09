<script setup lang="ts">
import type { Notification } from '~/types/booking'

const { list, unreadCount, markRead, markAllRead, getLink } = useNotifications()

async function handleClick(n: Notification) {
  await markRead(n.id)
  const link = getLink(n)
  if (link) {
    await navigateTo(link)
  }
}
</script>

<template>
  <UPopover :ui="{ content: 'w-80 sm:w-96 p-0 overflow-hidden rounded-2xl' }">
    <UButton
      icon="i-lucide-bell"
      color="neutral"
      variant="ghost"
      class="relative"
      aria-label="การแจ้งเตือน"
    >
      <UBadge
        v-if="unreadCount > 0"
        :label="unreadCount > 9 ? '9+' : unreadCount"
        color="error"
        size="xs"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center p-0 rounded-full ring-2 ring-(--ui-bg)"
      />
    </UButton>

    <template #content>
      <div class="flex flex-col max-h-[500px]">
        <div class="p-4 border-b border-(--ui-border) flex items-center justify-between shrink-0 bg-(--ui-bg)">
          <h3 class="font-bold text-sm">การแจ้งเตือน</h3>
          <UButton
            v-if="unreadCount > 0"
            label="อ่านทั้งหมด"
            variant="ghost"
            size="xs"
            color="primary"
            @click="markAllRead"
          />
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-1 bg-(--ui-bg)">
          <div v-if="list.length === 0" class="py-10 text-center text-(--ui-text-muted) space-y-2">
            <UIcon name="i-lucide-bell-off" class="w-8 h-8 mx-auto opacity-20" />
            <p class="text-sm">ไม่มีการแจ้งเตือน</p>
          </div>
          <NotificationItem
            v-for="n in list"
            :key="n.id"
            :notification="n"
            @click="handleClick(n)"
          />
        </div>

        <div v-if="list.length > 0" class="p-2 border-t border-(--ui-border) shrink-0 bg-(--ui-bg)">
          <UButton
            label="ดูทั้งหมด"
            variant="ghost"
            color="neutral"
            block
            size="sm"
            class="text-xs"
            disabled
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
