// supabase/functions/stripe-webhook/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=denonext'

// Initialize the Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('PROJECT_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!
)

// Initialize the Stripe client
const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY')!, {
  apiVersion: '2024-10-28.acacia', // Latest stable version as of October 2024
})

// Create the Deno-native crypto provider
const cryptoProvider = Stripe.createSubtleCryptoProvider()

// ✅ Add your Stripe Price IDs here
const PRO_PRICE_ID = Deno.env.get('STRIPE_PRO_PRICE_ID')!
const STUDIO_PRICE_ID = Deno.env.get('STRIPE_STUDIO_PRICE_ID')!

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()

  try {
    // Use the official library's ASYNC function with the ASYNC crypto provider
    const receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
      undefined,
      cryptoProvider
    )

    // Handle the checkout.session.completed event
    if (receivedEvent.type === 'checkout.session.completed') {
      const session = receivedEvent.data.object
      const userId = session.client_reference_id

      if (!userId) {
        throw new Error('Webhook Error: Missing client_reference_id in session.')
      }

      // ✅ Retrieve the subscription to get the price ID
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )
      
      const priceId = subscription.items.data[0].price.id

      // ✅ Determine subscription tier based on price ID
      let subscriptionStatus: 'PRO' | 'STUDIO'
      
      if (priceId === PRO_PRICE_ID) {
        subscriptionStatus = 'PRO'
      } else if (priceId === STUDIO_PRICE_ID) {
        subscriptionStatus = 'STUDIO'
      } else {
        throw new Error(`Unknown price ID: ${priceId}`)
      }

      // ✅ Update user with the correct tier
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ 
          subscription_status: subscriptionStatus,
          stripe_customer_id: session.customer,
        })
        .eq('id', userId)

      if (error) {
        throw new Error(`Supabase update error: ${error.message}`)
      }

      console.log(`✅ Successfully upgraded user ${userId} to ${subscriptionStatus}`)
    }

    // ✅ Handle subscription cancellation
    if (receivedEvent.type === 'customer.subscription.deleted') {
      const subscription = receivedEvent.data.object
      const customerId = subscription.customer as string
    
      // Find user by stripe_customer_id
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
    
      if (!user) {
        throw new Error(`User not found for customer: ${customerId}`)
      }
    
      // Downgrade to FREE
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ 
          subscription_status: 'FREE',
          // Remove this line:
          // stripe_subscription_id: null
        })
        .eq('id', user.id)
    
      if (error) {
        throw new Error(`Supabase update error: ${error.message}`)
      }
    
      console.log(`✅ Successfully downgraded user ${user.id} to FREE`)
    }

  } catch (err) {
    console.error(`❌ Webhook handler error: ${err.message}`)
    return new Response(err.message, { status: 400 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
