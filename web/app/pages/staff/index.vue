<script setup lang="ts">
import { useSnapshot } from '~/composables/useBookings'
import { useStaffQueue } from '~/composables/useStaffQueue'
import type { StaffStatus } from '~/types/booking'
import { formatDate } from '~/utils/date'

definePageMeta({
  middleware: 'role',
  roles: ['staff', 'admin'],
  pageTitle: 'คิวงาน',
  pageSubtitle: 'เครื่องมือที่ต้องเตรียมและสถานะการใช้งาน'
})

const { ensure, refresh, loading: loadingSnapshot } = useSnapshot()
const { todayList, tomorrowList, byReadiness, updateReadiness } = useStaffQueue()
const toast = useToast()

const tabs = [
  { label: 'วันนี้', value: 'today', icon: 'i-lucide-calendar' },
  { label: 'พรุ่งนี้', value: 'tomorrow', icon: 'i-lucide-calendar-days' }
]
const activeTab = ref('today')

const currentList = computed(() => activeTab.value === 'today' ? todayList.value : tomorrowList.value)
const groups = computed(() => byReadiness(currentList.value))

const loadingId = ref<string | null>(null)

await ensure()

async function handleUpdateStatus(id: string, status: StaffStatus) {
  loadingId.value = id
  try {
    await updateReadiness(id, status)
    toast.add({ title: 'อัปเดตสถานะเรียบร้อย', color: 'success', icon: 'i-lucide-check-circle' })
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถอัปเดตได้', color: 'error' })
  } finally {
    loadingId.value = null
  }
}

const sectionConfigs = [
  { key: 'preparing', label: 'ต้องเตรียม / รอดำเนินการ', color: 'neutral', icon: 'i-lucide-clock' },
  { key: 'ready', label: 'พร้อมใช้งานแล้ว', color: 'success', icon: 'i-lucide-check-circle' },
  { key: 'issue', label: 'ติดปัญหา / แจ้งซ่อม', color: 'error', icon: 'i-lucide-alert-triangle' },
  { key: 'calibrate', label: 'รอสอบเทียบ', color: 'warning', icon: 'i-lucide-wrench' }
]

const displayedDate = computed(() => {
  if (activeTab.value === 'today') return formatDate(new Date().toISOString())
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return formatDate(tomorrow.toISOString())
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <UTabs v-model="activeTab" :items="tabs" class="w-full sm:w-64" />
      
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-(--ui-text-muted)">
          {{ displayedDate }}
        </span>
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          color="neutral"
          :loading="loadingSnapshot"
          @click="() => { refresh() }"
        />
      </div>
    </div>

    <!-- Empty State for whole list -->
    <div v-if="currentList.length === 0" class="py-20">
      <EmptyState
        title="ไม่มีคิวงาน"
        :description="activeTab === 'today' ? 'วันนี้ไม่มีรายการจองที่ได้รับอนุมัติ' : 'พรุ่งนี้ไม่มีรายการจองที่ได้รับอนุมัติ'"
        icon="i-lucide-calendar-x"
        class="bg-(--ui-bg) rounded-2xl border border-(--ui-border)"
      />
    </div>

    <!-- Groups -->
    <div v-else class="space-y-8">
      <section v-for="section in sectionConfigs" :key="section.key" class="space-y-3">
        <div v-if="(groups as any)[section.key].length > 0" class="flex items-center gap-2 px-1">
          <UIcon :name="section.icon" :class="`w-4 h-4 text-(--color-${section.color}-500)`" />
          <h2 class="text-sm font-bold uppercase tracking-wider text-(--ui-text-muted)">
            {{ section.label }}
          </h2>
          <UBadge :color="(section.color as any)" variant="subtle" size="xs" class="ml-1">
            {{ (groups as any)[section.key].length }}
          </UBadge>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <StaffQueueCard
            v-for="booking in (groups as any)[section.key]"
            :key="booking.id"
            :booking="booking"
            :loading="loadingId === booking.id"
            @update-status="status => handleUpdateStatus(booking.id, status)"
          />
        </div>
      </section>
    </div>
  </div>
</template>
