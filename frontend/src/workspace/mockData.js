// nakli (mock) orgs — backend abhi orgs nahi jaanta; har org mein "aap" ka role alag,
// taake sidebar se org badal kar har role (owner/admin/member/viewer) bina dobara login dekha ja sake

// logged-in user hamesha "me" — naam/email asli session se dikhte hain (memberLabel)
export const ME_ID = 'me'

const SARA = { userId: 'u-sara', name: 'Sara', email: 'sara@example.test' }
const ALI = { userId: 'u-ali', name: 'Ali', email: 'ali@example.test' }
const ZARA = { userId: 'u-zara', name: 'Zara', email: 'zara@example.test' }

// invite 48 ghante chalta hai — mock mein bhi wahi
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000

let counter = 0
// chhoti, har baar nayi id (mock ke liye kaafi)
export function newId(prefix) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

const inHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

export function createMockOrgs() {
  return [
    {
      id: 'org-meri',
      name: 'Meri Org',
      members: [
        { userId: ME_ID, role: 'owner' },
        { ...SARA, role: 'admin' },
        { ...ALI, role: 'member' },
        { ...ZARA, role: 'viewer' },
      ],
      invites: [{ email: 'naya@example.test', role: 'member', expiresAt: inHours(40) }],
      tasks: [
        { id: 't1', title: 'Permission matrix README mein likhna', done: true, createdBy: ME_ID },
        { id: 't2', title: 'Invite email ka text', done: false, createdBy: 'u-sara' },
        { id: 't3', title: 'Members page ka design', done: false, createdBy: 'u-ali' },
      ],
      tickets: [{ id: 'k1', title: 'Invite link expire ho gaya', done: false, createdBy: 'u-ali' }],
    },
    {
      id: 'org-acme',
      name: 'Acme Team',
      members: [
        { ...SARA, role: 'owner' },
        { userId: ME_ID, role: 'admin' },
        { ...ALI, role: 'member' },
      ],
      invites: [],
      tasks: [
        { id: 't4', title: 'Client call ki tayari', done: false, createdBy: 'u-sara' },
        { id: 't5', title: 'Weekly report', done: false, createdBy: ME_ID },
      ],
      tickets: [{ id: 'k2', title: 'Login par 423 aa raha hai', done: false, createdBy: 'u-sara' }],
    },
    {
      id: 'org-test',
      name: 'Test Org',
      members: [
        { ...ALI, role: 'owner' },
        { userId: ME_ID, role: 'member' },
        { ...ZARA, role: 'member' },
      ],
      invites: [],
      tasks: [
        { id: 't6', title: 'Mera apna task (member edit kar sakta hai)', done: false, createdBy: ME_ID },
        { id: 't7', title: 'Ali ka task (member edit nahi kar sakta)', done: false, createdBy: 'u-ali' },
      ],
      tickets: [],
    },
    {
      id: 'org-read',
      name: 'Read Only Co',
      members: [
        { ...ZARA, role: 'owner' },
        { userId: ME_ID, role: 'viewer' },
      ],
      invites: [],
      tasks: [{ id: 't8', title: 'Viewer sirf dekh sakta hai', done: false, createdBy: 'u-zara' }],
      tickets: [{ id: 'k3', title: 'Dashboard slow hai', done: true, createdBy: 'u-zara' }],
    },
  ]
}
