<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../../../components/supabase';
  import type { User } from '@supabase/supabase-js';
	import Lock from '../../../components/lock.svelte';
  

  let vehiculosData: Vehiculo[] = [];

  // Definición de interfaces
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

  // Variables reactivas
  let user: User | null = null;
  let passenger: Passenger | null = null;
  let drivers: DriverStatus[] = [];
  let loading = true;
  let error: string | null = null;

  // Chat
  let mensajes: MensajeChat[] = [];
  let nuevoMensaje = '';
  let subscription: any = null;
  let sending = false;
  let chatError: string | null = null;
  let refreshInterval: NodeJS.Timeout;
  let lastMessageId = '';

  // Función para agregar mensajes sin duplicados
  function agregarMensaje(nuevoMensaje: MensajeChat) {
      const existe = mensajes.some(m => m.id === nuevoMensaje.id);
      if (!existe) {
          mensajes = [...mensajes, nuevoMensaje];
          lastMessageId = nuevoMensaje.id;
          setTimeout(scrollToBottom, 100);
      }
  }

  // Obtener información del pasajero
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
              .single();

          if (passengerError) {
              if (passengerError.code === 'PGRST116') {
                  throw new Error('Perfil no encontrado. Completa tu registro.');
              }
              throw passengerError;
          }
          passenger = passengerData;

          await Promise.all([loadActiveDrivers(), cargarMensajes()]);
          
      } catch (err) {
          error = err instanceof Error ? err.message : 'Error inesperado';
      } finally {
          loading = false;
      }
  }

  // Cargar mensajes del chat optimizado
  async function cargarMensajes(): Promise<void> {
      try {
          const query = supabase
              .from('mensajes_chat')
              .select('*')
              .order('created_at', { ascending: true });

          if (lastMessageId) {
              query.gt('id', lastMessageId);
          }

          const { data, error } = await query;

          if (error) throw error;
          
          if (data && data.length > 0) {
              // Filtramos y agregamos solo mensajes nuevos sin duplicados
              data.forEach(mensaje => agregarMensaje(mensaje));
          }
      } catch (err) {
          chatError = 'Error al cargar mensajes';
          console.error(err);
      }
  }

  // Actualización periódica cada 2 segundos
  function startPolling() {
      refreshInterval = setInterval(async () => {
          await cargarMensajes();
      }, 2000);
  }

  // Suscripción mejorada
  function configurarSubscripcion(): void {
      if (subscription) supabase.removeChannel(subscription);

      subscription = supabase
          .channel('mensajes-chat')
          .on(
              'postgres_changes',
              {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'mensajes_chat',
                  filter: `usuario_id=neq.${user?.id}`
              },
              (payload) => {
                  agregarMensaje(payload.new as MensajeChat);
              }
          )
          .subscribe();
  }

  // Desplazarse al final del chat
  function scrollToBottom() {
      const chatContainer = document.getElementById('chat-messages');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Enviar mensaje optimizado
  async function enviarMensaje(): Promise<void> {
      if (sending || !nuevoMensaje.trim() || !user || !passenger) return;
      sending = true;
      
      try {
          const { data, error } = await supabase.from('mensajes_chat').insert([
              {
                  usuario_id: user.id,
                  nombre_usuario: passenger.nombre,
                  mensaje: nuevoMensaje.trim(),
                  es_conductor: false
              }
          ]).select().single();

          if (error) throw error;
          
          if (data) {
              // Añadimos nuestro propio mensaje inmediatamente
              agregarMensaje(data);
              nuevoMensaje = '';
          }
      } catch (err) {
          chatError = 'Error al enviar el mensaje.';
          console.error(err);
      } finally {
          sending = false;
      }
  }

  // Conductores en servicio (sin cambios)
  async function loadActiveDrivers(): Promise<void> {
      try {
          const { data: estados, error: estadosError } = await supabase
              .from('estado_conductor')
              .select('id, conductor_id, estado')
              .eq('estado', 'En servicio');

          if (estadosError) throw estadosError;

          if (!estados || estados.length === 0) {
              drivers = [];
              return;
          }

          const conductorIds = estados.map((e) => e.conductor_id);
          const { data: conductores, error: conductoresError } = await supabase
              .from('conductor')
              .select('*')
              .in('id', conductorIds);

          if (conductoresError) throw conductoresError;

          const vehiculoIds = conductores?.map((c) => c.vehiculo_id).filter(Boolean) || [];
          if (vehiculoIds.length > 0) {
              const { data: vehiculos, error: vehiculosError } = await supabase
                  .from('vehiculo')
                  .select('*')
                  .in('id', vehiculoIds);

              if (vehiculosError) throw vehiculosError;
              vehiculosData = vehiculos || [];
          }

          drivers = estados.map((estado) => {
              const conductor = conductores?.find((c) => c.id === estado.conductor_id) || null;
              const vehiculo = conductor?.vehiculo_id ? vehiculosData?.find((v) => v.id === conductor.vehiculo_id) : null;

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
                  vehiculo: vehiculo || {
                      id: '',
                      marca: 'Marca no disponible',
                      modelo: '',
                      placa: 'Sin placa',
                      color: 'Color no especificado'
                  }
              } as DriverStatus;
          });
      } catch (err) {
          console.error('Error al cargar conductores en servicio:', err);
          drivers = [];
      }
  }

  function formatMessageTime(dateString: string): string {
      try {
          const date = new Date(dateString);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch (error) {
          console.error('Error formateando la hora:', error);
          return '--:--';
      }
  }

  function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          enviarMensaje();
      }
  }


  // Cerrar sesión
  async function logout(): Promise<void> {
      try {
          if (subscription) supabase.removeChannel(subscription);
          if (refreshInterval) clearInterval(refreshInterval);
          await supabase.auth.signOut();
          window.location.href = '/login';
      } catch (err) {
          console.error('Error al cerrar sesión:', err);
      }
  }

  onMount(() => {
      loadPassengerInfo().then(() => {
          configurarSubscripcion();
          startPolling();
      });

      return () => {
          if (subscription) supabase.removeChannel(subscription);
          if (refreshInterval) clearInterval(refreshInterval);
      };
  });
</script>

<div class="container-fluid">
  <main class="">
      <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
          <h1 class="h2">Rapiditos Colón</h1>
          <div class="btn-toolbar mb-2 mb-md-0">
              <div class="btn-group me-2">
                <div class="m-2">
                  <Lock />
                </div>
                
                  <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary m-2"
                      on:click={loadPassengerInfo}
                      disabled={loading}
                  >
                      {#if loading}
                          <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      {:else}
                          <i class="fas fa-sync-alt"></i>
                      {/if}
                      Actualizar
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
                              <p><strong>Email:</strong> {passenger.email}</p>
                              <p><strong>Usuario:</strong> {user?.email || 'No disponible'}</p>
                          {:else}
                              <div class="alert alert-warning">No se encontró información del pasajero</div>
                          {/if}
                      </div>
                  </div>
              </div>
              <div class="col-md-6">
                  <div class="card h-100">
                      <div
                          class="card-header bg-success text-white d-flex justify-content-between align-items-center"
                      >
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
                                      <div
                                          class="d-flex {mensaje.usuario_id === user?.id
                                              ? 'justify-content-end'
                                              : 'justify-content-start'}"
                                      >
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
                                              <small
                                                  class="d-block text-end {mensaje.usuario_id === user?.id
                                                      ? 'text-white-50'
                                                      : 'text-muted'}"
                                              >
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
                                      Completa tu <a href="/perfil" class="alert-link fw-bold">perfil</a> con tu nombre
                                      completo para poder chatear
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
                                          aria-label="Mensaje de chat"
                                      />
                                      <button
                                          class="btn btn-primary"
                                          type="submit"
                                          disabled={!nuevoMensaje.trim() || !passenger?.nombre || sending}
                                          aria-label="Enviar mensaje"
                                      >
                                          {#if sending}
                                              <span
                                                  class="spinner-border spinner-border-sm me-1"
                                                  role="status"
                                                  aria-hidden="true"
                                              ></span>
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
                                          <strong>{driver.conductor.marca}</strong><br />
                                          <small class="text-muted">{driver.conductor.placa}</small>
                                      </td>
                                      <td>{driver.conductor.control}</td>
                                      <td>
                                          <span
                                              class="badge {driver.estado === 'En servicio'
                                                  ? 'bg-success'
                                                  : 'bg-secondary'}"
                                          >
                                              {driver.estado}
                                          </span>
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
