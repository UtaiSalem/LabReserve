import type { Booking, ToolApprover } from '~/types/booking'

export function useApprovals() {
  const { data, refresh } = useSnapshot()
  const { user } = useAuth()
  const { setStatus } = useBookings()
  const api = useApi()

  const toolApprovers = useState<ToolApprover[]>('approvals.toolApprovers', () => [])
  const loadingApprovers = useState<boolean>('approvals.loading', () => false)

  async function fetchToolApprovers() {
    loadingApprovers.value = true
    try {
      const res = await api<{ entries: ToolApprover[] }>('/tool-approvers')
      toolApprovers.value = res.entries
    } catch (e) {
      console.error('Failed to fetch tool approvers', e)
    } finally {
      loadingApprovers.value = false
    }
  }

  const myTools = computed(() => {
    if (!user.value) return []
    return toolApprovers.value
      .filter(ta => ta.approver_username === user.value?.username)
      .map(ta => ta.tool)
  })

  const inbox = computed(() => {
    const tools = myTools.value
    const isSpecial = user.value?.role === 'admin'
    
    return (data.value?.bookings || [])
      .filter(b => b.status === 'pending')
      .filter(b => isSpecial || tools.includes(b.tool))
      .sort((a, b) => {
        // Urgency: ใกล้วันใช้งานที่สุดมาก่อน
        const startA = new Date(a.start).getTime()
        const startB = new Date(b.start).getTime()
        if (startA !== startB) return startA - startB
        
        // ถ้าวันใช้เท่ากัน เอาที่ส่งมาก่อนขึ้นก่อน
        return (a.created_at || 0) - (b.created_at || 0)
      })
  })

  const historyMine = computed(() => {
    const tools = myTools.value
    const isSpecial = user.value?.role === 'admin'
    
    return (data.value?.bookings || [])
      .filter(b => b.status !== 'pending')
      .filter(b => isSpecial || tools.includes(b.tool))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  })

  function getUrgency(b: Booking) {
    const start = new Date(b.start).getTime()
    const now = Date.now()
    const created = (b.created_at || 0) * 1000
    
    // Urgent ถ้าเริ่มใช้งานภายใน 24 ชม.
    const isUrgent = (start - now) > 0 && (start - now) < 24 * 3600 * 1000
    // Overdue ถ้าส่งมาเกิน 24 ชม. แล้วยังไม่ทำอะไร
    const isOverdue = now - created > 24 * 3600 * 1000
    
    if (isUrgent) return 'urgent'
    if (isOverdue) return 'overdue'
    return 'normal'
  }

  function byId(id: string) {
    return (data.value?.bookings || []).find(b => b.id === id)
  }

  return {
    inbox,
    historyMine,
    loadingApprovers,
    fetchToolApprovers,
    getUrgency,
    byId,
    approve: (id: string) => setStatus(id, 'approved'),
    reject: (id: string, reason: string) => setStatus(id, 'rejected', reason)
  }
}
