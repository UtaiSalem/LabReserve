<script setup lang="ts">
import { formatDate } from '~/utils/date'

definePageMeta({
  middleware: 'role',
  roles: ['requester', 'admin'],
  pageTitle: 'หน้าหลัก',
  pageSubtitle: 'สรุปคำขอและสิ่งที่ต้องทำของคุณ'
})

const { user } = useAuth()
const { mine, ensure, refresh, loading } = useBookingsView()

await ensure()

const stats = computed(() => {
  const ms = mine.value
  const now = Date.now()
  const in24h = now + 24 * 3600 * 1000
  return {
    pending: ms.filter(b => b.status === 'pending').length,
    approved: ms.filter(b => b.status === 'approved').length,
    upcoming: ms.filter(b => {
      const t = new Date(b.start).getTime()
      return b.status === 'approved' && t >= now && t <= in24h
    }).length
  }
})

const recent = computed(() => {
  return [...mine.value]
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
    .slice(0, 5)
})

const actionable = computed(() => {
  return mine.value.filter(b => b.status === 'rejected' || b.staffStatus === 'issue').slice(0, 3)
})

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'อรุณสวัสดิ์'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

function useBookingsView() {
  const b = useBookings()
  const s = useSnapshot()
  return { ...b, loading: s.loading }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="`${greeting()}, ${user?.name || user?.username}`"
      :subtitle="formatDate(new Date().toISOString())"
    >
      <template #actions>
        <UButton to="/requester/bookings/new" icon="i-lucide-plus-circle" size="md">
          จองเครื่องมือ
        </UButton>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="loading"
          aria-label="โหลดใหม่"
          @click="() => void refresh()"
        />
      </template>
    </PageHeader>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        label="รออนุมัติ"
        :value="stats.pending"
        icon="i-lucide-clock"
        color="warning"
        hint="กำลังรอผู้อนุมัติพิจารณา"
        to="/requester/bookings?filter=pending"
      />
      <StatCard
        label="อนุมัติแล้ว"
        :value="stats.approved"
        icon="i-lucide-check-circle"
        color="success"
        hint="พร้อมใช้งาน/เตรียมการ"
        to="/requester/bookings?filter=approved"
      />
      <StatCard
        label="ใกล้ถึงเวลาใช้งาน"
        :value="stats.upcoming"
        icon="i-lucide-alarm-clock"
        color="info"
        hint="ภายใน 24 ชั่วโมง"
      />
    </div>

    <!-- Action required -->
    <section v-if="actionable.length">
      <h2 class="text-sm font-semibold text-(--ui-text-highlighted) mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-alert-circle" class="w-4 h-4 text-(--color-sunset-600)" />
        สิ่งที่ต้องทำ
      </h2>
      <div class="space-y-2">
        <UAlert
          v-for="b in actionable"
          :key="b.id"
          :title="b.status === 'rejected' ? `คำขอ ${b.tool} ถูกตีกลับ` : `${b.tool} ติดปัญหา`"
          :description="b.rejection_reason || 'กรุณาตรวจสอบและดำเนินการ'"
          color="warning"
          variant="soft"
          icon="i-lucide-alert-triangle"
          :actions="[{ label: 'ดูรายละเอียด', color: 'warning', variant: 'outline', to: `/requester/bookings/${b.id}` }]"
        />
      </div>
    </section>

    <!-- Recent bookings -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
          คำขอล่าสุด
        </h2>
        <UButton
          to="/requester/bookings"
          variant="link"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
          size="sm"
        >
          ดูทั้งหมด
        </UButton>
      </div>

      <EmptyState
        v-if="!recent.length"
        icon="i-lucide-clipboard-list"
        title="คุณยังไม่มีคำขอ"
        description="เริ่มต้นโดยกดปุ่ม “จองเครื่องมือ” ด้านบน"
      >
        <template #action>
          <UButton to="/requester/bookings/new" icon="i-lucide-plus-circle">
            จองเครื่องมือใหม่
          </UButton>
        </template>
      </EmptyState>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BookingCard
          v-for="b in recent"
          :key="b.id"
          :booking="b"
        />
      </div>
    </section>
  </div>
</template>
