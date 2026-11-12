// workspace ki permission matrix — ek jagah, har button yahin se poochta hai "kar sakta hai?"
// abhi sirf frontend (mock) — backend banne par yahi qaide requireRole('admin') middleware mein jayenge;
// frontend sirf buttons band karta hai, asal rok hamesha backend ki hogi

export const ROLES = ['owner', 'admin', 'member', 'viewer']

// har role ek line mein — page par "aap kya kar sakte hain" dikhane ke liye
export const ROLE_INFO = {
  owner: 'Sab kuch — members, roles, org delete aur ownership transfer bhi.',
  admin: 'Members invite/remove karta hai, aur sab ke tasks/tickets badal sakta hai (owners ko nahi chhedta).',
  member: 'Tasks/tickets banata hai, aur sirf apne wale badal sakta hai.',
  viewer: 'Sirf dekh sakta hai — kuch bana ya badal nahi sakta.',
}

// action → kin roles ko ijazat
const MATRIX = {
  'item:create': ['owner', 'admin', 'member'],
  'item:editAny': ['owner', 'admin'],
  'member:invite': ['owner', 'admin'],
  'org:delete': ['owner'],
}

export function can(role, action) {
  return MATRIX[action]?.includes(role) ?? false
}

// task/ticket badalna — admin/owner kisi ka bhi, member sirf apna, viewer kuch nahi
export function canEditItem(role, item, userId) {
  if (can(role, 'item:editAny')) return true
  return can(role, 'item:create') && item.createdBy === userId
}

// kisi member ka role badalna ya nikalna — owner sab ko; admin sirf member/viewer ko (doosre admin ya owner ko nahi)
export function canManageMember(actorRole, targetRole) {
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole === 'member' || targetRole === 'viewer'
  return false
}

// role dropdown mein kaun se roles — admin kisi ko admin/owner nahi bana sakta
export function assignableRoles(actorRole) {
  if (actorRole === 'owner') return ROLES
  if (actorRole === 'admin') return ['member', 'viewer']
  return []
}

// invite mein owner nahi — owner sirf maujooda member ko banaya ja sakta hai (transfer/promote)
export function invitableRoles(actorRole) {
  return assignableRoles(actorRole).filter((role) => role !== 'owner')
}

export const LAST_OWNER_MESSAGE = 'Org mein kam az kam ek owner zaroori hai. Pehle kisi aur ko owner banayein.'

// is member ka role badalne (nextRole) ya nikalne (nextRole = null) se org bina owner ke reh jayegi?
export function breaksLastOwner(members, userId, nextRole) {
  const target = members.find((m) => m.userId === userId)
  if (!target || target.role !== 'owner' || nextRole === 'owner') return false
  return members.filter((m) => m.role === 'owner').length === 1
}

// button band ho to wajah — title (hover) mein dikhane ke liye
export function deniedReason(role) {
  return `Aap ka role (${role}) is ki ijazat nahi deta`
}
