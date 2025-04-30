<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../../components/supabase';
	import type { Session } from '@supabase/supabase-js';
	import { protegerRuta } from '../../../../../components/protegerRuta';
	import ProtectedArea from '../../../../../components/ProtectedArea.svelte';
	import Lock from '../../../../../components/lock.svelte';
	import Navbar from '../../../../../components/navbar.svelte';
	

	// Type Definitions
	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email?: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type Position = {
		lat: number;
		lng: number;
		timestamp: string;
		accuracy?: number;
	};

	type DriverWithRoute = Conductor & {
		route: Position[];
		lastPosition?: Position;
	};

	interface RouteLayer {
		layer: any;
		driverId: number;
	}

	// Supabase Response Types
	type SupabaseConductor = {
		id: number;
		nombre: string;
		placa: string;
		email?: string | null;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type SupabasePositionResponse = {
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy?: number | null;
		timestamp: string;
		conductor: SupabaseConductor;
	};

	// Stores
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);
	const drivers = writable<DriverWithRoute[]>([]);

	// Component Variables
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: Session | null = null;
	let map: any = null;
	let markers: Record<number, any> = {};
	let mapContainer: HTMLDivElement;
	let L: any = null;
	let updateInterval: NodeJS.Timeout;
	let realtimeSubscription: any = null;
	let routeLayers: RouteLayer[] = [];

	// Store Subscriptions
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

	// Main Functions
	const initialize = async () => {
		try {
			await getSession();
			await initMap();
			await getAllDriverRoutes();
			const { realtimeSub } = await setupSubscriptions();
			realtimeSubscription = realtimeSub;

			updateInterval = setInterval(async () => {
				await getAllDriverRoutes();
			}, 30000);
		} catch (err) {
			console.error('Initialization error:', err);
			error.set('Initialization failed');
		}
	};

	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await import('leaflet');
			L = leaflet.default;
			await import('leaflet/dist/leaflet.css');

			if (!map) {
				map = L.map(mapContainer).setView([8.038108198602036, -72.25370800354843], 8);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				}).addTo(map);
				setTimeout(() => map.invalidateSize(), 100);
			}
			return true;
		} catch (err) {
			console.error('Map initialization error:', err);
			error.set('Error loading map');
			return false;
		}
	};

	const getAllDriverRoutes = async () => {
		if (!browser || !L || !map) return;

		try {
			const session = await verifySession();
			if (!session) {
				error.set('Sesión inválida, por favor vuelve a iniciar sesión.');
				return;
			}

			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

			const { data, error: sbError } = await supabase
				.from('conductor_posiciones')
				.select(
					`
                conductor_id,
                lat,
                lng,
                accuracy,
                timestamp,
                conductor:conductor_id (
                    id, 
                    nombre, 
                    placa, 
                    email, 
                    control, 
                    propiedad, 
                    telefono
                )
            `
				)
				.gt('timestamp', oneDayAgo)
				.order('timestamp', { ascending: true });

			if (sbError) throw sbError;
			if (!data || !Array.isArray(data)) return;

			const typedData = data.map((entry) => ({
				...entry,
				conductor: Array.isArray(entry.conductor) ? entry.conductor[0] : entry.conductor
			})) as SupabasePositionResponse[];

			const groupedRoutes = typedData.reduce<
				Record<number, { conductor: Conductor; route: Position[] }>
			>(
				(acc, current) => {
					const conductorData: Conductor = {
						id: current.conductor.id,
						nombre: current.conductor.nombre,
						placa: current.conductor.placa,
						email: current.conductor.email || undefined,
						control: current.conductor.control,
						propiedad: current.conductor.propiedad,
						telefono: current.conductor.telefono || null
					};

					if (!acc[current.conductor_id]) {
						acc[current.conductor_id] = {
							conductor: conductorData,
							route: []
						};
					}

					acc[current.conductor_id].route.push({
						lat: current.lat,
						lng: current.lng,
						timestamp: current.timestamp,
						accuracy: current.accuracy ?? undefined
					});

					return acc;
				},
				{} as Record<number, { conductor: Conductor; route: Position[] }>
			);

			const formattedDrivers = Object.values(groupedRoutes).map((driver) => ({
				...driver.conductor,
				route: driver.route,
				lastPosition: driver.route[driver.route.length - 1]
			}));

			drivers.set(formattedDrivers);
			drawRoutes(formattedDrivers);
		} catch (err) {
			console.error('Error loading routes:', err);
			error.set('Error loading trajectories');
		}
	};

	const drawRoutes = (driversList: DriverWithRoute[]) => {
		if (!map || typeof L === 'undefined') return;

		// Clear previous routes
		routeLayers.forEach((layer) => map.removeLayer(layer.layer));
		routeLayers = [];

		driversList.forEach((driver: DriverWithRoute) => {
			if (!driver.route || driver.route.length < 2) return;

			const polyline = L.polyline(
				driver.route.map((pos) => [pos.lat, pos.lng]),
				{
					color: 'blue',
					weight: 4,
					opacity: 0.7
				}
			).addTo(map);

			routeLayers.push({
				layer: polyline,
				driverId: driver.id
			});
		});
	};

	const verifySession = async () => {
		const { data, error } = await supabase.auth.getSession();

		if (error || !data.session) {
			console.warn('Sesión inválida o expirada, forzando re-autenticación...');
			await supabase.auth.signOut();
			return null;
		}

		try {
			const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
			if (refreshError) {
				console.error('Error al refrescar sesión:', refreshError);
				await supabase.auth.signOut(); // Si falla, cerrar sesión y forzar nuevo login
				return null;
			}

			return refreshedData.session;
		} catch (err) {
			console.error('Excepción al verificar sesión:', err);
			return null;
		}
	};

	const updateMarkers = (driversList: DriverWithRoute[]) => {
		if (!map || typeof L === 'undefined') return;

		if (!markers) markers = {};

		// Limpiar conductores inactivos
		Object.keys(markers).forEach((id) => {
			const driverId = parseInt(id);
			if (!driversList.some((d) => d.id === driverId)) {
				map.removeLayer(markers[driverId]);
				delete markers[driverId];
			}
		});

		// Actualizar o crear puntos en el mapa
		driversList.forEach((driver) => {
			if (!driver?.lastPosition) return;

			const position = [driver.lastPosition.lat, driver.lastPosition.lng];
			const marker = markers[driver.id];

			if (marker) {
				marker.setLatLng(position);
				marker.setPopupContent(`
                <b>${driver.nombre}</b><br>
                Placa: ${driver.placa}<br>
                Control: ${driver.control}<br>
                Updated: ${new Date(driver.lastPosition.timestamp).toLocaleTimeString()}
            `);
			} else {
				markers[driver.id] = L.circleMarker(position, {
					radius: 6, // Tamaño del punto
					fillColor: 'blue', // Color del punto
					color: 'white', // Contorno del punto
					weight: 1,
					fillOpacity: 0.9
				}).addTo(map).bindPopup(`
                <b>${driver.nombre}</b><br>
                Placa: ${driver.placa}<br>
                Control: ${driver.control}<br>
                Updated: ${new Date(driver.lastPosition.timestamp).toLocaleTimeString()}
            `);
			}
		});
	};

	const getSession = async (): Promise<Session | null> => {
		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) throw error;
			session.set(data.session);
			return data.session;
		} catch (err) {
			console.error('Session error:', err);
			return null;
		}
	};

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
						const currentDrivers = get(drivers);
						const updatedDrivers = [...currentDrivers];
						const driverIndex = updatedDrivers.findIndex((d) => d.id === payload.new.conductor_id);

						if (driverIndex >= 0) {
							const newPosition: Position = {
								lat: payload.new.lat,
								lng: payload.new.lng,
								timestamp: payload.new.timestamp,
								accuracy: payload.new.accuracy
							};

							updatedDrivers[driverIndex].route.push(newPosition);
							updatedDrivers[driverIndex].lastPosition = newPosition;

							drivers.set(updatedDrivers);
							drawRoutes(updatedDrivers);
						} else {
							await getAllDriverRoutes();
						}
					}
				)
				.subscribe();

			return { realtimeSub: positionsChannel };
		} catch (error) {
			console.error('Subscription error:', error);
			return { realtimeSub: null };
		}
	};

	const cleanup = () => {
		clearInterval(updateInterval);

		if (realtimeSubscription) {
			supabase.removeChannel(realtimeSubscription);
		}

		if (map) {
			map.remove();
			map = null;
		}

		routeLayers = [];
		markers = {};
	};

	onDestroy(() => {
		if (!browser) return;
		cleanup();
	});

	// Subscribe to drivers changes
	drivers.subscribe((driversList) => {
		updateMarkers(driversList);
	});
</script>

<ProtectedArea>
	<div style="width: 100%;">
		<Navbar />
	</div>
	
	<div>
		<button
			on:click={() => window.location.reload()}
			class="btn btn-success"
			title="Recargar la página"
		>
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
