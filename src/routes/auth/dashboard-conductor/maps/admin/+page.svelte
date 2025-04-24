<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../../components/supabase';
	import Lock from '../../../../../components/lock.svelte';
	import type { Session } from '@supabase/supabase-js';
	import { protegerRuta } from '../../../../../components/protegerRuta';
	import ProtectedArea from '../../../../../components/ProtectedArea.svelte';

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
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);
	const drivers = writable<
		(Conductor & {
			lastPosition?: {
				lat: number;
				lng: number;
				timestamp: string;
				accuracy?: number;
			};
		})[]
	>([]);

	// Variables reactivas
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: Session | null = null;
	let map: any = null;
	let markers: Record<number, any> = {};
	let mapContainer: HTMLDivElement;
	let L: any = null;
	let updateInterval: NodeJS.Timeout;
	let realtimeSubscription: any = null;

	// Suscripciones
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));

	onMount(() => {
		protegerRuta();
		initialize();

		return () => {
			cleanup();
		};
	});

	const initialize = async () => {
		try {
			console.log('Inicializando componente de monitoreo...');
			await getSession();
			await initMap();
			await getAllActiveDrivers();

			// Configurar suscripciones a cambios en tiempo real
			const { realtimeSub } = await setupSubscriptions();
			realtimeSubscription = realtimeSub;

			// Intervalo de actualización (30 segundos)
			updateInterval = setInterval(async () => {
				try {
					await getAllActiveDrivers();
				} catch (error) {
					console.error('Error en intervalo de actualización:', error);
				}
			}, 30000);
		} catch (error) {
			console.error('Error en inicialización:', error);
		}
	};

	// Inicializar mapa
	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await import('leaflet');
			L = leaflet.default;
			await import('leaflet/dist/leaflet.css');

			if (!map) {
				// Vista inicial centrada en Colombia
				map = L.map(mapContainer).setView([8.038108198602036, -72.25370800354843], 8);
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

	// Obtener todos los conductores activos (con posiciones recientes)
	const getAllActiveDrivers = async () => {
		if (!browser || !L || !map) return;

		try {
			// Obtener posiciones de los últimos 15 minutos
			const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

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
				.order('timestamp', { ascending: false });

			console.log('Datos sin filtro de tiempo:', data);

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

			// Actualizar la lista de conductores
			console.log('Posiciones más recientes antes de actualizar el store:', latestPositions);

			drivers.set(
				latestPositions.map((item) => ({
					...item.conductor,
					lastPosition: {
						lat: item.lat,
						lng: item.lng,
						accuracy: item.accuracy,
						timestamp: item.timestamp
					}
				}))
			);

			console.log('Conductores actualizados en el store:', $drivers); // Verificar el estado del store
		} catch (err) {
			console.error('Error en getAllActiveDrivers:', err);
			error.set('Error al cargar conductores activos');
		}
	};

	// Actualizar marcadores en el mapa
	const updateMarkers = (driversList: (Conductor & { lastPosition?: any })[]) => {
		console.log('Llamando updateMarkers con:', driversList);
		if (!map || typeof L === 'undefined') return;

		if (driversList.length === 0) {
			console.warn('No hay conductores para mostrar en el mapa.');
			return;
		}

		// Asegurar que 'markers' está inicializado
		if (!markers) markers = {};

		// Limpiar marcadores de conductores que ya no están activos
		Object.keys(markers).forEach((id) => {
			const driverId = parseInt(id);
			if (!driversList.some((d) => d.id === driverId)) {
				map.removeLayer(markers[driverId]);
				delete markers[driverId];
			}
		});

		// Actualizar o crear marcadores para cada conductor activo
		driversList.forEach((driver) => {
			if (!driver?.lastPosition) return;

			const position = [driver.lastPosition.lat, driver.lastPosition.lng];
			const marker = markers[driver.id];

			if (marker) {
				// Actualizar posición existente
				marker.setLatLng(position);

				// Actualizar popup con información actualizada
				marker.setPopupContent(
					`<b>${driver.nombre}</b><br>
                 Placa: ${driver.placa}<br>
                 Control: ${driver.control}<br>
                 Última actualización: ${new Date(driver.lastPosition.timestamp).toLocaleTimeString()}`
				);
			} else {
				// Crear nuevo marcador
				markers[driver.id] = L.marker(position, {
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
                                ${driver.control}
                            </div>
                        </div>
                    `,
						iconSize: [32, 40],
						iconAnchor: [16, 40]
					}),
					title: driver.nombre
				})
					.addTo(map)
					.bindPopup(
						`<b>${driver.nombre}</b><br>
                 Placa: ${driver.placa}<br>
                 Control: ${driver.control}<br>
                 Última actualización: ${new Date(driver.lastPosition.timestamp).toLocaleTimeString()}`
					);

				// Añadir círculo de precisión si está disponible
				if (driver.lastPosition.accuracy) {
					L.circle(position, {
						radius: driver.lastPosition.accuracy,
						fillOpacity: 0.2,
						color: '#3388ff',
						fillColor: '#3388ff'
					}).addTo(map);
				}
			}
		});
	};

	drivers.subscribe((driversList) => {
		console.log('Nuevo estado de conductores:', driversList);
		updateMarkers(driversList);
	});

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

	// Configurar suscripciones a cambios en tiempo real
	const setupSubscriptions = async () => {
		try {
			const positionsChannel = supabase
				.channel('monitoring_positions_updates')
				.on(
					'postgres_changes',
					{
						event: 'INSERT',
						schema: 'public',
						table: 'conductor_posiciones'
					},
					async (payload) => {
						console.log('Nueva posición en tiempo real recibida:', payload.new);
					}
				)
				.subscribe();

			console.log('Suscripción configurada correctamente.');
			return { realtimeSub: positionsChannel }; // Devuelve un objeto con `realtimeSub`
		} catch (error) {
			console.error('Error en setupSubscriptions:', error);
			return { realtimeSub: null }; // Devuelve `{ realtimeSub: null }` en caso de error
		}
	};

	// Limpieza
	const cleanup = () => {
		console.log('Limpiando componente de monitoreo...');
		clearInterval(updateInterval);

		if (realtimeSubscription) {
			supabase.removeChannel(realtimeSubscription);
		}

		if (map) {
			map.remove();
			map = null;
		}
	};

	onDestroy(() => {
		if (!browser) return;
		cleanup();
	});
</script>

<ProtectedArea>
	<div class="mb-2">
		<Lock />
	</div>
	<div>
		<button on:click={() => window.location.reload()} class="btn btn-success" title="Recargar la página">
			🔄 Recargar Mapa
		</button>
	</div>

	<div class="monitoring-container">
		<h1>Monitoreo de Conductores</h1>

		{#if loading}
			<div class="loading">Cargando datos...</div>
		{:else if errorMessage}
			<div class="error">{errorMessage}</div>
		{/if}

		<div class="map-container">
			<div bind:this={mapContainer} class="map" />
		</div>

		<div class="drivers-list">
			<h2>Conductores activos ({$drivers.length})</h2>
			<div class="driver-cards">
				{#each $drivers as driver}
					<div
						class="driver-card"
						on:click={() => {
							if (map && driver.lastPosition) {
								map.setView([driver.lastPosition.lat, driver.lastPosition.lng], 15);
								markers[driver.id]?.openPopup();
							}
						}}
					>
						<div class="driver-info">
							<h3>{driver.nombre}</h3>
							<p><strong>Placa:</strong> {driver.placa}</p>
							<p><strong>Control:</strong> {driver.control}</p>
							<p><strong>Propiedad:</strong> {driver.propiedad}</p>
							{#if driver.lastPosition}
								<p>
									<strong>Última posición:</strong>
									{new Date(driver.lastPosition.timestamp).toLocaleString()}
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</ProtectedArea>

<style>
	.monitoring-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		padding: 1rem;
	}

	.map-container {
		flex: 1;
		margin-bottom: 1rem;
	}

	.map {
		width: 100%;
		height: 60vh;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.drivers-list {
		flex: 0 0 auto;
		max-height: 30vh;
		overflow-y: auto;
	}

	.driver-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1rem;
	}

	.driver-card {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		transition: transform 0.2s;
	}

	.driver-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.driver-info h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.driver-info p {
		margin: 0.25rem 0;
		font-size: 0.9rem;
		color: #666;
	}

	.loading,
	.error {
		padding: 1rem;
		text-align: center;
		margin: 1rem 0;
		border-radius: 4px;
	}

	.loading {
		background: #f0f0f0;
		color: #333;
	}

	.error {
		background: #ffebee;
		color: #c62828;
	}
</style>
