<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../components/supabase';
	import Lock from '../../../components/lock.svelte';

	// Tipos
	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type EstadoConductor = {
		id: number;
		conductor_id: number;
		estado: string;
		descripcion?: string | null;
	};

	type PosicionConductor = {
		id: number;
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy?: number;
		estado: string;
		timestamp: string;
	};

	// Stores
	const conductor = writable<Conductor | null>(null);
	const estadoActual = writable<string>('Descanso');
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<any>(null);
	const trackingActive = writable<boolean>(false);
	const positionHistory = writable<PosicionConductor[]>([]);
	const otherDrivers = writable<Conductor[]>([]);

	// Variables reactivas
	let conductorData: Conductor | null = null;
	let currentEstado: string = 'Descanso';
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: any = null;
	let map: any = null;
	let userMarker: any = null;
	let otherMarkers: Record<number, any> = {};
	let mapContainer: HTMLDivElement;
	let watchId: number | null = null;
	let isTracking = false;
	let drivers: Conductor[] = [];
	let history: PosicionConductor[] = [];
	let L: any = null;

	// Suscripciones
	conductor.subscribe((value) => (conductorData = value));
	estadoActual.subscribe((value) => (currentEstado = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));
	trackingActive.subscribe((value) => (isTracking = value));
	positionHistory.subscribe((value) => (history = value));
	otherDrivers.subscribe((value) => (drivers = value));

	// Inicializar mapa
	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			// Carga dinámica de Leaflet
			const leaflet = await import('leaflet');
			L = leaflet.default;
			await import('leaflet/dist/leaflet.css');

			// Crear mapa si no existe
			if (!map) {
				map = L.map(mapContainer).setView([7.8939, -72.5078], 13);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				}).addTo(map);

				// Forzar redimensionamiento
				setTimeout(() => map.invalidateSize(), 100);
			}
			return true;
		} catch (err) {
			console.error('Error al inicializar mapa:', err);
			error.set('Error al cargar el mapa');
			return false;
		}
	};

	// Actualizar posición en el mapa
	const updatePosition = (lat: number, lng: number, accuracy?: number) => {
		if (!map || !conductorData || !L) return;

		if (!userMarker) {
			userMarker = L.marker([lat, lng], {
				icon: L.icon({
					iconUrl: 'https://cdn-icons-png.flaticon.com/512/4474/4474228.png',
					iconSize: [32, 32],
					iconAnchor: [16, 32]
				}),
				zIndexOffset: 1000
			})
				.addTo(map)
				.bindPopup(`<b>${conductorData.nombre}</b><br>Placa: ${conductorData.placa}`);
		} else {
			userMarker.setLatLng([lat, lng]);
		}

		map.setView([lat, lng], 15);

		if (accuracy) {
			L.circle([lat, lng], {
				radius: accuracy,
				fillOpacity: 0.2,
				color: '#3388ff',
				fillColor: '#3388ff'
			}).addTo(map);
		}

		// Guarda posición independientemente del estado
		savePosition(lat, lng, accuracy);
	};

	// Guardar posición en Supabase
	const savePosition = async (lat: number, lng: number, accuracy?: number) => {
		try {
			const { error } = await supabase.from('conductor_posiciones').insert({
				conductor_id: conductorData!.id,
				lat,
				lng,
				accuracy,
				estado: currentEstado
			});

			if (error) throw error;
		} catch (err) {
			console.error('Error guardando posición:', err);
		}
	};

	// Obtener posición actual del dispositivo
	const getCurrentPosition = () => {
		if (!browser) return;

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					updatePosition(
						position.coords.latitude,
						position.coords.longitude,
						position.coords.accuracy
					);
				},
				(err) => {
					error.set('Error obteniendo ubicación: ' + err.message);
				},
				{ enableHighAccuracy: true, timeout: 10000 }
			);
		} else {
			error.set('Geolocalización no soportada por este navegador');
		}
	};

	// Iniciar seguimiento continuo
	const startTracking = () => {
		if (!browser) return;

		if (navigator.geolocation) {
			watchId = navigator.geolocation.watchPosition(
				(position) => {
					updatePosition(
						position.coords.latitude,
						position.coords.longitude,
						position.coords.accuracy
					);
				},
				(err) => {
					error.set('Error en seguimiento: ' + err.message);
				},
				{ enableHighAccuracy: true, maximumAge: 10000 }
			);
			trackingActive.set(true);
		} else {
			error.set('Geolocalización no soportada por este navegador');
		}
	};

	// Detener seguimiento
	const stopTracking = () => {
		if (!browser) return;

		if (watchId !== null) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		trackingActive.set(false);
	};

	// Solicitar permisos de ubicación
	const requestLocationPermission = async (): Promise<boolean> => {
		if (!browser) return false;

		try {
			if ('permissions' in navigator) {
				const permission = await navigator.permissions.query({ name: 'geolocation' });
				if (permission.state === 'granted') {
					startTracking();
					return true;
				}
				if (permission.state === 'prompt') {
					return new Promise((resolve) => {
						navigator.geolocation.getCurrentPosition(
							() => {
								startTracking();
								resolve(true);
							},
							(err) => {
								error.set(`Permiso denegado: ${err.message}`);
								resolve(false);
							}
						);
					});
				}
			} else {
				// Navegadores más antiguos
				getCurrentPosition();
				return true;
			}
		} catch (err) {
			console.error('Error en permisos:', err);
			error.set('Error al solicitar permisos de ubicación');
			return false;
		}
		return false;
	};

	// Obtener otros conductores en servicio
	const getOtherDrivers = async () => {
		if (!browser || !L) return;

		try {
			const { data, error: sbError } = await supabase
				.from('conductor_posiciones')
				.select(
					`
			conductor_id,
			lat,
			lng,
			estado,
			conductor:conductor_id(id, nombre, placa, control, propiedad)
		  `
				)
				.order('timestamp', { ascending: false })
				.limit(50);

			if (sbError) throw sbError;

			const uniqueDrivers = data.reduce((acc: any[], current) => {
				if (!acc.some((item) => item.conductor_id === current.conductor_id)) {
					acc.push(current);
				}
				return acc;
			}, []);

			const activeDrivers = uniqueDrivers.filter(
				(d) => d.estado === 'En servicio' && d.conductor_id !== conductorData?.id
			);

			Object.keys(otherMarkers).forEach((id) => {
				if (!activeDrivers.some((d) => d.conductor_id === parseInt(id))) {
					map.removeLayer(otherMarkers[parseInt(id)]);
					delete otherMarkers[parseInt(id)];
				}
			});

			activeDrivers.forEach((driver) => {
				if (!otherMarkers[driver.conductor_id]) {
					otherMarkers[driver.conductor_id] = L.marker([driver.lat, driver.lng], {
						icon: L.icon({
							iconUrl: 'https://cdn-icons-png.flaticon.com/512/477/477103.png',
							iconSize: [32, 32],
							iconAnchor: [16, 32]
						}),
						title: driver.conductor.nombre
					})
						.addTo(map)
						.bindPopup(
							`<b>${driver.conductor.nombre}</b><br>Placa: ${driver.conductor.placa}<br>Control: ${driver.conductor.control}`
						);
				} else {
					otherMarkers[driver.conductor_id].setLatLng([driver.lat, driver.lng]);
				}
			});

			otherDrivers.set(activeDrivers.map((d) => d.conductor));
		} catch (err) {
			console.error('Error obteniendo otros conductores:', err);
		}
	};

	// Obtener sesión activa
	const getSession = async () => {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.error('Error obteniendo sesión:', error);
			return null;
		}
		session.set(data.session);
		return data.session;
	};

	// Obtener conductor basado en el email del usuario autenticado
	const obtenerConductor = async () => {
		isLoading.set(true);
		error.set('');
		try {
			const session = await getSession();
			if (!session?.user?.email) {
				throw new Error('No hay usuario autenticado');
			}

			const { data, error: sbError } = await supabase
				.from('conductor')
				.select('*')
				.eq('email', session.user.email)
				.single();

			if (sbError) throw sbError;
			if (!data) {
				throw new Error(`No se encontró conductor con email: ${session.user.email}`);
			}

			conductor.set(data);
			await obtenerUltimoEstado(data.id);
		} catch (err) {
			console.error('Error en obtenerConductor:', err);
			error.set(err instanceof Error ? err.message : 'Error desconocido');
			conductor.set(null);
		} finally {
			isLoading.set(false);
		}
	};

	// Obtener último estado
	const obtenerUltimoEstado = async (conductorId: number) => {
  try {
    const { data, error: sbError } = await supabase
      .from('estado_conductor')
      .select('estado, descripcion')
      .eq('conductor_id', conductorId)
      .maybeSingle(); // Usar maybeSingle para evitar errores si no hay registro

    if (sbError) throw sbError;
    
    if (data) {
      estadoActual.set(data.estado);
      return data.estado;
    }
    
    // Si no hay registro, establecer estado por defecto
    estadoActual.set('Descanso');
    return 'Descanso';
    
  } catch (err) {
    console.error('Error obteniendo estado:', err);
    error.set('Error al cargar estado actual');
    return 'Descanso'; // Estado por defecto en caso de error
  }
};

	// Cambiar estado
	const cambiarEstado = async (nuevoEstado: string, descripcion: string = '') => {
  if (!conductorData) {
    error.set('No hay datos del conductor');
    return;
  }

  isLoading.set(true);
  error.set('');

  try {
    // Usar upsert con la nueva constraint única
    const { error: dbError } = await supabase
      .from('estado_conductor')
      .upsert({
        conductor_id: conductorData.id,
        estado: nuevoEstado,
        descripcion: descripcion || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conductor_id' // Esto ahora funcionará con la nueva constraint
      });

    if (dbError) throw dbError;

    // Actualizar estado local
    estadoActual.set(nuevoEstado);
    error.set(`✅ Estado actualizado: ${nuevoEstado}`);
    setTimeout(() => error.set(''), 3000);

  } catch (err: unknown) {
    let errorMessage = 'Error al actualizar estado';
    
    if (typeof err === 'object' && err !== null) {
      const errorObj = err as Record<string, unknown>;
      
      if (errorObj.code === '23505') {
        errorMessage = 'Error: Solo puede haber un estado activo por conductor';
      } else if (typeof errorObj.message === 'string') {
        errorMessage = errorObj.message;
      }
    }

    console.error('Error al cambiar estado:', err);
    error.set(errorMessage);
    setTimeout(() => error.set(''), 5000);
  } finally {
    isLoading.set(false);
  }
};

	// Inicialización
	onMount(() => {
  // Función autoinvocada async para manejar la lógica asíncrona
  (async () => {
    try {
      await getSession();
      await obtenerConductor();
      initMap();
    } catch (error) {
      console.error('Error durante la inicialización:', error);
    }
  })();

  // Variables para almacenar las suscripciones
  let authSubscription: { unsubscribe: () => void } | null = null;
  let realtimeSubscription: { unsubscribe: () => void } | null = null;

  // Configurar suscripciones
  const setupSubscriptions = () => {
    try {
      // Autenticación
      const authData = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          obtenerConductor();
        } else if (event === 'SIGNED_OUT') {
          conductor.set(null);
          estadoActual.set('Descanso');
          stopTracking();
        }
      });
      authSubscription = authData.data?.subscription || null;

      // Realtime
      const channel = supabase.channel('public:conductor_posiciones').on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conductor_posiciones',
        },
        (payload) => {
          if (payload.new.conductor_id !== conductorData?.id) {
            getOtherDrivers();
          }
        }
      );
      realtimeSubscription = channel.subscribe();
    } catch (error) {
      console.error('Error configurando suscripciones:', error);
    }
  };

  setupSubscriptions();

  // Intervalo para actualizar datos de conductores
  const interval = setInterval(() => {
    try {
      getOtherDrivers();
    } catch (error) {
      console.error('Error en la actualización del intervalo:', error);
    }
  }, 30000);

  // Llamada inicial para obtener otros conductores
  try {
    getOtherDrivers();
  } catch (error) {
    console.error('Error obteniendo otros conductores:', error);
  }

  // Función de limpieza
  return () => {
    clearInterval(interval);
    try {
      authSubscription?.unsubscribe();
      realtimeSubscription?.unsubscribe();
      stopTracking();
    } catch (error) {
      console.error('Error durante la limpieza:', error);
    }
  };
});


	// Limpieza
	onDestroy(() => {
		if (!browser) return;
		stopTracking();
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
		integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
		crossorigin=""
	/>
</svelte:head>

<div class="dashboard-container">
	<!-- Navbar fijo en la parte superior -->
	<nav class="dashboard-nav">
		<div class="nav-user">
			{#if conductorData}
				<div class="badge-container">
					<span class="user-badge text-uppercase">Control: {conductorData.control}</span>
					<span class="user-badge text-uppercase"
						>{conductorData.propiedad}: {conductorData.nombre}</span
					>
					<span class="user-badge text-uppercase">Placa: {conductorData.placa}</span>
					<a
						href="/auth/dashboard-conductor/maps"
						class="user-badge text-uppercase text-white text-decoration-none">Mapa</a
					>
					<Lock />
				</div>
			{:else}
				<span class="user-name">No autenticado</span>
			{/if}
		</div>
	</nav>

	<!-- Contenido principal con scroll -->
	<main class="dashboard-content">
		<div class="content-wrapper">
			{#if loading}
				<div class="loading-overlay">
					<div class="spinner"></div>
					<p>Cargando datos...</p>
				</div>
			{:else if conductorData}
				<!-- Panel de información -->
				<div class="info-panel">
					<div class="info-header">
						<h2>Estado Actual</h2>
						<div class="status-badge {currentEstado.toLowerCase().replace(' ', '-')}">
							{currentEstado}
						</div>
					</div>
					<div class="info-grid">
						<div class="info-item">
							<span class="info-label">Nombre:</span>
							<span>{conductorData.nombre}</span>
						</div>
						<div class="info-item">
							<span class="info-label">Placa:</span>
							<span>{conductorData.placa}</span>
						</div>
						<div class="info-item">
							<span class="info-label">Teléfono:</span>
							<span>{conductorData.telefono || 'N/A'}</span>
						</div>
					</div>
				</div>

				<!-- Mapa - Versión corregida -->
				<div class="map-controls">
					<button
						on:click={async () => {
							if (!map) await initMap();
							requestLocationPermission();
							getCurrentPosition();
						}}
						class="map-btn {isTracking ? 'active' : ''}"
						disabled={!browser}
					>
						{isTracking ? '📍 Siguiendo ubicación' : '📍 Activar GPS'}
					</button>
					<button
						on:click={async () => {
							if (!map) await initMap();
							getCurrentPosition();
						}}
						class="map-btn"
						disabled={!browser}
					>
						🔄 Actualizar ubicación
					</button>
				</div>

				<!-- Template con bind seguro -->
				<div bind:this={mapContainer} class="map-view">
					{#if !map}
						<div class="map-loading">
							<div class="spinner small"></div>
							<p>Inicializando mapa...</p>
						</div>
					{/if}
				</div>

				<!-- Panel de acciones -->
				<div class="actions-panel">
					<h3>Cambiar Estado</h3>
					<div class="actions-grid">
						<button on:click={() => cambiarEstado('En servicio')} class="action-btn service">
							<span class="icon">🚕</span>
							<span class="label">En Servicio</span>
						</button>

						<button on:click={() => cambiarEstado('Descanso')} class="action-btn rest">
							<span class="icon">🛌</span>
							<span class="label">Descanso</span>
						</button>

						<button
							on:click={() => cambiarEstado('En ruta', 'Ruta: Colón → Ureña')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Colón → Ureña</span>
						</button>

						<button
							on:click={() => cambiarEstado('En ruta', 'Ruta: Ureña → Colón')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Ureña → Colón</span>
						</button>

						<button on:click={() => cambiarEstado('Accidentado')} class="action-btn accident">
							<span class="icon">⚠️</span>
							<span class="label">Accidentado</span>
						</button>
					</div>
				</div>

				<!-- Otros conductores en servicio -->
				{#if drivers.length > 0}
					<div class="drivers-panel">
						<h3>Conductores en Servicio ({drivers.length})</h3>
						<div class="drivers-list">
							{#each drivers as driver}
								<div class="driver-item">
									<span class="driver-name">{driver.nombre}</span>
									<span class="driver-placa">{driver.placa}</span>
									<span class="driver-control">{driver.control}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<div class="empty-state">
					<h2>No se encontraron datos del conductor</h2>
					<p>Por favor, verifica tu conexión o contacta al administrador.</p>
				</div>
			{/if}

			<!-- Notificación flotante -->
			{#if errorMessage}
				<div class="notification {errorMessage.includes('actualizado') ? 'success' : 'error'}">
					{errorMessage}
					<button class="close-btn" on:click={() => error.set('')}>×</button>
				</div>
			{/if}
		</div>
	</main>
</div>

<style>
	/* Estilos base */
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
		color: #333;
		height: 100vh;
		overflow: hidden;
		background-color: #f5f7fa;
	}

	/* Añade esto al final de tus estilos */
	:global(.leaflet-container) {
		background-color: #f8f9fa !important;
		transition: opacity 0.3s ease;
	}

	:global(.leaflet-container.leaflet-fade-anim) {
		animation-duration: 0.3s !important;
	}

	.map-view-loading {
		opacity: 0.9;
	}

	.dashboard-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	/* Navbar fijo */
	.dashboard-nav {
		padding: 0.75rem 1.5rem;
		background-color: #2c3e50;
		color: white;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		position: sticky;
		top: 0;
		z-index: 1000;
	}

	/* Contenido principal con scroll */
	.dashboard-content {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 1rem;
		background-color: #f5f7fa;
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	/* Paneles */
	.info-panel,
	.actions-panel,
	.map-panel,
	.drivers-panel {
		background: white;
		border-radius: 10px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
		border: 1px solid #eaeaea;
	}

	.info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 1rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.info-item {
		padding: 0.5rem 0;
	}

	.info-label {
		font-weight: 600;
		color: #666;
		display: inline-block;
		min-width: 80px;
	}

	/* Mapa - Estilos corregidos */
	.map-view {
		width: 100%;
		height: 400px;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		margin-top: 1rem;
		position: relative;
		background-color: #f8f9fa;
		border: 1px solid #ddd;
	}

	.map-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 8px;
		font-weight: 500;
		color: #666;
		z-index: 100;
	}

	.map-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.map-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		background-color: #e3f2fd;
		color: #1976d2;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.map-btn:hover:not(:disabled) {
		background-color: #bbdefb;
	}

	.map-btn.active {
		background-color: #1976d2;
		color: white;
	}

	.map-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background-color: #e9ecef;
		color: #6c757d;
	}

	/* Estado */
	.status-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-badge.en-servicio {
		background-color: #e3f9e5;
		color: #28a745;
	}
	.status-badge.descanso {
		background-color: #fff8e1;
		color: #ffc107;
	}
	.status-badge.en-ruta {
		background-color: #e3f2fd;
		color: #1976d2;
	}
	.status-badge.accidentado {
		background-color: #ffebee;
		color: #dc3545;
	}

	/* Acciones */
	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		border: none;
		border-radius: 8px;
		background-color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}

	.action-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
	}

	.action-btn .icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.action-btn .label {
		font-weight: 500;
		text-align: center;
	}

	.action-btn.service {
		border: 2px solid #28a745;
		color: #28a745;
	}
	.action-btn.rest {
		border: 2px solid #ffc107;
		color: #ffc107;
	}
	.action-btn.route {
		border: 2px solid #1976d2;
		color: #1976d2;
	}
	.action-btn.accident {
		border: 2px solid #dc3545;
		color: #dc3545;
	}

	/* Conductores */
	.drivers-list {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.driver-item {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem;
		background-color: #f8f9fa;
		border-radius: 6px;
		font-size: 0.9rem;
		align-items: center;
	}

	.driver-name {
		font-weight: 500;
		flex: 2;
	}

	.driver-placa {
		flex: 1;
		text-align: center;
		font-family: monospace;
		background-color: #e9ecef;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.driver-control {
		flex: 1;
		text-align: right;
		color: #6c757d;
		font-size: 0.85rem;
	}

	/* Notificación */
	.notification {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		color: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 400px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.3s ease-out;
		z-index: 1000;
	}

	.notification.success {
		background-color: #28a745;
	}
	.notification.error {
		background-color: #dc3545;
	}

	.close-btn {
		background: none;
		border: none;
		color: white;
		font-size: 1.25rem;
		cursor: pointer;
		margin-left: 1rem;
		padding: 0 0.5rem;
	}

	/* Loading */
	.loading-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 5px solid #f3f3f3;
		border-top: 5px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	.spinner.small {
		width: 30px;
		height: 30px;
		border-width: 3px;
		margin-bottom: 0.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #666;
	}

	/* Badges */
	.badge-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
		align-items: center;
	}

	.user-badge {
		background-color: #3498db;
		padding: 0.5rem 0.75rem;
		border-radius: 20px;
		font-size: 0.8rem;
		white-space: nowrap;
		color: white;
		font-weight: 500;
	}

	/* Corrección para iconos de Leaflet */
	:global(.leaflet-default-icon-path) {
		background-image: url(https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png);
	}

	:global(.leaflet-div-icon) {
		background: transparent;
		border: none;
	}

	:global(.leaflet-marker-icon .leaflet-zoom-animated) {
		will-change: auto;
	}

	/* Animaciones */
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.dashboard-nav {
			padding: 0.75rem 1rem;
		}

		.content-wrapper {
			padding: 0.5rem;
		}

		.info-panel,
		.actions-panel,
		.map-panel,
		.drivers-panel {
			padding: 1rem;
		}

		.actions-grid {
			grid-template-columns: 1fr 1fr;
		}

		.map-view {
			height: 300px;
		}

		.notification {
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}

	@media (max-width: 480px) {
		.actions-grid {
			grid-template-columns: 1fr;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		.map-controls {
			flex-direction: column;
		}

		.map-btn {
			width: 100%;
			justify-content: center;
		}

		.badge-container {
			justify-content: center;
		}

		.driver-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.driver-placa,
		.driver-control {
			text-align: left;
			width: 100%;
		}
	}
</style>
