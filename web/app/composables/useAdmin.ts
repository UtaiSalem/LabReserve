import type { CurrentUser } from './useAuth'
import type { ToolApprover } from '~/types/booking'

export function useAdmin() {
  const api = useApi()

  const users = useState<CurrentUser[]>('admin.users', () => [])
  const toolApprovers = useState<ToolApprover[]>('admin.toolApprovers', () => [])
  const loading = useState<boolean>('admin.loading', () => false)

  async function fetchUsers() {
    loading.value = true
    try {
      const res = await api<{ users: CurrentUser[] }>('/users')
      users.value = res.users
    } finally {
      loading.value = false
    }
  }

  async function fetchToolApprovers() {
    loading.value = true
    try {
      const res = await api<{ entries: ToolApprover[] }>('/tool-approvers')
      toolApprovers.value = res.entries
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(username: string, body: any) {
    const res = await api<{ user: CurrentUser; users: CurrentUser[] }>(`/users/${username}/profile`, {
      method: 'PATCH',
      body
    })
    users.value = res.users
    return res.user
  }

  async function setPassword(username: string, password: string) {
    await api(`/users/${username}/password`, {
      method: 'PATCH',
      body: { password }
    })
  }

  async function addToolApprover(tool: string, username: string) {
    const res = await api<{ entries: ToolApprover[] }>('/tool-approvers', {
      method: 'POST',
      body: { tool, approver_username: username }
    })
    toolApprovers.value = res.entries
  }

  async function removeToolApprover(tool: string, username: string) {
    const res = await api<{ entries: ToolApprover[] }>('/tool-approvers', {
      method: 'DELETE',
      body: { tool, approver_username: username }
    })
    toolApprovers.value = res.entries
  }

  return {
    users,
    toolApprovers,
    loading,
    fetchUsers,
    fetchToolApprovers,
    updateProfile,
    setPassword,
    addToolApprover,
    removeToolApprover
  }
}
