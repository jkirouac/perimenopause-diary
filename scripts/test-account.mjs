// Makes (or deletes) a throwaway account for trying the app, and prints a
// sign-in code so no email is needed.
// Run: node --env-file=.env.local scripts/test-account.mjs [create|delete] email

import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const [action, email] = process.argv.slice(2)

if (action === 'delete') {
  const { data } = await admin.auth.admin.listUsers()
  const user = data.users.find((u) => u.email === email)
  if (user) await admin.auth.admin.deleteUser(user.id)
  console.log(user ? `Deleted ${email}` : `No account for ${email}`)
} else {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) {
    // New address: create the account first, then ask again.
    await admin.auth.admin.createUser({ email, email_confirm: true })
    const again = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (again.error) throw again.error
    console.log(`Code for ${email}: ${again.data.properties.email_otp}`)
  } else {
    console.log(`Code for ${email}: ${data.properties.email_otp}`)
  }
}
