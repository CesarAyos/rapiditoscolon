<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../../components/supabase';
	import Lock from '../../../../../components/lock.svelte';
	import type { Session } from '@supabase/supabase-js';
	import type { Map, Marker } from 'leaflet';
	import ProtectedArea from '../../../../../components/ProtectedArea.svelte';

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

	type ConductorFromDB = {
		id: number;
		nombre: string;
		placa: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type PosicionConductor = {
		id: number;
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy?: number;
		estado: EstadoConductor;
		timestamp: string;
		conductor: ConductorFromDB;
	};

	type EstadoConductor =
		| 'en_servicio_colon'
		| 'en_servicio_ureña'
		| 'en_ruta_colon_ureña'
		| 'en_ruta_ureña_colon'
		| 'accidentado'
		| 'descanso';

	// Stores
	const activeDrivers = writable<PosicionConductor[]>([]);
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);
	const mapInitialized = writable<boolean>(false);

	// Variables reactivas
	let driversData: PosicionConductor[] = [];
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: Session | null = null;
	let map: Map | null = null;
	let markers: Record<number, Marker> = {};
	let mapContainer: HTMLDivElement;
	let L: typeof import('leaflet') | null = null;
	let updateInterval: NodeJS.Timeout | null = null;

	// Suscripciones
	activeDrivers.subscribe((value) => (driversData = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));

	// Inicializar mapa
	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await import('leaflet');
			L = leaflet;
			await import('leaflet/dist/leaflet.css');

			if (!map) {
				map = L.map(mapContainer).setView([8.036238470951442, -72.25267803530193], 13); 
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				}).addTo(map);
				setTimeout(() => map?.invalidateSize(), 100);
				mapInitialized.set(true);
			}
			return true;
		} catch (err) {
			console.error('Error al inicializar mapa:', err);
			error.set('Error al cargar el mapa');
			return false;
		}
	};

	const getActiveDrivers = async () => {
		isLoading.set(true);
		try {
			const { data, error: sbError } = await supabase
				.from('conductor_posiciones')
				.select(
					`
                id,
                conductor_id,
                lat,
                lng,
                accuracy,
                estado,
                timestamp,
                conductor:conductor_id(id, nombre, placa, control, propiedad, telefono)
            `
				)
				.returns<PosicionConductor[]>()
				.order('timestamp', { ascending: false });

			if (sbError) throw sbError;

			if (!data) return;

			const uniqueDrivers = data.reduce<PosicionConductor[]>((acc, current) => {
				const existing = acc.find((d) => d.conductor_id === current.conductor_id);
				if (!existing) acc.push(current);
				return acc;
			}, []);

			activeDrivers.set(uniqueDrivers);
			updateMarkers(uniqueDrivers);
		} catch (err) {
			console.error('Error obteniendo conductores activos:', err);
			error.set('Error al cargar conductores activos');
		} finally {
			isLoading.set(false);
		}
	};

	const updateMarkers = (drivers: PosicionConductor[]) => {
		if (!map || !L) return;

		Object.keys(markers).forEach((id) => {
			if (!drivers.some((d) => d.conductor_id === parseInt(id))) {
				map?.removeLayer(markers[parseInt(id)]);
				delete markers[parseInt(id)];
			}
		});

		drivers.forEach((driver) => {
			if (!L) return;

			const estadoColor = getEstadoColor(driver.estado);
			const icon = L.divIcon({
				className: 'driver-marker',
				html: `
					<div style="position: relative;">
						<svg width="32" height="32" viewBox="0 0 32 32" fill="${estadoColor}" xmlns="http://www.w3.org/2000/svg">
							<path d="M16 0C10.48 0 6 4.48 6 10C6 16.6 16 32 16 32C16 32 26 16.6 26 10C26 4.48 21.52 0 16 0ZM16 15C13.24 15 11 12.76 11 10C11 7.24 13.24 5 16 5C18.76 5 21 7.24 21 10C21 12.76 18.76 15 16 15Z"/>
						</svg>
						<div style="position: absolute; 
									top: -10px; 
									left: 50%; 
									transform: translateX(-50%);
									background: white; 
									border-radius: 50%; 
									padding: 2px 5px;
									border: 2px solid ${estadoColor};
									font-weight: bold;
									font-size: 12px;">
							${driver.conductor.control}
						</div>
					</div>
				`,
				iconSize: [32, 40],
				iconAnchor: [16, 40]
			});

			if (!markers[driver.conductor_id]) {
				if (!map) return; // Verificación de nulidad añadida

				markers[driver.conductor_id] = L.marker([driver.lat, driver.lng], { icon }).addTo(map)
					.bindPopup(`
            <b>${driver.conductor.nombre}</b><br>
            Placa: ${driver.conductor.placa}<br>
            Control: ${driver.conductor.control}<br>
            Estado: ${formatEstado(driver.estado)}<br>
            Propiedad: ${driver.conductor.propiedad}<br>
            ${driver.timestamp ? `Última actualización: ${new Date(driver.timestamp).toLocaleTimeString()}` : ''}
        `);
			} else {
				markers[driver.conductor_id].setLatLng([driver.lat, driver.lng]).setIcon(icon);
			}
		});
	};

	const getEstadoColor = (estado: EstadoConductor): string => {
		switch (estado) {
			case 'en_servicio_colon':
				return '#3498db';
			case 'en_servicio_ureña':
				return '#2ecc71';
			case 'en_ruta_colon_ureña':
				return '#f39c12';
			case 'en_ruta_ureña_colon':
				return '#e74c3c';
			case 'accidentado':
				return '#9b59b6';
			case 'descanso':
				return '#95a5a6';
			default:
				return '#34495e';
		}
	};

	const formatEstado = (estado: EstadoConductor): string => {
		const estados: Record<EstadoConductor, string> = {
			en_servicio_colon: 'En servicio (Colón)',
			en_servicio_ureña: 'En servicio (Ureña)',
			en_ruta_colon_ureña: 'En ruta (Colón → Ureña)',
			en_ruta_ureña_colon: 'En ruta (Ureña → Colón)',
			accidentado: 'Accidentado',
			descanso: 'En descanso'
		};
		return estados[estado];
	};

	const getSession = async (): Promise<Session | null> => {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.error('Error obteniendo sesión:', error);
			return null;
		}
		session.set(data.session);
		return data.session;
	};

	const setupSubscriptions = () => {
		const channel = supabase
			.channel('admin_drivers_updates')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'conductor_posiciones'
				},
				() => {
					getActiveDrivers();
				}
			)
			.subscribe();

		return channel;
	};

	onMount(() => {
		let channel: ReturnType<typeof setupSubscriptions> | null = null;

		const initialize = async () => {
			await getSession();
			await initMap();
			await getActiveDrivers();
			channel = setupSubscriptions();
			updateInterval = setInterval(getActiveDrivers, 30000);
		};

		initialize();

		return () => {
			if (channel) supabase.removeChannel(channel);
			if (updateInterval) clearInterval(updateInterval);
			if (map) {
				map.remove();
				map = null;
			}
		};
	});

	onDestroy(() => {
		if (!browser) return;
		if (updateInterval) clearInterval(updateInterval);
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

<ProtectedArea>
	<div class="admin-container">
		<nav class="admin-nav">
			<div class="nav-header">
				<h1>Panel de Administración</h1>
				<div class="nav-controls">
					<Lock />
				</div>
			</div>
		</nav>

		<main class="admin-content">
			<div class="content-header">
				<h2>Monitoreo de Conductores Activos</h2>
				<div class="controls">
					<button on:click={getActiveDrivers} class="refresh-btn" disabled={loading}>
						{loading ? 'Cargando...' : 'Actualizar Datos'}
					</button>
				</div>
			</div>

			{#if errorMessage}
				<div class="error-message">
					{errorMessage}
				</div>
			{/if}

			<div class="map-container">
				<div bind:this={mapContainer} class="map-view">
					{#if !map}
						<div class="map-loading">
							<div class="spinner"></div>
							<p>Inicializando mapa...</p>
						</div>
					{/if}
				</div>

				<div class="drivers-info">
					<h3>Conductores Activos: {driversData.length}</h3>
					<div class="status-legend">
						<div class="legend-item">
							<span class="legend-color" style="background-color: #3498db;"></span>
							<span>Colón</span>
						</div>
						<div class="legend-item">
							<span class="legend-color" style="background-color: #2ecc71;"></span>
							<span>Ureña</span>
						</div>
						<div class="legend-item">
							<span class="legend-color" style="background-color: #f39c12;"></span>
							<span>Ruta C→U</span>
						</div>
						<div class="legend-item">
							<span class="legend-color" style="background-color: #e74c3c;"></span>
							<span>Ruta U→C</span>
						</div>
						<div class="legend-item">
							<span class="legend-color" style="background-color: #9b59b6;"></span>
							<span>Accidentado</span>
						</div>
						<div class="legend-item">
							<span class="legend-color" style="background-color: #95a5a6;"></span>
							<span>Descanso</span>
						</div>
					</div>

					<div class="drivers-list">
						{#each driversData as driver}
							<div
								class="driver-card"
								style="border-left: 4px solid {getEstadoColor(driver.estado)};"
							>
								<div class="driver-header">
									<span class="driver-control">{driver.conductor.control}</span>
									<span class="driver-status">{formatEstado(driver.estado)}</span>
								</div>
								<div class="driver-info">
									<span class="driver-name">{driver.conductor.nombre}</span>
									<span class="driver-placa">{driver.conductor.placa}</span>
								</div>
								<div class="driver-time">
									{new Date(driver.timestamp).toLocaleTimeString()}
								</div>
							</div>
						{:else}
							<div class="no-drivers">No hay conductores activos en este momento</div>
						{/each}
					</div>
				</div>
			</div>
		</main>
	</div>
</ProtectedArea>

<style>
	.admin-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: #f5f7fa;
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
	}

	.admin-nav {
		background-color: #2c3e50;
		color: white;
		padding: 1rem 2rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.nav-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 500;
	}

	.nav-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.admin-content {
		flex: 1;
		padding: 1.5rem;
	}

	.content-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.content-header h2 {
		margin: 0;
		font-size: 1.3rem;
		color: #2c3e50;
	}

	.controls {
		display: flex;
		gap: 1rem;
	}

	.refresh-btn {
		padding: 0.5rem 1rem;
		background-color: #3498db;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.refresh-btn:hover:not(:disabled) {
		background-color: #2980b9;
		transform: translateY(-1px);
	}

	.refresh-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-message {
		background-color: #f8d7da;
		color: #721c24;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
		border: 1px solid #f5c6cb;
	}

	.map-container {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1.5rem;
		height: calc(100vh - 200px);
	}

	.map-view {
		width: 100%;
		height: 100%;
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

	.spinner {
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

	.drivers-info {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.status-legend {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		background: white;
		padding: 1rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.legend-color {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: inline-block;
	}

	.drivers-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow-y: auto;
		flex: 1;
	}

	.driver-card {
		background: white;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
		transition: transform 0.2s;
	}

	.driver-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.driver-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.driver-control {
		font-weight: bold;
		color: #2c3e50;
		font-size: 1.1rem;
	}

	.driver-status {
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		background: #f1f1f1;
	}

	.driver-info {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.driver-name {
		font-weight: 500;
	}

	.driver-placa {
		font-family: 'Roboto Mono', monospace;
		background: #f1f1f1;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.driver-time {
		font-size: 0.8rem;
		color: #7f8c8d;
		text-align: right;
	}

	.no-drivers {
		text-align: center;
		padding: 2rem;
		color: #95a5a6;
		font-style: italic;
		background: white;
		border-radius: 8px;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.map-container {
			grid-template-columns: 1fr;
			height: auto;
		}

		.drivers-info {
			height: 400px;
		}
	}

	@media (max-width: 768px) {
		.content-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.status-legend {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.admin-nav {
			padding: 1rem;
		}

		.nav-header h1 {
			font-size: 1.3rem;
		}

		.status-legend {
			grid-template-columns: 1fr;
		}
	}
</style>
