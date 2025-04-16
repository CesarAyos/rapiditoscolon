<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../components/supabase';
	import Lock from '../../../../components/lock.svelte';
	import type { Session } from '@supabase/supabase-js';

	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
		estado?:
			| 'en_servicio_colon'
			| 'en_servicio_ureña'
			| 'en_ruta_colon_ureña'
			| 'en_ruta_ureña_colon'
			| 'accidentado'
			| 'descanso';
	};

	type PosicionConductor = {
		id: number;
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy?: number;
		timestamp: string;
	};

	type DriverStatus = {
		en_servicio_colon: Conductor[];
		en_servicio_ureña: Conductor[];
		en_ruta_colon_ureña: Conductor[];
		en_ruta_ureña_colon: Conductor[];
		accidentado: Conductor[];
		descanso: Conductor[];
	};

	// Stores
	const conductor = writable<Conductor | null>(null);
	const estadoActual = writable<string>('descanso');
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);
	const trackingActive = writable<boolean>(false);
	const positionHistory = writable<PosicionConductor[]>([]);
	const otherDrivers = writable<Conductor[]>([]);
	const driverStatusStore = writable<DriverStatus>({
		en_servicio_colon: [],
		en_servicio_ureña: [],
		en_ruta_colon_ureña: [],
		en_ruta_ureña_colon: [],
		accidentado: [],
		descanso: []
	});
	const loadingStatus = writable<boolean>(false);

	// Variables reactivas
	let conductorData: Conductor | null = null;
	let currentEstado: string = 'descanso';
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: Session | null = null;
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
		en_servicio_colon: [],
		en_servicio_ureña: [],
		en_ruta_colon_ureña: [],
		en_ruta_ureña_colon: [],
		accidentado: [],
		descanso: []
	};
	let loadingDriverStatus = false;
	let userInitiatedTracking = false;

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

	// Actualizar posición en el mapa
	const updatePosition = async (lat: number, lng: number, accuracy?: number) => {
		if (!map || !conductorData || !L) return;

		if (!userMarker) {
			userMarker = L.marker([lat, lng], {
				icon: L.divIcon({
					className: 'driver-marker',
					html: `
			  <div style="position: relative;">
				<img src="https://cdn-icons-png.flaticon.com/512/4474/4474228.png" 
					 style="width: 32px; height: 32px;"/>
				<div style="position: absolute; 
						   top: -10px; 
						   left: 50%; 
						   transform: translateX(-50%);
						   background: white; 
						   border-radius: 50%; 
						   padding: 2px 5px;
						   border: 2px solid #3388ff;
						   font-weight: bold;
						   font-size: 12px;">
				  ${conductorData.control}
				</div>
			  </div>
			`,
					iconSize: [32, 40],
					iconAnchor: [16, 40]
				}),
				zIndexOffset: 1000
			})
				.addTo(map)
				.bindPopup(
					`<b>${conductorData.nombre}</b><br>Placa: ${conductorData.placa}<br>Control: ${conductorData.control}`
				);
		} else {
			userMarker.setLatLng([lat, lng]);
		}

		map.setView([lat, lng], 15);

		if (accuracy) {
			if (userMarker.accuracyCircle) {
				map.removeLayer(userMarker.accuracyCircle);
			}

			userMarker.accuracyCircle = L.circle([lat, lng], {
				radius: accuracy,
				fillOpacity: 0.2,
				color: '#3388ff',
				fillColor: '#3388ff'
			}).addTo(map);
		}

		await savePosition(lat, lng, accuracy);
		await getOtherDrivers();
	};

	// Guardar posición en la base de datos
	const savePosition = async (lat: number, lng: number, accuracy?: number) => {
		if (!conductorData) return;

		try {
			const positionData = {
				conductor_id: conductorData.id,
				lat,
				lng,
				accuracy,
				timestamp: new Date().toISOString()
			};

			// Primero intenta actualizar
			const { error: updateError } = await supabase
				.from('conductor_posiciones')
				.update(positionData)
				.eq('conductor_id', conductorData.id);

			// Si no existe, inserta
			if (updateError?.code === 'PGRST116') {
				const { error: insertError } = await supabase
					.from('conductor_posiciones')
					.insert(positionData);

				if (insertError) throw insertError;
			} else if (updateError) {
				throw updateError;
			}
		} catch (err) {
			console.error('Error guardando posición:', err);
			if (err instanceof Error) {
				error.set(err.message);
			} else {
				error.set('Error al guardar posición');
			}
		}
	};

	// Limpiar posiciones antiguas
	const limpiarPosicionesAntiguas = async () => {
		if (!conductorData) return;

		try {
			const { error } = await supabase
				.from('conductor_posiciones')
				.delete()
				.lt('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
				.eq('conductor_id', conductorData.id);

			if (error) throw error;
		} catch (err) {
			console.error('Error limpiando posiciones antiguas:', err);
		}
	};

	// Obtener posición actual
	const getCurrentPosition = () => {
		if (!browser || !userInitiatedTracking) return;

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
		if (!browser || !userInitiatedTracking) return;

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
					console.error('Error en seguimiento:', err);
					error.set('Error en seguimiento: ' + err.message);
					stopTracking();
				},
				{
					enableHighAccuracy: true,
					maximumAge: 10000,
					timeout: 15000
				}
			);
			trackingActive.set(true);
		} else {
			error.set('Geolocalización no soportada por este navegador');
		}
	};

	// Habilitar seguimiento (llamar desde evento de usuario)
	const enableTracking = () => {
		userInitiatedTracking = true;

		if (isTracking) {
			stopTracking();
		} else {
			startTracking();
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

	// Obtener otros conductores
	const getOtherDrivers = async () => {
  if (!browser || !L || !map) return;

  try {
    // Consulta optimizada con relaciones explícitas
	const { data, error: sbError } = await supabase
  .from('conductor_posiciones')
  .select(`
    conductor_id,
    lat,
    lng,
    accuracy,
    timestamp,
    conductor!fk_conductor(id, nombre, placa, control, propiedad, telefono)
  `)
  .order('timestamp', { ascending: false })
  .limit(50);

    if (sbError) throw sbError;
    if (!data) return;

    // Procesamiento de datos...
    const uniqueDrivers = data.reduce((acc: any[], current) => {
      if (!acc.some(item => item.conductor_id === current.conductor_id)) {
        acc.push(current);
      }
      return acc;
    }, []);

    const activeDrivers = uniqueDrivers.filter(driver => 
      driver.conductor_id !== conductorData?.id &&
      driver.estado && 
      [
        'en_servicio_colon',
        'en_servicio_ureña',
        'en_ruta_colon_ureña',
        'en_ruta_ureña_colon'
      ].includes(driver.estado)
    );

    // Actualización de marcadores...
    Object.keys(otherMarkers).forEach(id => {
      if (!activeDrivers.some(d => d.conductor_id === parseInt(id))) {
        map.removeLayer(otherMarkers[parseInt(id)]);
        delete otherMarkers[parseInt(id)];
      }
    });

    activeDrivers.forEach(driver => {
      const driverEstado = driver.estado || 'descanso';
      const markerColor = driverEstado.includes('ureña') ? '#ff3333' : 
                        driverEstado.includes('colon') ? '#3388ff' : 
                        '#666666';

      if (!otherMarkers[driver.conductor_id]) {
        otherMarkers[driver.conductor_id] = L.marker([driver.lat, driver.lng], {
          icon: L.divIcon({
            html: `
              <div style="position: relative;">
                <img src="https://cdn-icons-png.flaticon.com/512/477/477103.png" 
                     style="width: 32px; height: 32px;"/>
                <div style="position: absolute; 
                           top: -10px; 
                           left: 50%; 
                           transform: translateX(-50%);
                           background: white; 
                           border-radius: 50%; 
                           padding: 2px 5px;
                           border: 2px solid ${markerColor};
                           font-weight: bold;
                           font-size: 12px;">
                  ${driver.conductor.control}
                </div>
              </div>
            `,
            iconSize: [32, 40],
            iconAnchor: [16, 40]
          }),
          title: driver.conductor.nombre
        })
          .addTo(map)
          .bindPopup(
            `<b>${driver.conductor.nombre}</b><br>
             Placa: ${driver.conductor.placa}<br>
             Control: ${driver.conductor.control}<br>
             Estado: ${driverEstado.replace(/_/g, ' ')}`
          );
      } else {
        otherMarkers[driver.conductor_id].setLatLng([driver.lat, driver.lng]);
      }
    });

    otherDrivers.set(activeDrivers.map(d => ({
      ...d.conductor,
      estado: d.estado
    })));

  } catch (err) {
    console.error('Error obteniendo otros conductores:', err);
    error.set('Error al cargar otros conductores');
  }
};

	// Obtener sesión actual
	const getSession = async (): Promise<Session | null> => {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.error('Error obteniendo sesión:', error);
			return null;
		}
		session.set(data.session);
		return data.session;
	};

	// Obtener datos del conductor
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
			if (err instanceof Error) {
				error.set(err.message);
			} else {
				error.set('Error desconocido al obtener conductor');
			}
			conductor.set(null);
		} finally {
			isLoading.set(false);
		}
	};

	// Obtener último estado del conductor
	const obtenerUltimoEstado = async (conductorId: number) => {
		try {
			const { data, error: sbError } = await supabase
				.from('estado_conductor')
				.select('estado, descripcion')
				.eq('conductor_id', conductorId)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (sbError) throw sbError;

			if (data) {
				estadoActual.set(data.estado);
				return data.estado;
			}

			estadoActual.set('descanso');
			return 'descanso';
		} catch (err) {
			console.error('Error obteniendo estado:', err);
			error.set('Error al cargar estado actual');
			return 'descanso';
		}
	};

	// Actualizar estado del conductor
	const actualizarEstadoConductor = async (nuevoEstado: string, descripcion?: string) => {
		if (!conductorData) return false;

		try {
			const { error } = await supabase.from('estado_conductor').insert({
				conductor_id: conductorData.id,
				estado: nuevoEstado,
				descripcion: descripcion || null
			});

			if (error) throw error;

			estadoActual.set(nuevoEstado);
			await loadDriverStatus();
			return true;
		} catch (err) {
			console.error('Error actualizando estado:', err);
			if (err instanceof Error) {
				error.set(err.message);
			} else {
				error.set('Error al actualizar estado');
			}
			return false;
		}
	};

	const requestLocationPermission = async (): Promise<boolean> => {
		if (!browser) return false;

		try {
			// Para Android/Chrome
			if (navigator.permissions) {
				const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });

				if (permissionStatus.state === 'granted') {
					enableTracking();
					return true;
				} else if (permissionStatus.state === 'prompt') {
					return new Promise((resolve) => {
						navigator.geolocation.getCurrentPosition(
							() => {
								enableTracking();
								resolve(true);
							},
							(err) => {
								console.error('Permiso denegado:', err);
								error.set('Se necesitan permisos de ubicación para el seguimiento');
								resolve(false);
							},
							{ enableHighAccuracy: true }
						);
					});
				}
			}
			// Para Safari y otros navegadores
			else {
				return new Promise((resolve) => {
					navigator.geolocation.getCurrentPosition(
						() => {
							enableTracking();
							resolve(true);
						},
						(err) => {
							console.error('Error al obtener ubicación:', err);
							error.set('Error al obtener ubicación: ' + err.message);
							resolve(false);
						},
						{ enableHighAccuracy: true }
					);
				});
			}
		} catch (err) {
			console.error('Error en permisos:', err);
			error.set('Error al verificar permisos de ubicación');
			return false;
		}
		return false;
	};

	// Cargar estado de todos los conductores
	const loadDriverStatus = async () => {
		loadingStatus.set(true);
		try {
			const { data: ultimosEstados, error: estadosError } = await supabase
				.from('estado_conductor')
				.select(
					`
			conductor_id,
			estado,
			conductor:conductor!estado_conductor_conductor_id_fkey(
			  id, nombre, placa, email, control, propiedad, telefono
			)
		  `
				)
				.order('created_at', { ascending: false });

			if (estadosError) throw estadosError;
			if (!ultimosEstados) throw new Error('No se encontraron estados');

			const conductoresPorId = ultimosEstados.reduce((acc, current) => {
				if (!acc.has(current.conductor_id)) {
					acc.set(current.conductor_id, {
						...current.conductor,
						estado: current.estado
					});
				}
				return acc;
			}, new Map<number, any>());

			const conductores = Array.from(conductoresPorId.values());

			const statusData: DriverStatus = {
				en_servicio_colon: [],
				en_servicio_ureña: [],
				en_ruta_colon_ureña: [],
				en_ruta_ureña_colon: [],
				accidentado: [],
				descanso: []
			};

			conductores.forEach((conductor) => {
				const estado = conductor.estado || 'descanso';

				switch (estado) {
					case 'en_servicio_colon':
						statusData.en_servicio_colon.push(conductor);
						break;
					case 'en_servicio_ureña':
						statusData.en_servicio_ureña.push(conductor);
						break;
					case 'en_ruta_colon_ureña':
						statusData.en_ruta_colon_ureña.push(conductor);
						break;
					case 'en_ruta_ureña_colon':
						statusData.en_ruta_ureña_colon.push(conductor);
						break;
					case 'accidentado':
						statusData.accidentado.push(conductor);
						break;
					default:
						statusData.descanso.push(conductor);
				}
			});

			driverStatusStore.set(statusData);
		} catch (err) {
			console.error('Error al cargar estados:', err);
			if (err instanceof Error) {
				error.set(err.message);
			} else {
				error.set('Error al cargar estados de conductores');
			}
		} finally {
			loadingStatus.set(false);
		}
	};

	// Configurar suscripciones a cambios en tiempo real
	const setupSubscriptions = async () => {
		try {
			const { data: authData } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
				if (supabaseSession) {
					session.set(supabaseSession);
				}

				if (event === 'SIGNED_IN') {
					await obtenerConductor();
					await loadDriverStatus();
					if (conductorData) {
						getCurrentPosition();
						await getOtherDrivers();
					}
				} else if (event === 'SIGNED_OUT') {
					conductor.set(null);
					estadoActual.set('descanso');
					stopTracking();
				}
			});

			const channel = supabase
				.channel('conductor_updates')
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'conductor_posiciones'
					},
					async (payload) => {
						if (
							payload.new &&
							'conductor_id' in payload.new &&
							payload.new.conductor_id !== conductorData?.id
						) {
							await getOtherDrivers();
						}
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'estado_conductor'
					},
					async (payload) => {
						await loadDriverStatus();
						if (
							payload.new &&
							'conductor_id' in payload.new &&
							payload.new.conductor_id === conductorData?.id &&
							'estado' in payload.new
						) {
							estadoActual.set(payload.new.estado as string);
						}
					}
				)
				.subscribe();

			return { authSubscription: authData.subscription, realtimeSubscription: channel };
		} catch (error) {
			console.error('Error configurando suscripciones:', error);
			return { authSubscription: null, realtimeSubscription: null };
		}
	};

	// Inicialización al montar el componente
	onMount(() => {
		let updateInterval: NodeJS.Timeout;
		let authSubscription: { unsubscribe: () => void } | null = null;
		let realtimeSubscription: any = null;

		const initialize = async () => {
			try {
				await getSession();
				await new Promise((resolve) => setTimeout(resolve, 50));
				await obtenerConductor();
				await Promise.all([initMap(), loadDriverStatus()]);

				const subscriptions = await setupSubscriptions();
				authSubscription = subscriptions.authSubscription;
				realtimeSubscription = subscriptions.realtimeSubscription;

				if (conductorData) {
					getCurrentPosition();
					await getOtherDrivers();
				}

				await limpiarPosicionesAntiguas();
				setInterval(limpiarPosicionesAntiguas, 60 * 60 * 1000);

				updateInterval = setInterval(async () => {
					try {
						await getOtherDrivers();
						await loadDriverStatus();
					} catch (error) {
						console.error('Error in update interval:', error);
					}
				}, 30000);
			} catch (error) {
				console.error('Initialization error:', error);
			}
		};

		initialize();

		return () => {
			clearInterval(updateInterval);
			stopTracking();

			if (authSubscription) {
				authSubscription.unsubscribe();
			}

			if (realtimeSubscription) {
				supabase.removeChannel(realtimeSubscription);
			}

			if (map) {
				map.remove();
				map = null;
			}
		};
	});

	// Limpieza al desmontar el componente
	onDestroy(() => {
		if (!browser) return;
		stopTracking();
		if (map) {
			map.remove();
			map = null;
		}
	});

	// Función para recargar la página
	const recargarPagina = () => {
		window.location.reload();
	};
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
					<a href="/auth/dashboard-conductor/maps/admin" class="user-badge">Admin</a>
					<Lock />
				</div>
			{:else}
				<span class="user-name">No autenticado</span>
			{/if}
		</div>
	</nav>
	<button on:click={recargarPagina} class="reload-btn mt-2 btn btn-info">
		↻ Recargar para ver estado de conductores
	</button>
	<main class="dashboard-content">
		<div class="content-wrapper">
			<div class="map-controls">
				<button
					on:click|preventDefault={async () => {
						if (!map) await initMap();
						await requestLocationPermission();
					}}
					class:active={isTracking}
					disabled={!browser}
				>
					{isTracking
						? '📍 Siguiendo ubicación (Click para detener)'
						: '📍 Activar seguimiento GPS'}
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
				<h3>En servicio Colón</h3>
				{#each driverStatusData.en_servicio_colon as driver}
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
				<h3>En servicio Ureña</h3>
				{#each driverStatusData.en_servicio_ureña as driver}
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
				<h3>Ruta Colón - Ureña</h3>
				{#each driverStatusData.en_ruta_colon_ureña as driver}
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
				<h3>Ruta Ureña - Colón</h3>
				{#each driverStatusData.en_ruta_ureña_colon as driver}
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
