<script setup lang="ts">
import { fromLocalInputValue, toLocalInputValue, formatTimeRange, formatDate } from '~/utils/date'
import type { Booking } from '~/types/booking'

definePageMeta({
  middleware: 'role',
  roles: ['requester', 'admin'],
  pageTitle: 'จองเครื่องมือ',
  pageSubtitle: 'กรอกข้อมูลคำขอจองเครื่องมือวิทยาศาสตร์'
})

const { ensure, create, all: allBookings } = useBookings()
const { data: snapshot } = useSnapshot()

await ensure()

const tools = computed<string[]>(() => snapshot.value?.tools || [])
const toolConfig = computed(() => snapshot.value?.toolConfig || {})

const form = reactive({
  tool: '',
  date: toLocalInputValue().split('T')[0]!,
  startTime: '09:00',
  endTime: '11:00',
  purpose: '',
  samples: ''
})

const loading = ref(false)
const errorMsg = ref<string | null>(null)
const toast = useToast()

const toolOptions = computed(() => tools.value.map(t => ({ label: t, value: t })))

function combine(date: string, time: string): string {
  return fromLocalInputValue(`${date}T${time}`)
}

const startIso = computed(() => combine(form.date, form.startTime))
const endIso = computed(() => combine(form.date, form.endTime))

const sameDayForTool = computed<Booking[]>(() => {
  if (!form.tool || !form.date) return []
  return allBookings.value
    .filter(b => b.tool === form.tool && b.status !== 'rejected')
    .filter(b => b.start.startsWith(form.date))
    .sort((a, b) => a.start.localeCompare(b.start))
})

const conflict = computed<Booking | null>(() => {
  if (!form.tool || !form.date || !form.startTime || !form.endTime) return null
  const s = new Date(startIso.value).getTime()
  const e = new Date(endIso.value).getTime()
  if (e <= s) return null
  return sameDayForTool.value.find(b => {
    const bs = new Date(b.start).getTime()
    const be = new Date(b.end).getTime()
    return s < be && bs < e
  }) || null
})

const timeOptions = computed(() => {
  const opts: { label: string; value: string }[] = []
  for (let h = 7; h <= 19; h++) {
    for (const m of ['00', '30']) {
      const v = `${String(h).padStart(2, '0')}:${m}`
      opts.push({ label: v, value: v })
    }
  }
  return opts
})

const selectedToolInfo = computed(() => form.tool ? toolConfig.value[form.tool] : null)

async function onSubmit() {
  errorMsg.value = null
  if (!form.tool) { errorMsg.value = 'กรุณาเลือกเครื่องมือ'; return }
  if (new Date(endIso.value) <= new Date(startIso.value)) {
    errorMsg.value = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม'
    return
  }
  if (!form.purpose.trim()) { errorMsg.value = 'กรุณาระบุวัตถุประสงค์'; return }
  if (conflict.value) { errorMsg.value = 'ช่วงเวลานี้ชนกับคำขออื่น โปรดเลือกเวลาใหม่'; return }

  loading.value = true
  try {
    const samples = form.samples ? `ตัวอย่าง ${form.samples} ชิ้น — ` : ''
    const booking = await create({
      tool: form.tool,
      start: startIso.value,
      end: endIso.value,
      purpose: samples + form.purpose.trim()
    })
    toast.add({ title: 'ส่งคำขอเรียบร้อย', color: 'success', icon: 'i-lucide-check-circle' })
    await navigateTo(`/requester/bookings/${booking.id}`)
  } catch (err: unknown) {
    const e = err as { data?: { error?: string }; status?: number }
    if (e?.status === 409) errorMsg.value = 'ช่วงเวลาชนกับคำขออื่น'
    else errorMsg.value = e?.data?.error || 'ส่งคำขอไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="จองเครื่องมือ"
      subtitle="กรอกข้อมูลให้ครบและตรวจสอบช่วงเวลาก่อนส่งคำขอ"
    >
      <template #actions>
        <UButton to="/requester/bookings" color="neutral" variant="outline" icon="i-lucide-arrow-left">
          กลับ
        </UButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <!-- Form -->
      <UCard class="lg:col-span-3">
        <form class="space-y-5" @submit.prevent="onSubmit">
          <UAlert
            v-if="errorMsg"
            :title="errorMsg"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
          />

          <UFormField label="เครื่องมือ" required>
            <USelectMenu
              v-model="form.tool"
              :items="toolOptions"
              value-key="value"
              placeholder="เลือกเครื่องมือ"
              icon="i-lucide-flask-conical"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="วันที่ใช้งาน" required>
            <UInput
              v-model="form.date"
              type="date"
              size="lg"
              icon="i-lucide-calendar"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="เวลาเริ่ม" required>
              <USelectMenu
                v-model="form.startTime"
                :items="timeOptions"
                value-key="value"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UFormField label="เวลาสิ้นสุด" required>
              <USelectMenu
                v-model="form.endTime"
                :items="timeOptions"
                value-key="value"
                size="lg"
                class="w-full"
              />
            </UFormField>
          </div>

          <UAlert
            v-if="conflict"
            color="warning"
            variant="soft"
            icon="i-lucide-alert-triangle"
            title="ช่วงเวลาชนกับคำขออื่น"
            :description="`${conflict.requester} จองช่วง ${formatTimeRange(conflict.start, conflict.end)} ไว้แล้ว`"
          />

          <UFormField label="จำนวนตัวอย่าง (ถ้ามี)">
            <UInput
              v-model="form.samples"
              type="number"
              min="0"
              placeholder="เช่น 12"
              size="lg"
              icon="i-lucide-hash"
              class="w-full"
            />
          </UFormField>

          <UFormField label="วัตถุประสงค์การใช้งาน" required>
            <UTextarea
              v-model="form.purpose"
              :rows="3"
              placeholder="ระบุวัตถุประสงค์ เช่น วิเคราะห์สารตกค้างในตัวอย่างน้ำ"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-(--ui-border)">
            <UButton to="/requester/bookings" color="neutral" variant="ghost" size="lg" block class="sm:w-auto">
              ยกเลิก
            </UButton>
            <UButton
              type="submit"
              :loading="loading"
              :disabled="!!conflict"
              icon="i-lucide-send"
              size="lg"
              block
              class="sm:w-auto"
            >
              ส่งคำขอจอง
            </UButton>
          </div>
        </form>
      </UCard>

      <!-- Availability sidebar -->
      <div class="lg:col-span-2 space-y-3">
        <UCard>
          <template #header>
            <p class="text-sm font-semibold text-(--ui-text-highlighted)">
              ช่วงเวลาว่าง — {{ formatDate(form.date) }}
            </p>
          </template>

          <div v-if="!form.tool" class="text-sm text-(--ui-text-muted) text-center py-6">
            เลือกเครื่องมือเพื่อดูตารางว่าง
          </div>
          <div v-else-if="!sameDayForTool.length" class="text-sm text-(--ui-text-muted) text-center py-6">
            <UIcon name="i-lucide-calendar-check" class="w-8 h-8 mx-auto mb-2 text-(--color-forest-600)" />
            ว่างทั้งวัน
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="b in sameDayForTool"
              :key="b.id"
              class="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-(--ui-bg-elevated)"
            >
              <span class="font-medium">{{ formatTimeRange(b.start, b.end) }}</span>
              <UBadge
                :label="b.status === 'pending' ? 'รออนุมัติ' : 'อนุมัติแล้ว'"
                :color="b.status === 'pending' ? 'warning' : 'success'"
                variant="subtle"
                size="sm"
              />
            </li>
          </ul>
        </UCard>

        <UCard v-if="selectedToolInfo">
          <template #header>
            <p class="text-sm font-semibold text-(--ui-text-highlighted)">
              ข้อมูลเครื่องมือ
            </p>
          </template>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-xs text-(--ui-text-muted)">
                ผู้อนุมัติ
              </dt>
              <dd class="text-(--ui-text-highlighted)">
                {{ selectedToolInfo.approver }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-(--ui-text-muted)">
                เจ้าหน้าที่ดูแล
              </dt>
              <dd class="text-(--ui-text-highlighted)">
                {{ selectedToolInfo.staff }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-(--ui-text-muted)">
                ช่องทางแจ้งเตือน
              </dt>
              <dd class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="c in selectedToolInfo.channels"
                  :key="c"
                  :label="c"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </dd>
            </div>
          </dl>
        </UCard>
      </div>
    </div>
  </div>
</template>
