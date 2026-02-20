import { createClient } from '@supabase/supabase-js'

// Para ejecutar este script necesitas la llave SUPABASE_SERVICE_ROLE_KEY
// Puedes ejecutarlo con: node migrate_roles.js
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yyokoqebafkmvruhcbye.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
    console.error("❌ ERROR: Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY.")
    console.log("Por favor, ejecuta este script asignando primero la variable. Ejemplo:")
    console.log("SUPABASE_SERVICE_ROLE_KEY='tu-llave' node migrate_roles.js")
    process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function migrateRoles() {
    console.log("🚀 Iniciando migración de roles...")

    // 1. Empezamos con el superadmin
    const superAdminEmail = 'raulanconaa@gmail.com'
    console.log(`Buscando superadmin: ${superAdminEmail}`)

    const { data: adminUsers, error: adminErr } = await supabaseAdmin.auth.admin.listUsers()
    if (adminErr) {
        console.error("Error buscando usuarios:", adminErr)
        return
    }

    const superAdmin = adminUsers.users.find(u => u.email === superAdminEmail)

    if (superAdmin) {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            superAdmin.id,
            {
                app_metadata: { role: 'superadmin' },
                user_metadata: { role: null } // Limpiando role de user_metadata
            }
        )
        if (error) console.error("Error actualizando superadmin:", error)
        else console.log("✅ Superadmin actualizado correctamente.")
    } else {
        console.warn(`⚠️ Superadmin no encontrado: ${superAdminEmail}`)
    }

    // 2. Usuarios de prueba (Legacy owners)
    const legacyEmails = [
        'jessica.estefania@hotmail.com',
        'johsef4dmrs@gmail.com',
        'clouddrivemx@gmail.com'
    ]

    for (const email of legacyEmails) {
        const user = adminUsers.users.find(u => u.email === email)
        if (user) {
            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
                user.id,
                {
                    app_metadata: { role: 'owner' },
                    user_metadata: { role: null }
                }
            )
            if (error) console.error(`Error actualizando ${email}:`, error)
            else console.log(`✅ Owner actualizado correctamente: ${email}`)
        } else {
            console.warn(`⚠️ Owner no encontrado: ${email}`)
        }
    }

    console.log("✅ Migración finalizada.")
}

migrateRoles()
