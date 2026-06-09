import type { Booking, StaffStatus } from '~/types/booking'

export function useStaffQueue() {
  const { data, refresh } = useSnapshot()
  const { setStaffStatus } = useBookings()

  const allApproved = computed(() => {
    return (data.value?.bookings || [])
      .filter(b => b.status === 'approved')
      .sort((a, b) => a.start.localeCompare(b.start))
  })

  function isSameDay(dateStr: string, compareDate: Date) {
    const d = new Date(dateStr)
    return d.getFullYear() === compareDate.getFullYear() &&
           d.getMonth() === compareDate.getMonth() &&
           d.getDate() === compareDate.getDate()
  }

  const todayList = computed(() => {
    const now = new Date()
    return allApproved.value.filter(b => isSameDay(b.start, now))
  })

  const tomorrowList = computed(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return allApproved.value.filter(b => isSameDay(b.start, tomorrow))
  })

  const byReadiness = (list: Booking[]) => {
    return {
      preparing: list.filter(b => b.staffStatus === 'waiting'),
      ready: list.filter(b => b.staffStatus === 'ready'),
      issue: list.filter(b => b.staffStatus === 'issue'),
      calibrate: list.filter(b => b.staffStatus === 'calibrate')
    }
  }

  return {
    todayList,
    tomorrowList,
    byReadiness,
    refresh,
    updateReadiness: (id: string, status: StaffStatus) => setStaffStatus(id, status)
  }
}
