<script setup lang="ts">
import type { Notification } from '~/types/booking'

const { list, unreadCount, markRead, markAllRead, getLink } = useNotifications()

const open = ref(false)

async function handleClick(n: Notification) {
  await markRead(n.id)
  const link = getLink(n)
  open.value = false
  if (link) await navigateTo(link)
}
</script>

<template>
  <USlideover v-model:open="open" side="right" :ui="{ content: 'w-full sm:max-w-md' }">
    <UButton
      icon="i-lucide-bell"
      color="neutral"
      variant="ghost"
      class="relative"
      aria-label="การแจ้งเตือน"
      @click="open = true"
    >
      <UBadge
        v-if="unreadCount > 0"
        :label="unreadCount > 9 ? '9+' : String(unreadCount)"
        color="error"
        size="xs"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center p-0 rounded-full ring-2 ring-(--ui-bg)"
      />
    </UButton>

    <template #content>
      <div class="h-full flex flex-col bg-(--ui-bg)">
        <header class="p-4 border-b border-(--ui-border) flex items-center justify-between shrink-0">
          <h2 class="text-base font-semibold">
            การแจ้งเตือน
          </h2>
          <div class="flex items-center gap-1">
            <UButton
              v-if="unreadCount > 0"
              label="อ่านทั้งหมด"
              variant="ghost"
              size="xs"
              color="primary"
              @click="markAllRead"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="ปิด"
              @click="open = false"
            />
          </div>
        </header>

        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <div v-if="list.length === 0" class="py-16 text-center text-(--ui-text-muted) space-y-2">
            <UIcon name="i-lucide-bell-off" class="w-10 h-10 mx-auto opacity-30" />
            <p class="text-sm">
              ไม่มีการแจ้งเตือน
            </p>
          </div>
          <NotificationItem
            v-for="n in list"
            :key="n.id"
            :notification="n"
            @click="handleClick(n)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
