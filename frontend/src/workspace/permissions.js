// workspace ki permission matrix — backend ke README aur utils/roles.js jaisi hi
// frontend sirf buttons band/chhupata hai; asal rok hamesha backend (requireRole + roles.js) ki — wahan se 403/404 aata hai

export const ROLES = ['owner', 'admin', 'member', 'viewer']

// har role ek line mein — page par "aap kya kar sakte hain"
export const ROLE_INFO = {
  owner: 'Sab kuch — members, roles, invites, naam, har task, org delete aur ownership transfer.',
  admin: 'Members invite/remove karta hai (member/viewer), org ka naam aur har task badal sakta hai.',
  member: 'Tasks banata hai, kisi ka bhi task done karta hai; naam badalna/mitana sirf apne task ka.',
  viewer: 'Sirf dekh sakta hai.',
}

// action → kin roles ko ijazat (backend ke requireRole jaisa)
const MATRIX = {
  'org:rename': ['owner', 'admin'],
  'org:delete': ['owner'],
  'org:transfer': ['owner'],
  'member:invite': ['owner', 'admin'],
  // task banana aur done/pending — member se upar sab (viewer nahi)
  'task:create': ['owner', 'admin', 'member'],
  'task:toggle': ['owner', 'admin', 'member'],
}

// org ka task — naam badalna/mitana: owner/admin har task; member sirf apna banaya; viewer kuch nahi
// (backend utils/roles.js canManageTask jaisa)
export function canManageTask(role, isCreator) {
  if (role === 'owner' || role === 'admin') return true
  if (role === 'member') return isCreator
  return false
}

export function can(role, action) {
  return MATRIX[action]?.includes(role) ?? false
}

// kisi member ka role badalna ya nikalna — owner sab ko; admin sirf member/viewer ko
export function canManageMember(actorRole, targetRole) {
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole === 'member' || targetRole === 'viewer'
  return false
}

// role dropdown — admin kisi ko admin/owner nahi bana sakta
export function assignableRoles(actorRole) {
  if (actorRole === 'owner') return ROLES
  if (actorRole === 'admin') return ['member', 'viewer']
  return []
}

// invite mein owner kabhi nahi
export function invitableRoles(actorRole) {
  return assignableRoles(actorRole).filter((role) => role !== 'owner')
}

export function deniedReason(role) {
  return `Aap ka role (${role}) is ki ijazat nahi deta`
}
