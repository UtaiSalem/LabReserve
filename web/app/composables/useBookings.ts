import type { Booking, SnapshotResponse } from '~/types/booking'

interface CreateBookingInput {
  tool: string
  start: string
  end: string
  purpose: string
  /** optional override; default ใช้จาก profile */
  requester?: string
  department?: string
}

/**
 * snapshot ของระบบ (cache ระดับ app)
 * แต่ละ role จะใช้ subset ที่ต่างกัน — กรองในหน้าตัวเอง
 */
export function useSnapshot() {
  const api = useApi()
  const data = useState<SnapshotResponse | null>('snapshot', () => null)
  const loading = useState<boolean>('snapshot.loading', () => false)
  const error = useState<string | null>('snapshot.error', () => null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await api<SnapshotResponse>('/state')
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } }
      error.value = err?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'
    } finally {
      loading.value = false
    }
    return data.value
  }

  async function ensure() {
    if (!data.value && !loading.value) await refresh()
    return data.value
  }

  return { data, loading, error, refresh, ensure }
}

export function useBookings() {
  const { data, ensure, refresh } = useSnapshot()
  const { user } = useAuth()
  const api = useApi()

  const all = computed<Booking[]>(() => data.value?.bookings || [])

  const mine = computed<Booking[]>(() => {
    const username = user.value?.username
    if (!username) return []
    return all.value.filter(b => b.created_by === username)
  })

  const pendingForApproval = computed<Booking[]>(() => {
    return all.value.filter(b => b.status === 'pending')
  })

  function byId(id: string) {
    return all.value.find(b => b.id === id)
  }

  async function create(input: CreateBookingInput) {
    const body = {
      requester: input.requester || user.value?.name || user.value?.username || '',
      department: input.department || user.value?.department || '-',
      tool: input.tool,
      start: input.start,
      end: input.end,
      purpose: input.purpose
    }
    const res = await api<{ booking: Booking; data: SnapshotResponse }>('/bookings', {
      method: 'POST',
      body
    })
    if (res.data) data.value = res.data
    return res.booking
  }

  async function setStatus(id: string, status: 'approved' | 'rejected', reason?: string) {
    const res = await api<{ booking: Booking; data: SnapshotResponse }>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: { status, reason }
    })
    if (res.data) data.value = res.data
    return res.booking
  }

  async function setStaffStatus(id: string, staffStatus: 'waiting' | 'ready' | 'issue' | 'calibrate') {
    const res = await api<{ booking: Booking; data: SnapshotResponse }>(`/bookings/${id}/staff-status`, {
      method: 'PATCH',
      body: { staffStatus }
    })
    if (res.data) data.value = res.data
    return res.booking
  }

  return {
    all, mine, pendingForApproval,
    byId,
    ensure, refresh,
    create, setStatus, setStaffStatus
  }
}
