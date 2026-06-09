export type BookingStatus = 'pending' | 'approved' | 'rejected'
export type StaffStatus = 'waiting' | 'ready' | 'issue' | 'calibrate'

/** ตรงกับ row จาก legacy DB (db.js listBookings) */
export interface Booking {
  id: string
  requester: string
  department: string
  tool: string
  start: string
  end: string
  purpose: string
  status: BookingStatus
  staffStatus: StaffStatus
  created_by: string
  created_at: number
  rejection_reason: string | null
}

export interface ToolApprover {
  tool: string
  approver_username: string
  name: string
  email: string | null
}

export interface Notification {
  id: string
  title: string
  message: string
  category?: string
  severity?: 'info' | 'warning' | 'critical'
  related_id?: string
  read?: boolean
  created_at?: string
}

export interface ToolConfig {
  approver: string
  staff: string
  channels: string[]
}

export interface SnapshotResponse {
  tools: string[]
  bookings: Booking[]
  notifications: Notification[]
  unreadCount: number
  toolConfig: Record<string, ToolConfig>
}

/** display label for users — maps internal state → ภาษาคน */
export interface DisplayStatus {
  key: string
  label: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
  icon: string
}

export function getDisplayStatus(b: Pick<Booking, 'status' | 'staffStatus'>): DisplayStatus {
  if (b.status === 'rejected') {
    return { key: 'rejected', label: 'ไม่อนุมัติ', color: 'error', icon: 'i-lucide-x-circle' }
  }
  if (b.status === 'pending') {
    return { key: 'pending', label: 'รออนุมัติ', color: 'warning', icon: 'i-lucide-clock' }
  }
  // approved
  if (b.staffStatus === 'ready') {
    return { key: 'ready', label: 'พร้อมใช้งาน', color: 'success', icon: 'i-lucide-check-circle' }
  }
  if (b.staffStatus === 'issue') {
    return { key: 'issue', label: 'ติดปัญหา', color: 'error', icon: 'i-lucide-alert-triangle' }
  }
  if (b.staffStatus === 'calibrate') {
    return { key: 'calibrate', label: 'รอสอบเทียบ', color: 'warning', icon: 'i-lucide-wrench' }
  }
  return { key: 'preparing', label: 'กำลังเตรียม', color: 'info', icon: 'i-lucide-package' }
}
