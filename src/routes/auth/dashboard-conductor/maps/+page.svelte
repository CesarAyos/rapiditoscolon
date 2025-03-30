<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../components/supabase';
	import Lock from '../../../../components/lock.svelte';

	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
		estado?: 'en_servicio' | 'ruta_colon_urena' | 'ruta_urena_colon' | 'accidentado' | 'descanso';
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

	type DriverStatus = {
		en_servicio: Conductor[];
		ruta_colon_urena: Conductor[];
		ruta_urena_colon: Conductor[];
		accidentado: Conductor[];
		descanso: Conductor[];
	};

	interface ConductorFromDB {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	}

	interface EstadoConductorResponse {
		estado: 'en_servicio' | 'ruta_colon_urena' | 'ruta_urena_colon' | 'accidentado' | 'descanso';
		conductor: ConductorFromDB;
	}

	// Stores
	const conductor = writable<Conductor | null>(null);
	const estadoActual = writable<string>('Descanso');
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<any>(null);
	const trackingActive = writable<boolean>(false);
	const positionHistory = writable<PosicionConductor[]>([]);
	const otherDrivers = writable<Conductor[]>([]);
	const driverStatusStore = writable<DriverStatus>({
		en_servicio: [],
		ruta_colon_urena: [],
		ruta_urena_colon: [],
		accidentado: [],
		descanso: []
	});
	const loadingStatus = writable<boolean>(false);

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
	let driverStatusData: DriverStatus = {
		en_servicio: [],
		ruta_colon_urena: [],
		ruta_urena_colon: [],
		accidentado: [],
		descanso: []
	};
	let loadingDriverStatus = false;

	// Suscripciones
	conductor.subscribe((value) => (conductorData = value));
	estadoActual.subscribe((value) => (currentEstado = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));
	trackingActive.subscribe((value) => (isTracking = value));
	positionHistory.subscribe((value) => (history = value));
	otherDrivers.subscribe((value) => (drivers = value));
	driverStatusStore.subscribe((value) => (driverStatusData = value));
	loadingStatus.subscribe((value) => (loadingDriverStatus = value));

	// Inicializar mapa
	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await import('leaflet');
			L = leaflet.default;
			await import('leaflet/dist/leaflet.css');

			if (!map) {
				map = L.map(mapContainer).setView([7.8939, -72.5078], 13);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				}).addTo(map);
				setTimeout(() => map.invalidateSize(), 100);
			}
			return true;
		} catch (err) {
			console.error('Error al inicializar mapa:', err);
			error.set('Error al cargar el mapa');
			return false;
		}
	};

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

		savePosition(lat, lng, accuracy);
	};

	const savePosition = async (lat: number, lng: number, accuracy?: number) => {
		if (!conductorData) return;

		try {
			const { error } = await supabase.from('conductor_posiciones').insert({
				conductor_id: conductorData.id,
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

	const stopTracking = () => {
		if (!browser) return;

		if (watchId !== null) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		trackingActive.set(false);
	};

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

	const getSession = async () => {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.error('Error obteniendo sesión:', error);
			return null;
		}
		session.set(data.session);
		return data.session;
	};

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

	const obtenerUltimoEstado = async (conductorId: number) => {
		try {
			const { data, error: sbError } = await supabase
				.from('estado_conductor')
				.select('estado, descripcion')
				.eq('conductor_id', conductorId)
				.maybeSingle();

			if (sbError) throw sbError;

			if (data) {
				estadoActual.set(data.estado);
				return data.estado;
			}

			estadoActual.set('Descanso');
			return 'Descanso';
		} catch (err) {
			console.error('Error obteniendo estado:', err);
			error.set('Error al cargar estado actual');
			return 'Descanso';
		}
	};

	const loadDriverStatus = async () => {
  loadingStatus.set(true);
  try {
    // 1. Consulta directa a la tabla conductores con su estado actual
    const { data: conductores, error: conductoresError } = await supabase
      .from('conductor')
      .select(`
        id,
        nombre,
        placa,
        email,
        control,
        propiedad,
        telefono,
        estado_actual:estado_conductor!inner(estado)
      `)
      .order('created_at', { foreignTable: 'estado_conductor', ascending: false });

    if (conductoresError) throw conductoresError;
    if (!conductores) throw new Error('No se encontraron conductores');

    // 2. Procesamiento de datos
    const statusData: DriverStatus = {
      en_servicio: [],
      ruta_colon_urena: [],
      ruta_urena_colon: [],
      accidentado: [],
      descanso: []
    };

    conductores.forEach(conductor => {
      // Verificar si tiene estado definido
      const estado = conductor.estado_actual?.[0]?.estado || 'descanso';
      
      const conductorConEstado: Conductor = {
        ...conductor,
        estado: estado as 'en_servicio' | 'ruta_colon_urena' | 'ruta_urena_colon' | 'accidentado' | 'descanso'
      };

      // Agrupar por estado
      switch (estado) {
        case 'en_servicio':
          statusData.en_servicio.push(conductorConEstado);
          break;
        case 'ruta_colon_urena':
          statusData.ruta_colon_urena.push(conductorConEstado);
          break;
        case 'ruta_urena_colon':
          statusData.ruta_urena_colon.push(conductorConEstado);
          break;
        case 'accidentado':
          statusData.accidentado.push(conductorConEstado);
          break;
        case 'descanso':
          statusData.descanso.push(conductorConEstado);
          break;
        default:
          statusData.descanso.push(conductorConEstado);
      }
    });

    driverStatusStore.set(statusData);
  } catch (error) {
    console.error('Error al cargar estados:', error);
    
  } finally {
    loadingStatus.set(false);
  }
};

	onMount(() => {
		(async () => {
			try {
				await getSession();
				await obtenerConductor();
				await initMap();
				await loadDriverStatus();
			} catch (error) {
				console.error('Error durante la inicialización:', error);
			}
		})();

		let authSubscription: { unsubscribe: () => void } | null = null;
		let realtimeSubscription: { unsubscribe: () => void } | null = null;

		const setupSubscriptions = () => {
			try {
				const authData = supabase.auth.onAuthStateChange((event, session) => {
					if (event === 'SIGNED_IN') {
						obtenerConductor();
						loadDriverStatus();
					} else if (event === 'SIGNED_OUT') {
						conductor.set(null);
						estadoActual.set('Descanso');
						stopTracking();
					}
				});
				authSubscription = authData.data?.subscription || null;

				const channel = supabase.channel('public:conductor_posiciones').on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'conductor_posiciones'
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

		const interval = setInterval(() => {
			try {
				getOtherDrivers();
				loadDriverStatus();
			} catch (error) {
				console.error('Error en la actualización del intervalo:', error);
			}
		}, 30000);

		try {
			getOtherDrivers();
		} catch (error) {
			console.error('Error obteniendo otros conductores:', error);
		}

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
	<nav class="dashboard-nav">
		<div class="nav-user">
			{#if conductorData}
				<div class="badge-container">
					<span class="user-badge">Control: {conductorData.control}</span>
					<span class="user-badge">{conductorData.propiedad}: {conductorData.nombre}</span>
					<span class="user-badge">Placa: {conductorData.placa}</span>
					<a href="/auth/dashboard-conductor/maps" class="user-badge">Mapa</a>
					<Lock />
				</div>
			{:else}
				<span class="user-name">No autenticado</span>
			{/if}
		</div>
	</nav>

	<main class="dashboard-content">
		<div class="content-wrapper">
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

			<div bind:this={mapContainer} class="map-view">
				{#if !map}
					<div class="map-loading">
						<div class="spinner small"></div>
						<p>Inicializando mapa...</p>
					</div>
				{/if}
			</div>

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
		</div>
	</main>
</div>

<div class="status-section">
    <div class="status-header">
      <h2>Estado de Conductores</h2>
      <button on:click={loadDriverStatus} class="refresh-btn">
        <!-- Icono SVG... -->
        Actualizar
      </button>
    </div>
  
    {#if loadingDriverStatus}
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    {:else}
      <div class="status-grid">
        <div class="status-card">
          <h3>En Servicio</h3>
          {#each driverStatusData.en_servicio as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en servicio</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Ruta Colón - Ureña</h3>
          {#each driverStatusData.ruta_colon_urena as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Ruta Ureña - Colón</h3>
          {#each driverStatusData.ruta_urena_colon as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>s
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Accidentados</h3>
          {#each driverStatusData.accidentado as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores accidentados</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>En Descanso</h3>
          {#each driverStatusData.descanso as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en descanso</p>
          {/each}
        </div>
      </div>
    {/if}
  </div>

<style>
	.dashboard-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: #f5f7fa;
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
	}

	.dashboard-nav {
		background-color: #2c3e50;
		color: white;
		padding: 0.8rem 1.5rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.nav-user {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.badge-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		align-items: center;
	}

	.user-badge {
		background-color: rgba(255, 255, 255, 0.1);
		padding: 0.5rem 0.8rem;
		border-radius: 20px;
		font-size: 0.85rem;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		transition: background-color 0.2s;
		color: white;
		text-decoration: none;
	}

	.user-badge:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.dashboard-content {
		flex: 1;
		padding: 1.5rem;
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.map-view {
		width: 100%;
		height: 60vh;
		min-height: 400px;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
		position: relative;
		background-color: #f8f9fa;
		border: 1px solid #e0e6ed;
		overflow: hidden;
	}

	.map-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.95);
		border-radius: 8px;
		font-weight: 500;
		color: #4a5568;
		z-index: 100;
		gap: 1rem;
	}

	.spinner.small {
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		border-top-color: #3498db;
		animation: spin 1s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.map-controls {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.map-btn {
		padding: 0.65rem 1.25rem;
		border: none;
		border-radius: 6px;
		background-color: #e3f2fd;
		color: #1976d2;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.map-btn:hover:not(:disabled) {
		background-color: #bbdefb;
		transform: translateY(-1px);
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
	}

	.map-btn.active {
		background-color: #1976d2;
		color: white;
	}

	.map-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background-color: #edf2f7;
		color: #a0aec0;
	}

	.drivers-panel {
		background-color: white;
		border-radius: 8px;
		padding: 1.25rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.drivers-panel h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: #2d3748;
		font-weight: 600;
	}

	.drivers-list {
		display: grid;
		gap: 0.75rem;
	}

	.driver-item {
		display: flex;
		justify-content: space-between;
		padding: 0.9rem;
		background-color: #f8f9fa;
		border-radius: 6px;
		font-size: 0.9rem;
		align-items: center;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.driver-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		background-color: #edf2f7;
	}

	.driver-name {
		font-weight: 500;
		flex: 2;
		color: #2d3748;
	}

	.driver-placa {
		flex: 1;
		text-align: center;
		font-family: 'Roboto Mono', monospace;
		background-color: #e2e8f0;
		padding: 0.3rem 0.6rem;
		border-radius: 4px;
		color: #4a5568;
		font-size: 0.85rem;
	}

	.driver-control {
		flex: 1;
		text-align: right;
		color: #718096;
		font-size: 0.85rem;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.dashboard-content {
			padding: 1rem;
		}

		.map-view {
			height: 50vh;
			min-height: 350px;
		}

		.badge-container {
			gap: 0.5rem;
			font-size: 0.8rem;
		}

		.user-badge {
			padding: 0.3rem 0.6rem;
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

	@media (max-width: 480px) {
		.map-controls {
			flex-direction: column;
		}

		.map-btn {
			width: 100%;
			justify-content: center;
		}

		.map-view {
			height: 45vh;
			min-height: 300px;
		}

		.nav-user {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}

	.status-section {
		margin-top: 2rem;
		background: white;
		border-radius: 10px;
		padding: 1.5rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
	}

	.status-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.status-header h2 {
		margin: 0;
		font-size: 1.4rem;
		color: #2c3e50;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: #3498db;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.9rem;
	}

	.refresh-btn:hover {
		background-color: #2980b9;
		transform: translateY(-1px);
	}


	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.status-card {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1rem;
		border-left: 4px solid #3498db;
	}

	.status-card h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: #2c3e50;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e0e6ed;
	}

	.driver-status-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		font-size: 0.9rem;
	}

	.driver-status-item:not(:last-child) {
		border-bottom: 1px dashed #e0e6ed;
	}

	.no-drivers {
		color: #718096;
		font-size: 0.9rem;
		font-style: italic;
		margin: 0.5rem 0;
	}

	.loading-spinner {
		display: flex;
		justify-content: center;
		padding: 2rem;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		border-top-color: #3498db;
		animation: spin 1s ease-in-out infinite;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.status-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 480px) {
		.status-grid {
			grid-template-columns: 1fr;
		}

		.status-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.refresh-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
