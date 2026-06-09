<script setup lang="ts">
import { formatDate, formatTimeRange, formatRelative } from '~/utils/date'
import { getDisplayStatus } from '~/types/booking'

definePageMeta({
  middleware: 'role',
  roles: ['requester', 'admin'],
  pageTitle: 'รายละเอียดคำขอ'
})

const route = useRoute()
const id = computed(() => route.params.id as string)

const { byId, ensure } = useBookings()
const { data: snapshot } = useSnapshot()

await ensure()

const booking = computed(() => byId(id.value))
const display = computed(() => booking.value ? getDisplayStatus(booking.value) : null)
const toolInfo = computed(() => booking.value ? snapshot.value?.toolConfig?.[booking.value.tool] : null)
</script>

<template>
  <div class="space-y-5">
    <UButton
      to="/requester/bookings"
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      size="sm"
    >
      กลับไปคำขอของฉัน
    </UButton>

    <div v-if="!booking" class="text-center py-12 text-(--ui-text-muted)">
      <UIcon name="i-lucide-search-x" class="w-12 h-12 mx-auto mb-2" />
      <p>ไม่พบคำขอนี้</p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p class="text-xs text-(--ui-text-muted) mb-1">
              #{{ booking.id.slice(0, 8) }}
            </p>
            <h1 class="text-xl font-semibold text-(--ui-text-highlighted)">
              {{ booking.tool }}
            </h1>
            <p class="text-sm text-(--ui-text-muted) mt-1">
              {{ formatDate(booking.start) }} · {{ formatTimeRange(booking.start, booking.end) }}
            </p>
          </div>
          <BookingStatusBadge :booking="booking" size="lg" />
        </div>
      </UCard>

      <UAlert
        v-if="booking.status === 'rejected'"
        :title="`คำขอไม่ได้รับอนุมัติ`"
        :description="booking.rejection_reason || 'ไม่มีเหตุผลระบุ'"
        color="error"
        variant="soft"
        icon="i-lucide-x-circle"
      />
      <UAlert
        v-else-if="display && display.key === 'ready'"
        title="เครื่องมือพร้อมใช้งานแล้ว"
        description="เจ้าหน้าที่ได้เตรียมเครื่องมือเรียบร้อย คุณสามารถมาใช้งานตามเวลาที่จองได้"
        color="success"
        variant="soft"
        icon="i-lucide-check-circle"
      />
      <UAlert
        v-else-if="display && display.key === 'issue'"
        title="เครื่องมือติดปัญหา"
        description="เจ้าหน้าที่กำลังประสานงาน โปรดตรวจสอบการแจ้งเตือนเพิ่มเติม"
        color="warning"
        variant="soft"
        icon="i-lucide-alert-triangle"
      />

      <UCard>
        <template #header>
          <p class="text-sm font-semibold">
            ข้อมูลคำขอ
          </p>
        </template>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              ผู้ขอ
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ booking.requester }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              หน่วยงาน
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ booking.department }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              วันเวลา
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ formatDate(booking.start) }}<br>
              {{ formatTimeRange(booking.start, booking.end) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              ส่งคำขอเมื่อ
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ formatRelative(booking.start) }}
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs text-(--ui-text-muted)">
              วัตถุประสงค์
            </dt>
            <dd class="text-(--ui-text-highlighted) whitespace-pre-wrap">
              {{ booking.purpose }}
            </dd>
          </div>
        </dl>
      </UCard>

      <UCard v-if="toolInfo">
        <template #header>
          <p class="text-sm font-semibold">
            ผู้เกี่ยวข้อง
          </p>
        </template>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              ผู้อนุมัติ
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ toolInfo.approver }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              เจ้าหน้าที่ดูแล
            </dt>
            <dd class="text-(--ui-text-highlighted)">
              {{ toolInfo.staff }}
            </dd>
          </div>
        </dl>
      </UCard>
    </div>
  </div>
</template>
