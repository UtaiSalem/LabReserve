<script setup lang="ts">
import { useSnapshot } from '~/composables/useBookings'

const sidebarOpen = ref(false)
const route = useRoute()
const { data, loading, error, refresh, ensure } = useSnapshot()

// kick off first snapshot load — pages that need data still call ensure() themselves
await ensure()

watch(() => route.fullPath, () => { sidebarOpen.value = false })
</script>

<template>
  <div class="min-h-screen flex bg-(--ui-bg-muted)">
    <!-- Desktop sidebar -->
    <div class="hidden md:block fixed inset-y-0 left-0 z-20">
      <AppSidebar />
    </div>

    <!-- Mobile drawer -->
    <USlideover
      v-model:open="sidebarOpen"
      side="left"
      :ui="{ content: 'w-72 max-w-[80vw]' }"
    >
      <template #content>
        <AppSidebar />
      </template>
    </USlideover>

    <!-- Main column -->
    <div class="flex-1 md:ml-64 flex flex-col min-w-0">
      <AppTopbar
        :title="(route.meta.pageTitle as string) || undefined"
        :subtitle="(route.meta.pageSubtitle as string) || undefined"
        @open-sidebar="sidebarOpen = true"
      />

      <main class="flex-1 p-3 md:p-6 pb-20 md:pb-6 max-w-7xl w-full mx-auto">
        <div v-if="loading && !data" class="flex flex-col items-center justify-center py-20 animate-pulse">
          <UIcon name="i-lucide-loader-2" class="w-12 h-12 text-primary-500 animate-spin mb-4" />
          <p class="text-sm text-(--ui-text-muted)">กำลังโหลดข้อมูลระบบ...</p>
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-error-500/10 flex items-center justify-center">
            <UIcon name="i-lucide-alert-circle" class="w-8 h-8 text-error-500" />
          </div>
          <div class="max-w-md">
            <h3 class="font-bold text-lg">การเชื่อมต่อผิดพลาด</h3>
            <p class="text-sm text-(--ui-text-muted) mt-1">{{ error }}</p>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            label="ลองใหม่อีกครั้ง"
            color="primary"
            @click="() => { refresh() }"
          />
        </div>

        <slot v-else />
      </main>

      <AppBottomTabs />
    </div>
  </div>
</template>
