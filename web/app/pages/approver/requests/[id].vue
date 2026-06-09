<script setup lang="ts">
definePageMeta({
  middleware: 'role',
  roles: ['approver', 'admin'],
  pageTitle: 'ตรวจสอบคำขอ',
  pageSubtitle: 'รายละเอียดการจองเครื่องมือ'
})

const route = useRoute()
const { ensure } = useSnapshot()
const { byId, fetchToolApprovers, approve, reject } = useApprovals()
const toast = useToast()

await ensure()
await fetchToolApprovers()

const booking = computed(() => byId(route.params.id as string))

if (!booking.value) {
  throw createError({ statusCode: 404, statusMessage: 'ไม่พบคำขอจอง' })
}

useHead({
  title: `ตรวจสอบคำขอ - ${booking.value.tool}`
})

const loadingAction = ref(false)
const showRejectModal = ref(false)

async function onApprove() {
  if (!booking.value) return
  loadingAction.value = true
  try {
    await approve(booking.value.id)
    toast.add({ title: 'อนุมัติคำขอเรียบร้อย', color: 'success', icon: 'i-lucide-check-circle' })
    navigateTo('/approver')
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถอนุมัติได้', color: 'error' })
  } finally {
    loadingAction.value = false
  }
}

async function onReject(reason: string) {
  if (!booking.value) return
  loadingAction.value = true
  try {
    await reject(booking.value.id, reason)
    showRejectModal.value = false
    toast.add({ title: 'บันทึกการไม่อนุมัติเรียบร้อย', color: 'warning', icon: 'i-lucide-x-circle' })
    navigateTo('/approver')
  } catch (err: any) {
    toast.add({ title: 'เกิดข้อผิดพลาด', description: err.data?.error || 'ไม่สามารถบันทึกได้', color: 'error' })
  } finally {
    loadingAction.value = false
  }
}
</script>

<template>
  <div v-if="booking" class="h-full flex flex-col gap-4">
    <div class="shrink-0">
      <UButton
        to="/approver"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        class="-ml-2 mb-2"
      >
        กลับไปกล่องอนุมัติ
      </UButton>
    </div>

    <div class="flex-1 min-h-0 bg-(--ui-bg) rounded-2xl border border-(--ui-border) overflow-hidden">
      <ApprovalDetailPanel
        :booking="booking"
        :loading="loadingAction"
        @approve="onApprove"
        @reject="showRejectModal = true"
      />
    </div>

    <!-- Modals -->
    <RejectReasonDialog
      v-model="showRejectModal"
      :loading="loadingAction"
      @confirm="onReject"
    />
  </div>
</template>
