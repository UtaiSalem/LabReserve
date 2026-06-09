<script setup lang="ts">
import { formatDate, formatTimeRange, formatRelative } from '~/utils/date'
import { getDisplayStatus, type Booking } from '~/types/booking'

definePageMeta({
  middleware: 'role',
  roles: ['requester', 'admin'],
  pageTitle: 'คำขอของฉัน',
  pageSubtitle: 'รายการคำขอจองเครื่องมือทั้งหมด'
})

const route = useRoute()
const { mine, ensure, refresh } = useBookings()

await ensure()

type Filter = 'all' | 'pending' | 'approved' | 'rejected'
const filter = ref<Filter>((route.query.filter as Filter) || 'all')

const filters: { value: Filter; label: string; icon: string }[] = [
  { value: 'all', label: 'ทั้งหมด', icon: 'i-lucide-list' },
  { value: 'pending', label: 'รออนุมัติ', icon: 'i-lucide-clock' },
  { value: 'approved', label: 'อนุมัติแล้ว', icon: 'i-lucide-check-circle' },
  { value: 'rejected', label: 'ไม่อนุมัติ', icon: 'i-lucide-x-circle' }
]

const filtered = computed<Booking[]>(() => {
  const list = [...mine.value].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
  if (filter.value === 'all') return list
  return list.filter(b => b.status === filter.value)
})

const counts = computed(() => ({
  all: mine.value.length,
  pending: mine.value.filter(b => b.status === 'pending').length,
  approved: mine.value.filter(b => b.status === 'approved').length,
  rejected: mine.value.filter(b => b.status === 'rejected').length
}))
</script>

<template>
  <div class="space-y-5">
    <PageHeader title="คำขอของฉัน" subtitle="ติดตามสถานะคำขอจองเครื่องมือ">
      <template #actions>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          aria-label="โหลดใหม่"
          @click="() => void refresh()"
        />
        <UButton to="/requester/bookings/new" icon="i-lucide-plus-circle">
          จองใหม่
        </UButton>
      </template>
    </PageHeader>

    <!-- Filter chips -->
    <div class="flex flex-wrap gap-2 overflow-x-auto -mx-1 px-1 pb-1">
      <UButton
        v-for="f in filters"
        :key="f.value"
        :label="`${f.label} (${counts[f.value]})`"
        :icon="f.icon"
        :color="filter === f.value ? 'primary' : 'neutral'"
        :variant="filter === f.value ? 'soft' : 'ghost'"
        size="sm"
        @click="filter = f.value"
      />
    </div>

    <EmptyState
      v-if="!filtered.length"
      icon="i-lucide-clipboard-list"
      title="ไม่พบคำขอ"
      :description="filter === 'all' ? 'คุณยังไม่มีคำขอจองเครื่องมือ' : 'ไม่มีคำขอในหมวดนี้'"
    >
      <template #action>
        <UButton to="/requester/bookings/new" icon="i-lucide-plus-circle">
          จองเครื่องมือใหม่
        </UButton>
      </template>
    </EmptyState>

    <!-- Mobile: card list -->
    <div v-else class="md:hidden space-y-3">
      <BookingCard v-for="b in filtered" :key="b.id" :booking="b" />
    </div>

    <!-- Desktop: table -->
    <div v-if="filtered.length" class="hidden md:block">
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <table class="w-full text-sm">
          <thead class="text-xs text-(--ui-text-muted) bg-(--ui-bg-elevated)">
            <tr>
              <th class="text-left font-medium px-4 py-3">
                สถานะ
              </th>
              <th class="text-left font-medium px-4 py-3">
                เครื่องมือ
              </th>
              <th class="text-left font-medium px-4 py-3">
                วันที่
              </th>
              <th class="text-left font-medium px-4 py-3">
                เวลา
              </th>
              <th class="text-left font-medium px-4 py-3">
                รายละเอียด
              </th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-(--ui-border)">
            <tr
              v-for="b in filtered"
              :key="b.id"
              class="hover:bg-(--ui-bg-elevated)/50 transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <BookingStatusBadge :booking="b" size="sm" />
              </td>
              <td class="px-4 py-3 font-medium text-(--ui-text-highlighted)">
                {{ b.tool }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-(--ui-text-muted)">
                {{ formatDate(b.start) }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-(--ui-text-muted)">
                {{ formatTimeRange(b.start, b.end) }}
              </td>
              <td class="px-4 py-3 text-xs text-(--ui-text-muted) max-w-xs truncate">
                <span v-if="b.status === 'rejected' && b.rejection_reason" class="text-red-600 dark:text-red-400">
                  เหตุผล: {{ b.rejection_reason }}
                </span>
                <span v-else-if="b.status === 'pending'">
                  ส่งคำขอ {{ formatRelative(b.start) }}
                </span>
                <span v-else>{{ getDisplayStatus(b).label }}</span>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <UButton
                  :to="`/requester/bookings/${b.id}`"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  trailing-icon="i-lucide-chevron-right"
                >
                  ดู
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </div>
  </div>
</template>
