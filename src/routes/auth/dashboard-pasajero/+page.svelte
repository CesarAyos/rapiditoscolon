<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../../../components/supabase';
  import type { User } from '@supabase/supabase-js';

  // Interfaces actualizadas según tu esquema
  interface Passenger {
    id: string;
    user_id: string;
    nombre_completo: string;
    telefono: string;
    documento_identidad: string;
    created_at: string;
  }

  interface Route {
    nombre: string;
    origen: string;
    destino: string;
  }

  interface Ticket {
    id: string;
    pasajero_id: string;
    ruta: Route;
    fecha_compra: string;
    activo: boolean;
    numero_asiento: string | null;
  }

  interface Conductor {
    id: string;
    nombre: string;
    placa: string;
    control: string;
    marca: string;
    telefono: string;
  }

  interface Vehiculo {
    id: string;
    marca: string;
    modelo: string;
    placa: string;
    color: string;
  }

  interface DriverStatus {
    id: string;
    estado: string;
    conductor_id: string;
    vehiculo: Vehiculo;
    conductor: Conductor;
  }

  // Datos reactivos
  let user: User | null = null;
  let passenger: Passenger | null = null;
  let ticket: Ticket | null = null;
  let drivers: DriverStatus[] = [];
  let loading = true;
  let error: string | null = null;

  // Cargar información del pasajero
  async function loadPassengerInfo(): Promise<void> {
    try {
      loading = true;
      error = null;

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        window.location.href = '/login';
        return;
      }

      user = authUser;

      const { data: passengerData, error: passengerError } = await supabase
        .from('pasajero')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (passengerError) throw passengerError;
      passenger = passengerData;

      if (passenger) {
        await loadTicketInfo(passenger.id);
        await loadActiveDrivers();
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar los datos';
      console.error('Error loading passenger info:', err);
    } finally {
      loading = false;
    }
  }

  // Cargar información del ticket
  async function loadTicketInfo(passengerId: string): Promise<void> {
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('pasajes')
        .select('*, ruta:rutas(nombre, origen, destino)')
        .eq('pasajero_id', passengerId)
        .single();

      if (ticketError) throw ticketError;
      ticket = ticketData as unknown as Ticket;
    } catch (err) {
      console.error('Error loading ticket info:', err);
      ticket = null;
    }
  }

  // Cargar conductores activos - Versión simplificada para tu esquema
  // Cargar conductores activos - Versión corregida
  async function loadActiveDrivers(): Promise<void> {
    try {
      // Obtenemos los conductores con estado "En servicio"
      const { data: estados, error: estadosError } = await supabase
        .from('estado_conductor')
        .select('id, conductor_id, estado')
        .eq('estado', 'En servicio');

      if (estadosError || !estados || estados.length === 0) {
        drivers = [];
        return;
      }

      // Obtenemos los IDs de los conductores activos
      const conductorIds = estados.map(e => e.conductor_id);

      // Obtenemos la información de conductores
      const { data: conductoresData, error: conductoresError } = await supabase
        .from('conductor')
        .select('*')
        .in('id', conductorIds);

      if (conductoresError) throw conductoresError;

      // Obtenemos los IDs de los vehículos de estos conductores
      const vehiculoIds = conductoresData?.map(c => c.vehiculo_id).filter(Boolean) || [];

      // Obtenemos la información de vehículos por separado
      let vehiculosData = [];
      if (vehiculoIds.length > 0) {
        const { data: vehiculos, error: vehiculosError } = await supabase
          .from('vehiculo')
          .select('*')
          .in('id', vehiculoIds);
        
        if (vehiculosError) throw vehiculosError;
        vehiculosData = vehiculos || [];
      }

      // Combinamos los datos
      drivers = estados.map(estado => {
        const conductor = conductoresData?.find(c => c.id === estado.conductor_id);
        const vehiculo = vehiculosData?.find(v => v.id === conductor?.vehiculo_id);

        return {
          id: estado.id,
          estado: estado.estado,
          conductor_id: estado.conductor_id,
          conductor: {
            id: conductor?.id || '',
            nombre: conductor?.nombre || 'Nombre no disponible',
            placa: conductor?.placa || 'Sin placa',
            control: conductor?.control || 'No especificado',
            marca: conductor?.marca || 'Marca no disponible',
            telefono: conductor?.telefono || 'Sin teléfono'
          },
          vehiculo: {
            id: vehiculo?.id || '',
            marca: vehiculo?.marca || 'Marca no disponible',
            modelo: vehiculo?.modelo || '',
            placa: vehiculo?.placa || 'Sin placa',
            color: vehiculo?.color || 'Color no especificado'
          }
        } as DriverStatus;
      });

    } catch (err) {
      console.error('Error loading active drivers:', err);
      drivers = [];
      error = 'Error al cargar conductores en servicio';
    }
  }

  // Solicitar un viaje
  function requestRide(driverId: string): void {
    alert(`Solicitud de viaje enviada al conductor con ID: ${driverId}`);
  }

  // Cerrar sesión
  async function logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  }

  onMount(() => {
    loadPassengerInfo();
  });
</script>
<h6 class="text-white">{user?.email || 'Cargando...'}</h6>

<div class="container-fluid">
	<!-- Contenido principal -->
	<main class="">
		<div
			class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom"
		>
			<h1 class="h2">Panel de Pasajero</h1>
			<div class="btn-toolbar mb-2 mb-md-0">
				<div class="btn-group me-2">
					<button
						type="button"
						class="btn btn-sm btn-outline-secondary"
						on:click={loadPassengerInfo}
					>
						<i class="fas fa-sync-alt"></i> Actualizar
					</button>
				</div>
			</div>
		</div>

		{#if error}
			<div class="alert alert-danger">{error}</div>
		{:else if loading}
			<div class="text-center my-5">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">Cargando...</span>
				</div>
				<p class="mt-2">Cargando información...</p>
			</div>
		{:else}
			<!-- Información del pasajero -->
			<div class="row mb-4">
				<div class="col-md-6">
					<div class="card h-100">
						<div class="card-header bg-primary text-white">
							<i class="fas fa-user me-2"></i>Mi Información
						</div>
						<div class="card-body">
							{#if passenger}
								<p><strong>Nombre:</strong> {passenger.nombre_completo}</p>
								<p><strong>Teléfono:</strong> {passenger.telefono}</p>
								<p><strong>Email:</strong> {user?.email || 'No disponible'}</p>
								<p><strong>Documento:</strong> {passenger.documento_identidad}</p>
							{:else}
								<div class="alert alert-warning">No se encontró información del pasajero</div>
							{/if}
						</div>
					</div>
				</div>
				<div class="col-md-6">
					<div class="card h-100">
						<div class="card-header bg-success text-white">
							<i class="fas fa-ticket-alt me-2"></i>Mi Pasaje
						</div>
						<div class="card-body">
							{#if ticket}
								<p>
									<strong>Ruta:</strong>
									{ticket.ruta.nombre} ({ticket.ruta.origen} → {ticket.ruta.destino})
								</p>
								<p>
									<strong>Fecha de compra:</strong>
									{new Date(ticket.fecha_compra).toLocaleDateString()}
								</p>
								<p>
									<strong>Estado:</strong>
									<span class="badge {ticket.activo ? 'bg-success' : 'bg-secondary'}">
										{ticket.activo ? 'Activo' : 'Inactivo'}
									</span>
								</p>
								<p><strong>Asiento:</strong> {ticket.numero_asiento || 'No asignado'}</p>
							{:else}
								<div class="alert alert-info">No tienes pasajes comprados</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Conductores en servicio -->
      <div class="card mb-4">
        <div class="card-header bg-warning text-dark">
          <i class="fas fa-car me-2"></i>Vehículos en Servicio
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Vehículo</th>
                  <th>Control</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {#each drivers as driver}
                  <tr>
                    <td>
                      <div class="d-flex align-items-center">
                        <div>
                          <div>{driver.conductor.nombre}</div>
                          <small class="text-muted">{driver.conductor.telefono}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{driver.vehiculo.marca}</strong><br>
                      <small class="text-muted">{driver.vehiculo.placa}</small>
                    </td>
                    <td>{driver.conductor.control}</td>
                    <td>
                      <span class="badge {driver.estado === 'En servicio' ? 'bg-success' : 'bg-secondary'}">
                        {driver.estado}
                      </span>
                    </td>
                    <td>
                      <button 
                        class="btn btn-sm btn-primary" 
                        on:click={() => requestRide(driver.id)}
                      >
                        <i class="fas fa-car-side me-1"></i> Solicitar
                      </button>
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td colspan="5" class="text-center py-4">
                      <i class="fas fa-car-slash fa-2x text-muted mb-2"></i>
                      <p>No hay vehículos en servicio actualmente</p>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
		{/if}
	</main>
</div>

<!-- El resto del template sigue igual -->

<style>
	.card {
		transition: transform 0.3s;
	}
	.card:hover {
		transform: translateY(-5px);
	}

</style>
