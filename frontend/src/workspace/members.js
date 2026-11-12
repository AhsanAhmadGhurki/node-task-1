// member ka dikhne wala naam — mock members ke naam data mein, "aap" ka naam asli session (user) se
import { ME_ID } from './mockData'

export function memberName(org, userId, user) {
  if (userId === ME_ID) return user ? `${user.name || user.email} (aap)` : 'Aap'
  const member = org.members.find((m) => m.userId === userId)
  // member nikal diya gaya ho to bhi uska banaya task rehta hai
  return member?.name || member?.email || 'Purana member'
}

export function memberEmail(member, user) {
  return member.userId === ME_ID ? user.email : member.email
}
