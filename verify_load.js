import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// User ID to seed orders for (change this if needed, defaults to a placeholder or should be passed as arg)
const USER_ID = process.argv[2]

if (!USER_ID) {
    console.error('Usage: node verify_load.js <USER_ID>')
    process.exit(1)
}

async function seedOrders() {
    console.log(`Seeding 5000 orders for user ${USER_ID}...`)

    // Create a dummy session first
    const { data: session, error: sessError } = await supabase
        .from('sesiones_caja')
        .insert([{
            restaurante_id: USER_ID,
            fondo_inicial: 1000,
            estado: 'abierta',
            opened_at: new Date().toISOString()
        }])
        .select()
        .single()

    if (sessError) {
        console.error('Error creating session:', sessError)
        return
    }
    console.log('Dummy session created:', session.id)

    const BATCH_SIZE = 100
    const TOTAL_ORDERS = 5000

    for (let i = 0; i < TOTAL_ORDERS; i += BATCH_SIZE) {
        const orders = []
        for (let j = 0; j < BATCH_SIZE; j++) {
            orders.push({
                user_id: USER_ID,
                customer_name: `LoadTest User ${i + j}`,
                total: (Math.random() * 500).toFixed(2),
                status: 'delivered', // To test historical load
                payment_method: 'cash',
                order_type: 'dine_in',
                sesion_caja_id: session.id,
                created_at: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString()
            })
        }

        const { error } = await supabase.from('orders').insert(orders)
        if (error) {
            console.error(`Error inserting batch ${i}:`, error)
        } else {
            console.log(`Inserted batch ${i} to ${i + BATCH_SIZE}`)
        }
    }

    console.log('Seeding complete. 5000 orders created.')
}

seedOrders()
