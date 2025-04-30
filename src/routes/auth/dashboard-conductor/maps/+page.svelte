<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../components/supabase';
	import type { Session } from '@supabase/supabase-js';
	import { protegerRuta } from '../../../../components/protegerRuta';

	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type PosicionConductor = {
		id?: number;
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy?: number;
		timestamp: string;
	};

	// Stores
	const conductor = writable<Conductor | null>(null);
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);
	const trackingActive = writable<boolean>(false);
	const positionHistory = writable<PosicionConductor[]>([]);
	const otherDrivers = writable<
		(Conductor & { lastPosition?: { lat: number; lng: number; timestamp: string } })[]
	>([]);

	// Variables reactivas
	let conductorData: Conductor | null = null;
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: Session | null = null;
	let map: any = null;
	let userMarker: any = null;
	let otherMarkers: Record<number, any> = {};
	let mapContainer: HTMLDivElement;
	let watchId: number | null = null;
	let isTracking = false;
	let drivers: (Conductor & { lastPosition?: { lat: number; lng: number; timestamp: string } })[] =
		[];
	let history: PosicionConductor[] = [];
	let L: any = null;
	let userInitiatedTracking = false;
	let polyline: any = null;
	let positions: [number, number][] = [];
	let positionBuffer: PosicionConductor[] = [];
	const POSITION_BUFFER_LIMIT = 10; // Número de posiciones a acumular antes de enviar

	// Suscripciones
	conductor.subscribe((value) => (conductorData = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));
	trackingActive.subscribe((value) => (isTracking = value));
	positionHistory.subscribe((value) => (history = value));
	otherDrivers.subscribe((value) => (drivers = value));

	onMount(() => {
		protegerRuta();
		let updateInterval: NodeJS.Timeout;
		let authSubscription: { unsubscribe: () => void } | null = null;
		let realtimeSubscription: any = null;
		let bufferFlushInterval: NodeJS.Timeout;

		const initialize = async () => {
			try {
				console.log('Inicializando componente...');
				await getSession();
				await new Promise((resolve) => setTimeout(resolve, 50));
				await obtenerConductor();
				await initMap();

				// Cargar estado del seguimiento
				const savedTrackingState = loadTrackingState();
				if (savedTrackingState) {
					userInitiatedTracking = true;
					startTracking();
				}

				// Cargar historial de rutas si existe
				if (conductorData) {
					const historial = await obtenerHistorialRuta(conductorData.id);
					positionHistory.set(historial);

					// Dibujar ruta histórica
					if (historial.length > 0) {
						positions = historial.map((pos) => [pos.lat, pos.lng]);
						dibujarRutaActual();
					}
				}

				const subscriptions = await setupSubscriptions();
				authSubscription = subscriptions.authSubscription;
				realtimeSubscription = subscriptions.realtimeSubscription;

				if (conductorData) {
					getCurrentPosition();
					await getOtherDrivers();
				}

				// Intervalo para enviar posiciones en buffer
				bufferFlushInterval = setInterval(flushPositionBuffer, 15000); // Enviar cada 15 segundos

				// Intervalo de actualización de otros conductores (10 segundos)
				updateInterval = setInterval(async () => {
					try {
						await getOtherDrivers();
					} catch (error) {
						console.error('Error en intervalo de actualización:', error);
					}
				}, 10000);
			} catch (error) {
				console.error('Error en inicialización:', error);
			}
		};

		initialize();

		return () => {
			console.log('Limpiando componente...');
			clearInterval(updateInterval);
			clearInterval(bufferFlushInterval);
			stopTracking();
			flushPositionBuffer(); // Enviar cualquier posición pendiente

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

	const savePosition = async (lat: number, lng: number, accuracy?: number) => {
		console.log('Guardando en Supabase:', { lat, lng, timestamp: new Date().toISOString() });

		const positionData: PosicionConductor = {
			conductor_id: conductorData?.id ?? 0,
			lat,
			lng,
			accuracy,
			timestamp: new Date().toISOString()
		};

		try {
			const { data, error: insertError } = await supabase
				.from('conductor_posiciones')
				.insert([positionData])
				.select();

			if (insertError) throw insertError;

			console.log('Posición guardada en Supabase:', data);
		} catch (err) {
			console.error('Error al guardar la posición:', err);
		}
	};

	// Enviar posiciones en buffer a la base de datos
	// Enviar posiciones en buffer a la base de datos
	const flushPositionBuffer = async () => {
		if (positionBuffer.length === 0 || !conductorData) return;

		// Declarar positionsToSend fuera del try-catch para que sea accesible en ambos bloques
		let positionsToSend: PosicionConductor[] = [];

		try {
			positionsToSend = [...positionBuffer];
			positionBuffer = []; // Limpiar buffer

			const { data, error: insertError } = await supabase
				.from('conductor_posiciones')
				.insert(positionsToSend)
				.select();

			if (insertError) throw insertError;

			// Actualizar historial local
			if (data) {
				positionHistory.update((history) => [...history, ...(data as PosicionConductor[])]);
			}

			return data;
		} catch (err) {
			console.error('Error al enviar posiciones en buffer:', err);
			// Reintentar en el próximo intervalo si falla
			positionBuffer = [...positionsToSend, ...positionBuffer];
			throw err;
		}
	};

	// Obtener historial de rutas para un conductor
	const obtenerHistorialRuta = async (conductorId: number): Promise<PosicionConductor[]> => {
		try {
			const { data, error } = await supabase
				.from('conductor_posiciones')
				.select('*')
				.eq('conductor_id', conductorId)
				.order('timestamp', { ascending: true });

			if (error) throw error;
			return data as PosicionConductor[];
		} catch (err) {
			console.error('Error al obtener historial de ruta:', err);
			return [];
		}
	};

	// Dibujar la ruta actual en el mapa
	const dibujarRutaActual = () => {
		if (!map || !L || positions.length === 0) return;

		// Limpiar polilínea anterior
		if (polyline) {
			map.removeLayer(polyline);
		}

		// Crear nueva polilínea
		polyline = L.polyline(positions, {
			color: '#3388ff',
			weight: 5,
			opacity: 0.7,
			dashArray: '10, 10'
		}).addTo(map);

		// Ajustar vista para mostrar toda la ruta
		if (positions.length > 1) {
			map.fitBounds(polyline.getBounds());
		}
	};

	// Actualizar posición en el mapa
	const updatePosition = async (lat: number, lng: number, accuracy?: number) => {
		if (!map || !conductorData || !L) {
			console.error('Faltan dependencias para updatePosition');
			return;
		}

		console.log('Actualizando posición en el mapa...');

		positions.push([lat, lng]);

		if (positions.length > 1000) {
			positions = positions.slice(-1000);
		}

		dibujarRutaActual();

		if (!userMarker) {
			userMarker = L.circle([lat, lng], {
				radius: 3, // Tamaño del punto
				color: '#ff0000', // Color rojo
				fillColor: '#ff0000',
				fillOpacity: 1
			}).addTo(map);
		} else {
			userMarker.setLatLng([lat, lng]);
		}

		map.setView([lat, lng], map.getZoom());

		if (accuracy) {
			if (userMarker.accuracyCircle) {
				map.removeLayer(userMarker.accuracyCircle);
			}
			userMarker.accuracyCircle = L.circle([lat, lng], { radius: accuracy }).addTo(map);
		}

		await savePosition(lat, lng, accuracy);
	};

	// Limpiar rutas antiguas (ejecutar periódicamente)
	const limpiarRutasAntiguas = async (dias: number = 7) => {
		const fechaLimite = new Date();
		fechaLimite.setDate(fechaLimite.getDate() - dias);

		const { error } = await supabase
			.from('conductor_posiciones')
			.delete()
			.lt('timestamp', fechaLimite.toISOString());

		if (error) console.error('Error limpiando rutas antiguas:', error);
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
					console.error('Error en getCurrentPosition:', err);
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

		positions = [];
		if (polyline) {
			map.removeLayer(polyline);
			polyline = null;
		}

		if (navigator.geolocation) {
			watchId = navigator.geolocation.watchPosition(
				(position) => {
					console.log('Nueva posición detectada:', position.coords);
					updatePosition(
						position.coords.latitude,
						position.coords.longitude,
						position.coords.accuracy
					);
				},
				(err) => {
					console.error('Error en seguimiento:', err);
					stopTracking();
				},
				{
					enableHighAccuracy: true,
					maximumAge: 500,
					timeout: 5000
				}
			);

			trackingActive.set(true);
			console.log('Seguimiento GPS activado');
		} else {
			error.set('Geolocalización no soportada por este navegador');
		}
	};

	// Habilitar seguimiento
	const enableTracking = () => {
		userInitiatedTracking = true;

		if (isTracking) {
			stopTracking();
			saveTrackingState(false);
		} else {
			startTracking();
			saveTrackingState(true);
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
		saveTrackingState(false);
		console.log('Seguimiento GPS detenido');
	};

	// Guardar estado en localStorage
	const saveTrackingState = (isActive: boolean) => {
		if (browser) {
			localStorage.setItem('trackingActive', JSON.stringify(isActive));
		}
	};

	// Leer estado desde localStorage
	const loadTrackingState = (): boolean => {
		if (browser) {
			const saved = localStorage.getItem('trackingActive');
			return saved ? JSON.parse(saved) : false;
		}
		return false;
	};

	// Función auxiliar para actualizar marcadores de otros conductores
	const updateOtherDriverMarker = (
		driverId: number,
		lat: number,
		lng: number,
		driverData: Conductor
	) => {
		if (!map || !L) return;

		const marker = otherMarkers[driverId];
		const position = [lat, lng];

		if (marker) {
			// Actualizar posición existente con animación
			marker.setLatLng(position);
		} else {
			// Crear nuevo marcador
			otherMarkers[driverId] = L.marker(position, {
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
                                       border: 2px solid #666666;
                                       font-weight: bold;
                                       font-size: 12px;">
                                ${driverData.control}
                            </div>
                        </div>
                    `,
					iconSize: [32, 40],
					iconAnchor: [16, 40]
				}),
				title: driverData.nombre
			})
				.addTo(map)
				.bindPopup(
					`<b>${driverData.nombre}</b><br>
                 Placa: ${driverData.placa}<br>
                 Control: ${driverData.control}`
				);
		}

		// Actualizar la lista de otros conductores
		otherDrivers.update((drivers) => {
			const existing = drivers.find((d) => d.id === driverId);
			if (existing) {
				return drivers.map((d) =>
					d.id === driverId
						? { ...d, lastPosition: { lat, lng, timestamp: new Date().toISOString() } }
						: d
				);
			} else {
				return [
					...drivers,
					{ ...driverData, lastPosition: { lat, lng, timestamp: new Date().toISOString() } }
				];
			}
		});
	};

	// Obtener otros conductores
	const getOtherDrivers = async () => {
		if (!browser || !L || !map) return;

		try {
			// Obtener posiciones de los últimos 5 minutos
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

			const { data, error: sbError } = await supabase
				.from('conductor_posiciones')
				.select(
					`
                    conductor_id,
                    lat,
                    lng,
                    accuracy,
                    timestamp,
                    conductor!fk_conductor(id, nombre, placa, control, propiedad, telefono)
                `
				)
				.gt('timestamp', fiveMinutesAgo) // Solo posiciones recientes
				.order('timestamp', { ascending: false });

			if (sbError) throw sbError;
			if (!data) return;

			// Agrupar por conductor_id y tomar la más reciente de cada uno
			const latestPositions = data.reduce((acc: any[], current) => {
				const existing = acc.find((item) => item.conductor_id === current.conductor_id);
				if (!existing) {
					acc.push(current);
				}
				return acc;
			}, []);

			const activeDrivers = latestPositions.filter(
				(driver) => driver.conductor_id !== conductorData?.id
			);

			// Limpiar marcadores antiguos
			Object.keys(otherMarkers).forEach((id) => {
				const driverId = parseInt(id);
				if (!activeDrivers.some((d) => d.conductor_id === driverId)) {
					map.removeLayer(otherMarkers[driverId]);
					delete otherMarkers[driverId];
				}
			});

			// Actualizar o crear marcadores
			activeDrivers.forEach((driver) => {
				updateOtherDriverMarker(driver.conductor_id, driver.lat, driver.lng, driver.conductor);
			});
		} catch (err) {
			console.error('Error en getOtherDrivers:', err);
			error.set('Error al cargar otros conductores');
		}
	};

	// Obtener sesión actual
	const getSession = async (): Promise<Session | null> => {
		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) throw error;
			session.set(data.session);
			return data.session;
		} catch (err) {
			console.error('Error en getSession:', err);
			return null;
		}
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
		} catch (err) {
			console.error('Error en obtenerConductor:', err);
			error.set(err instanceof Error ? err.message : 'Error desconocido al obtener conductor');
			conductor.set(null);
		} finally {
			isLoading.set(false);
		}
	};
    

	// Configurar suscripciones a cambios en tiempo real
	const setupSubscriptions = async () => {
		try {
			const { data: authData } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
				console.log('Cambio en estado de autenticación:', event);
				if (supabaseSession) {
					session.set(supabaseSession);
				}

				if (event === 'SIGNED_IN') {
					await obtenerConductor();
					if (conductorData) {
						getCurrentPosition();
						await getOtherDrivers();
					}
				} else if (event === 'SIGNED_OUT') {
					conductor.set(null);
					stopTracking();
				}
			});

			// Suscripción más específica para cambios de posición
			const positionsChannel = supabase
				.channel('positions_updates')
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'conductor_posiciones'
					},
					async (payload) => {
						// Solo actualizar si es un conductor diferente
						if (payload.new?.conductor_id !== conductorData?.id) {
							// Obtener datos completos del conductor
							const { data: driverData, error } = await supabase
								.from('conductor')
								.select('*')
								.eq('id', payload.new.conductor_id)
								.single();

							if (!error && driverData) {
								// Actualizar marcador inmediatamente
								updateOtherDriverMarker(
									payload.new.conductor_id,
									payload.new.lat,
									payload.new.lng,
									driverData
								);
							}
						}
					}
				)
				.subscribe();

			return {
				authSubscription: authData.subscription,
				realtimeSubscription: positionsChannel
			};
		} catch (error) {
			console.error('Error en setupSubscriptions:', error);
			return { authSubscription: null, realtimeSubscription: null };
		}
	};

	// Limpieza al desmontar el componente
	onDestroy(() => {
		if (!browser) return;
		console.log('Destruyendo componente...');
		stopTracking();
		flushPositionBuffer(); // Asegurarse de enviar posiciones pendientes

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
					on:click|preventDefault={async () => {
						if (!map) await initMap();
						enableTracking();
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
				<button
					on:click={() => {
						if (polyline) {
							map.removeLayer(polyline);
							polyline = null;
							positions = [];
						}
					}}
					class="map-btn"
					disabled={!isTracking || !polyline}
				>
					🧹 Limpiar ruta
				</button>
				<button
					on:click={() => window.location.reload()}
					class="map-btn"
					title="Recargar la página"
				>
					🔄 Recargar Mapa
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
					<h3>Conductores Activos ({drivers.length})</h3>
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

	button {
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

	button:hover:not(:disabled) {
		background-color: #bbdefb;
		transform: translateY(-1px);
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
	}

	button.active {
		background-color: #bbdefb;
		font-weight: 600;
	}

	button:disabled {
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

		button {
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
</style>
