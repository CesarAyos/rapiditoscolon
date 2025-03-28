import { supabase } from './supabaseClient'

export async function requestTrip(passengerId, pickup, dropoff) {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      passenger_id: passengerId,
      pickup_location: `POINT(${pickup.lng} ${pickup.lat})`,
      dropoff_location: `POINT(${dropoff.lng} ${dropoff.lat})`,
      pickup_address: pickup.address,
      dropoff_address: dropoff.address,
      status: 'requested'
    })
    .select()
    .single()

  return { data, error }
}

export async function getNearbyDrivers(location, radius = 5) {
  const { data, error } = await supabase.rpc('find_nearby_drivers', {
    passenger_location: `POINT(${location.lng} ${location.lat})`,
    radius_km: radius
  })

  return { data, error }
}