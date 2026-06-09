<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['approver', 'admin'],
  pageTitle: 'กล่องอนุมัติ',
  pageSubtitle: 'คำขอที่รอการตัดสินใจของคุณ'
})

const { ensure, refresh, loading: loadingSnapshot } = useSnapshot()
const { inbox, getUrgency, fetchToolApprovers, approve, reject } = useApprovals()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const selectedId = computed({
  get: () => route.query.selected as string || '',
  set: (val) => {
    router.replace({ query: { ...route.query, selected: val || undefined } })
  }
})

const selectedBooking = computed(() => {
  if (!selectedId.value) return null
  return inbox.value.find(b => b.id === selectedId.value)
})

const loadingAction = ref(false)
const showRejectModal = ref(false)

// Initial load
await ensure()
await fetchToolApprovers()

// Auto-select first item on desktop
onMounted(() => {
  const first = inbox.value[0]
  if (first && !selectedId.value && window.innerWidth >= 1024) {
    selectedId.value = first.id
  }
})

async function onApprove() {
  if (!selectedBooking.value) return
  loadingAction.value = true
  try {
    await approve(selectedBooking.value.id)
    toast.add({ title: 'อนุมัติคำขอเรียบร้อย', color: 'success', icon: 'i-lucide-check-circle' })

    selectedId.value = inbox.value[0]?.id ?? ''
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถอนุมัติได้', color: 'error' })
  } finally {
    loadingAction.value = false
  }
}

async function onReject(reason: string) {
  if (!selectedBooking.value) return
  loadingAction.value = true
  try {
    await reject(selectedBooking.value.id, reason)
    showRejectModal.value = false
    toast.add({ title: 'บันทึกการไม่อนุมัติเรียบร้อย', color: 'warning', icon: 'i-lucide-x-circle' })

    selectedId.value = inbox.value[0]?.id ?? ''
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถบันทึกได้', color: 'error' })
  } finally {
    loadingAction.value = false
  }
}

function handleSelect(id: string) {
  if (window.innerWidth < 1024) {
    navigateTo(`/approver/requests/${id}`)
  } else {
    selectedId.value = id
  }
}
</script>

<template>
  <div class="h-[calc(100vh-140px)] flex flex-col gap-4">
    <!-- Filters / Header -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <UBadge color="neutral" variant="outline">{{ inbox.length }} รายการรอตรวจ</UBadge>
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          size="xs"
          :loading="loadingSnapshot"
          @click="() => { refresh() }"
        />
      </div>
      <div class="hidden lg:flex items-center gap-2">
        <UButton
          to="/approver/history"
          variant="ghost"
          color="neutral"
          icon="i-lucide-history"
          size="sm"
        >
          ประวัติการตัดสินใจ
        </UButton>
      </div>
    </div>

    <div class="flex-1 flex gap-4 min-h-0">
      <!-- Inbox List (Left) -->
      <div class="w-full lg:w-[400px] flex flex-col gap-3 overflow-y-auto pr-1">
        <EmptyState
          v-if="inbox.length === 0"
          title="ไม่มีคำขอรออนุมัติ"
          description="เคลียร์หมดแล้ว 🎉 สบายใจได้"
          icon="i-lucide-check-circle"
          class="bg-(--ui-bg) rounded-2xl border border-(--ui-border)"
        />
        <ApprovalInboxCard
          v-for="b in inbox"
          :key="b.id"
          :booking="b"
          :active="selectedId === b.id"
          :urgency="getUrgency(b)"
          @click="handleSelect(b.id)"
        />
      </div>

      <!-- Detail Panel (Right - Desktop) -->
      <UCard
        class="hidden lg:flex flex-1 min-w-0 flex-col overflow-hidden rounded-2xl border-(--ui-border)"
        :ui="{ body: 'p-0 h-full', root: 'h-full' }"
      >
        <div v-if="!selectedBooking" class="h-full flex flex-col items-center justify-center text-(--ui-text-muted) space-y-4">
          <div class="w-20 h-20 rounded-full bg-(--ui-bg-elevated) flex items-center justify-center">
            <UIcon name="i-lucide-mouse-pointer-2" class="w-10 h-10 opacity-20" />
          </div>
          <p>เลือกคำขอที่ต้องการตรวจสอบจากรายการด้านซ้าย</p>
        </div>
        <ApprovalDetailPanel
          v-else
          :booking="selectedBooking"
          :loading="loadingAction"
          @approve="onApprove"
          @reject="showRejectModal = true"
        />
      </UCard>
    </div>

    <!-- Modals -->
    <RejectReasonDialog
      v-model="showRejectModal"
      :loading="loadingAction"
      @confirm="onReject"
    />
  </div>
</template>
