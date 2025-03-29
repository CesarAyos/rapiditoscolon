<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../../../components/supabase';
  import type { User } from '@supabase/supabase-js';

  interface Passenger {
    id: string;
    user_id: string;
    nombre: string;
    email: string;
    telefono: string;
    created_at: string;
  }

  interface Conductor {
    id: string;
    nombre: string;
    placa: string;
    control: string;
    marca: string;
    telefono: string;
    vehiculo_id: string | null;
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

  interface MensajeChat {
    id: string;
    usuario_id: string;
    nombre_usuario: string;
    mensaje: string;
    created_at: string;
    es_conductor: boolean;
  }

  // Datos reactivos
  let user: User | null = null;
  let passenger: Passenger | null = null;
  let drivers: DriverStatus[] = [];
  let loading = true;
  let error: string | null = null;
  
  // Datos del chat
  let mensajes: MensajeChat[] = [];
  let nuevoMensaje = '';
  let subscription: any = null;
  let sending = false;
  let chatError: string | null = null;

  async function loadPassengerInfo(): Promise<void> {
    try {
      loading = true;
      error = null;

      // 1. Obtener usuario autenticado
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        window.location.href = '/login';
        return;
      }

      user = authUser;
      console.log('Usuario autenticado:', user.id, user.email);

      // 2. Obtener información del pasajero - SOLO CARGA PERFIL EXISTENTE
      const { data: passengerData, error: passengerError } = await supabase
        .from('pasajero')
        .select(`
          id,
          user_id,
          nombre,
          email,
          telefono,
          created_at
        `)
        .eq('user_id', user.id)
        .single(); // Usamos single() porque EXIGIMOS que exista

      console.log('Resultado de consulta pasajero:', passengerData);

      if (passengerError) {
        console.error('Error en consulta:', passengerError);
        
        // Error específico cuando no se encuentra el perfil
        if (passengerError.code === 'PGRST116') {
          throw new Error('No se encontró tu perfil de pasajero. Por favor completa tu registro primero.');
        }
        
        throw new Error('Error al consultar la base de datos');
      }

      // Asignamos el perfil encontrado
      passenger = passengerData;

      // 3. Cargar datos adicionales solo si tenemos perfil
      await Promise.all([
        loadActiveDrivers(),
        cargarMensajes()
      ]);
      
      configurarSubscripcion();

    } catch (err) {
      console.error('Error completo:', err);
      error = err instanceof Error ? err.message : 'Error inesperado';
    } finally {
      loading = false;
    }
  }

  // Cargar mensajes del chat
  async function cargarMensajes(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('mensajes_chat')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      mensajes = data || [];
      
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
      chatError = 'Error al cargar mensajes';
    }
  }

  // Configurar subscripción a nuevos mensajes
  function configurarSubscripcion(): void {
    if (subscription) {
      supabase.removeChannel(subscription);
    }

    subscription = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes_chat' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            mensajes = [...mensajes, payload.new as MensajeChat];
            setTimeout(scrollToBottom, 100);
          }
        }
      )
      .subscribe();
  }

  // Función para hacer scroll al final del chat
  function scrollToBottom() {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Enviar nuevo mensaje
  async function enviarMensaje(): Promise<void> {
    if (sending) return;
    if (!nuevoMensaje.trim()) {
      chatError = 'El mensaje no puede estar vacío';
      return;
    }
    if (!user) {
      chatError = 'No has iniciado sesión';
      return;
    }
    if (!passenger) {
      chatError = 'Información de pasajero no encontrada';
      return;
    }
    if (!passenger.nombre) {
      chatError = 'Por favor completa tu perfil con tu nombre completo antes de chatear';
      return;
    }

    sending = true;
    chatError = null;

    try {
      const { error } = await supabase
        .from('mensajes_chat')
        .insert([
          {
            usuario_id: user.id,
            nombre_usuario: passenger.nombre,
            mensaje: nuevoMensaje.trim(),
            es_conductor: false
          }
        ]);

      if (error) throw error;
      
      nuevoMensaje = '';
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      chatError = 'Error al enviar el mensaje. Intenta nuevamente.';
    } finally {
      sending = false;
    }
  }

  // Función para manejar la tecla Enter
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  }

  // Cargar conductores activos
  async function loadActiveDrivers(): Promise<void> {
    try {
      const { data: estados, error: estadosError } = await supabase
        .from('estado_conductor')
        .select('id, conductor_id, estado')
        .eq('estado', 'En servicio');

      if (estadosError || !estados || estados.length === 0) {
        drivers = [];
        return;
      }

      const conductorIds = estados.map(e => e.conductor_id);

      const { data: conductoresData, error: conductoresError } = await supabase
        .from('conductor')
        .select('*')
        .in('id', conductorIds);

      if (conductoresError) throw conductoresError;

      const vehiculoIds = conductoresData?.map(c => c.vehiculo_id).filter(Boolean) || [];

      let vehiculosData = [];
      if (vehiculoIds.length > 0) {
        const { data: vehiculos, error: vehiculosError } = await supabase
          .from('vehiculo')
          .select('*')
          .in('id', vehiculoIds);
        
        if (vehiculosError) throw vehiculosError;
        vehiculosData = vehiculos || [];
      }

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
            telefono: conductor?.telefono || 'Sin teléfono',
            vehiculo_id: conductor?.vehiculo_id || null
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
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/login';
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  }

  onMount(() => {
    loadPassengerInfo();
    
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  });

  // Función para formatear la hora del mensaje
  function formatMessageTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return '--:--';
    }
  }
</script>

<!-- Mantenemos la misma estructura HTML que tenías originalmente -->
<div class="container-fluid">
	<main class="">
		<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
			<h1 class="h2">Panel de Pasajero</h1>
			<div class="btn-toolbar mb-2 mb-md-0">
				<div class="btn-group me-2">
					<button type="button" class="btn btn-sm btn-outline-secondary" on:click={loadPassengerInfo}>
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
			<!-- Información del pasajero y Chat -->
			<div class="row mb-4">
				<div class="col-md-6">
					<div class="card h-100">
						<div class="card-header bg-primary text-white">
							<i class="fas fa-user me-2"></i>Mi Información
						</div>
						<div class="card-body">
							{#if passenger}
								<p><strong>Nombre:</strong> {passenger.nombre}</p>
								<p><strong>Teléfono:</strong> {passenger.telefono}</p>
								<p><strong>Teléfono:</strong> {passenger.email}</p>
								<p><strong>Email:</strong> {user?.email || 'No disponible'}</p>
							{:else}
								<div class="alert alert-warning">No se encontró información del pasajero</div>
							{/if}
						</div>
					</div>
				</div>
				<div class="col-md-6">
          <div class="card h-100">
            <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
              <span><i class="fas fa-comments me-2"></i>Chat en Vivo</span>
              {#if sending}
                <div class="spinner-border spinner-border-sm text-light" role="status">
                  <span class="visually-hidden">Enviando...</span>
                </div>
              {/if}
            </div>
            <div class="card-body d-flex flex-column p-0">
              <!-- Área de mensajes -->
              <div 
                id="chat-messages" 
                class="flex-grow-1 p-3" 
                style="height: 250px; overflow-y: auto;"
              >
                {#each mensajes as mensaje (mensaje.id)}
                  <div class="mb-2">
                    <div class="d-flex {mensaje.usuario_id === user?.id ? 'justify-content-end' : 'justify-content-start'}">
                      <div 
                        class="
                          {mensaje.usuario_id === user?.id 
                            ? 'bg-primary text-white' 
                            : 'bg-light text-dark'} 
                          p-2 rounded" 
                        style="max-width: 80%; word-break: break-word;"
                      >
                      <small class="d-block fw-bold">
                        {mensaje.nombre_usuario || 'Usuario desconocido'}
                        {#if mensaje.es_conductor}
                          <span class="badge bg-warning ms-1">Conductor</span>
                        {/if}
                      </small>
                        <div>{mensaje.mensaje}</div>
                        <small class="d-block text-end {mensaje.usuario_id === user?.id ? 'text-white-50' : 'text-muted'}">
                          {formatMessageTime(mensaje.created_at)}
                        </small>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="text-center text-muted mt-5">
                    <i class="fas fa-comment-slash fa-2x"></i>
                    <p class="mt-2">No hay mensajes aún</p>
                  </div>
                {/each}
              </div>
              
              <!-- Área de entrada de mensajes -->
              <div class="border-top p-3">
                {#if chatError}
                  <div class="alert alert-danger py-2 mb-2 small">
                    <i class="fas fa-exclamation-circle me-1"></i>
                    {chatError}
                  </div>
                {/if}
                
                {#if passenger && !passenger.nombre}
                  <div class="alert alert-warning py-2 mb-2 small">
                    <i class="fas fa-exclamation-circle me-1"></i>
                    Completa tu <a href="/perfil" class="alert-link fw-bold">perfil</a> con tu nombre completo para poder chatear
                  </div>
                {:else}
                  <form class="input-group" on:submit|preventDefault={enviarMensaje}>
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Escribe tu mensaje..."
                      bind:value={nuevoMensaje}
                      disabled={!passenger?.nombre || sending}
                      on:keydown={handleKeyPress}
                    />
                    <button 
                      class="btn btn-primary" 
                      type="submit"
                      disabled={!nuevoMensaje.trim() || !passenger?.nombre || sending}
                    >
                      {#if sending}
                        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Enviando...
                      {:else}
                        <i class="fas fa-paper-plane me-1"></i>
                        Enviar
                      {/if}
                    </button>
                  </form>
                {/if}
              </div>
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