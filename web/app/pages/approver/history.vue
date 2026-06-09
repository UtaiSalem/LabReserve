<script setup lang="ts">
import { useApprovals } from '~/composables/useApprovals'
import { formatDateTime } from '~/utils/date'

definePageMeta({
  middleware: 'role',
  roles: ['approver', 'admin'],
  pageTitle: 'ประวัติการตัดสินใจ',
  pageSubtitle: 'รายการที่คุณเคยพิจารณาไปแล้ว'
})

const { historyMine, loadingApprovers, fetchToolApprovers } = useApprovals()

await fetchToolApprovers()

const search = ref('')
const statusFilter = ref('all')

const filteredHistory = computed(() => {
  return historyMine.value.filter(b => {
    const matchesSearch = !search.value || 
      b.requester.toLowerCase().includes(search.value.toLowerCase()) ||
      b.tool.toLowerCase().includes(search.value.toLowerCase())
    
    const matchesStatus = statusFilter.value === 'all' || b.status === statusFilter.value
    
    return matchesSearch && matchesStatus
  })
})

const statusOptions = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'อนุมัติแล้ว', value: 'approved' },
  { label: 'ไม่อนุมัติ', value: 'rejected' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex flex-1 gap-2 w-full">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="ค้นหาเครื่องมือ, ผู้ขอ..."
          class="flex-1"
          size="lg"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusOptions"
          value-key="value"
          class="w-40"
          size="lg"
        />
      </div>
    </div>

    <div v-if="filteredHistory.length === 0" class="py-20">
      <EmptyState
        title="ไม่พบประวัติการใช้งาน"
        description="รายการที่คุณพิจารณาจะปรากฏที่นี่"
        icon="i-lucide-history"
        class="bg-(--ui-bg) rounded-2xl border border-(--ui-border)"
      />
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <UCard 
        v-for="b in filteredHistory" 
        :key="b.id"
        :ui="{ body: 'p-4' }"
        class="hover:bg-(--ui-bg-elevated)/50 transition-colors"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <UBadge 
                :color="b.status === 'approved' ? 'success' : 'error'" 
                variant="subtle" 
                size="xs"
              >
                {{ b.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ' }}
              </UBadge>
              <span class="text-xs text-(--ui-text-muted)">{{ formatDateTime(b.start) }}</span>
            </div>
            <h3 class="text-base font-bold text-(--ui-text-highlighted) truncate">
              {{ b.tool }}
            </h3>
            <p class="text-sm text-(--ui-text-muted) truncate">
              ผู้ขอ: {{ b.requester }} ({{ b.department }})
            </p>
            <p v-if="b.rejection_reason" class="text-xs text-error-500 italic truncate">
              เหตุผล: {{ b.rejection_reason }}
            </p>
          </div>
          
          <div class="shrink-0">
            <UButton
              v-if="b.status === 'approved'"
              :to="`/approver?selected=${b.id}`"
              variant="ghost"
              color="neutral"
              icon="i-lucide-chevron-right"
              disabled
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
