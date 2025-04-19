<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../../components/supabase';
	import type * as Leaflet from 'leaflet';
	import Estado from '../../../../../components/estado.svelte';

	interface ConductorFromDB {
		id: number;
		nombre: string;
		placa: string;
		control: string;
		propiedad: string;
		telefono: string | null;
	}

	interface PosicionConductor {
		id: number;
		conductor_id: number;
		lat: number;
		lng: number;
		accuracy: number;
		timestamp: string;
		conductor: ConductorFromDB;
	}

	// Stores
	const activeDrivers = writable<PosicionConductor[]>([]);
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);

	// Variables
	let driversData: PosicionConductor[] = [];
	let errorMessage = '';
	let loading = false;
	let map: Leaflet.Map | null = null;
	let markers: Record<number, Leaflet.Marker> = {};
	let mapContainer: HTMLDivElement | undefined;
	let L: typeof Leaflet | null = null;
	let updateInterval: NodeJS.Timeout | null = null;
	let mapInitialized = false;

	// Suscripciones
	activeDrivers.subscribe((value) => (driversData = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));

	// Leaflet
	async function ensureLeafletLoaded(): Promise<typeof Leaflet> {
		if (!L) {
			L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
		}
		return L;
	}

	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await ensureLeafletLoaded();

			// Limpiar mapa existente si hay uno
			if (map) {
				map.remove();
				map = null;
			}

			// Esperar a que el contenedor esté listo
			await tick();

			map = leaflet
				.map(mapContainer, {
					preferCanvas: true
				})
				.setView([8.036238470951442, -72.25267803530193], 13);

			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				})
				.addTo(map);

			// Forzar redimensionamiento
			setTimeout(() => {
				map?.invalidateSize();
				mapInitialized = true;
			}, 100);

			return true;
		} catch (err) {
			console.error('Error al inicializar mapa:', err);
			error.set('Error al cargar el mapa: ' + (err as Error).message);
			return false;
		}
	};

	// Obtener conductores activos
	const getActiveDrivers = async () => {
		isLoading.set(true);
		try {
			const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

			const { data, error } = await supabase
				.from('conductor_posiciones')
				.select(
					`
					id,
					conductor_id,
					lat,
					lng,
					accuracy,
					timestamp,
					conductor:conductor_id (
						id,
						nombre,
						placa,
						control,
						propiedad,
						telefono
					)
				`
				)
				.gt('timestamp', twoHoursAgo)
				.order('timestamp', { ascending: false });

			if (error) throw error;
			if (!data) throw new Error('No se recibieron datos');

			// Filtrar para obtener la última posición de cada conductor
			const uniqueDrivers = data.reduce<PosicionConductor[]>((acc, current) => {
				const existingIndex = acc.findIndex((d) => d.conductor_id === current.conductor_id);
				if (existingIndex === -1) {
					acc.push({
						...current,
						conductor: Array.isArray(current.conductor) ? current.conductor[0] : current.conductor
					});
				}
				return acc;
			}, []);

			activeDrivers.set(uniqueDrivers);
			await updateMarkers(uniqueDrivers);
		} catch (err) {
			console.error('Error obteniendo conductores:', err);
			error.set('Error al cargar conductores');
		} finally {
			isLoading.set(false);
		}
	};

	// Actualizar marcadores
	const updateMarkers = async (drivers: PosicionConductor[]) => {
		if (!map || !L) return;

		const activeDriverIds = drivers.map((d) => d.conductor_id);

		// Eliminar marcadores antiguos
		Object.keys(markers).forEach((id) => {
			const numericId = Number(id);
			if (!activeDriverIds.includes(numericId)) {
				map?.removeLayer(markers[numericId]);
				delete markers[numericId];
			}
		});

		// Crear/actualizar marcadores
		drivers.forEach((driver) => {
			if (!driver.lat || !driver.lng) return;

			if (markers[driver.conductor_id]) {
				markers[driver.conductor_id]
					.setLatLng([driver.lat, driver.lng])
					.setPopupContent(createPopupContent(driver));
			} else {
				markers[driver.conductor_id] = L!
					.marker([driver.lat, driver.lng], {
						icon: createDriverIcon(L!, driver.conductor.control)
					})
					.addTo(map!)
					.bindPopup(createPopupContent(driver));
			}
		});
	};

	// Crear icono
	function createDriverIcon(leaflet: typeof Leaflet, control: string): Leaflet.DivIcon {
		return leaflet.divIcon({
			className: 'driver-marker',
			html: `
				<div style="position: relative;">
					<svg width="32" height="32" viewBox="0 0 32 32" fill="#3498db" xmlns="http://www.w3.org/2000/svg">
						<path d="M16 0C10.48 0 6 4.48 6 10C6 16.6 16 32 16 32C16 32 26 16.6 26 10C26 4.48 21.52 0 16 0ZM16 15C13.24 15 11 12.76 11 10C11 7.24 13.24 5 16 5C18.76 5 21 7.24 21 10C21 12.76 18.76 15 16 15Z"/>
					</svg>
					<div style="position: absolute; 
								top: -10px; 
								left: 50%; 
								transform: translateX(-50%);
								background: white; 
								border-radius: 50%; 
								padding: 2px 5px;
								border: 2px solid #3498db;
								font-weight: bold;
								font-size: 12px;">
						${control}
					</div>
				</div>
			`,
			iconSize: [32, 40],
			iconAnchor: [16, 40]
		});
	}

	// Contenido de popup
	function createPopupContent(driver: PosicionConductor): string {
		return `
			<b>${driver.conductor.nombre}</b><br>
			Placa: ${driver.conductor.placa}<br>
			Control: ${driver.conductor.control}<br>
			Propiedad: ${driver.conductor.propiedad}<br>
			Actualizado: ${new Date(driver.timestamp).toLocaleTimeString()}
		`;
	}

	// Subscripciones
	const setupSubscriptions = () => {
		const channel = supabase
			.channel('positions_changes')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'conductor_posiciones'
				},
				() => getActiveDrivers()
			)
			.subscribe();

		return channel;
	};

	// Ciclo de vida
	onMount(() => {
		let channel: ReturnType<typeof setupSubscriptions> | null = null;

		const initialize = async () => {
			await initMap();
			getActiveDrivers();
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
			mapInitialized = false;
		};
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
		if (updateInterval) clearInterval(updateInterval);
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

<div class="container mt-5 mb-5 flex flex-col items-center justify-center">
	<h1 class="text-2xl font-bold mb-4">Mapa de Conductores Activos</h1>
	
</div>	

<button
	on:click={() => {
		if (map) {
			map.remove();
			map = null;
		}
		initMap();
		getActiveDrivers();
	}}
	class="refresh-btn"
>
	🔄 Recargar Mapa
</button>

<div class="map-section">
	<div class="map-container">
		<div bind:this={mapContainer} class="map-view" style="height: 70vh; width: 100%;">
			{#if !mapInitialized}
				<div class="map-loading">
					<div class="spinner"></div>
					<p>Inicializando mapa...</p>
				</div>
			{/if}
		</div>
	</div>
</div>

{#if errorMessage}
	<div class="error-message">{errorMessage}</div>
{/if}

<div class="mb-5">
	<Estado />
</div>

<style>
	.map-view {
		width: 100% !important;
		height: 70vh !important;
		min-height: 400px;
		background: #f0f0f0;
	}

	.map-container {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.refresh-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 1000;
		padding: 8px 12px;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
	}

	.refresh-btn:hover {
		background: #f0f0f0;
	}

	.dashboard-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		width: 100%;
		overflow: auto;
	}

	.map-section {
		position: relative;
		width: 100%;
		height: 60vh; /* Altura del mapa reducida para dejar espacio al estado */
		min-height: 400px; /* Altura mínima para dispositivos pequeños */
	}

	.map-container {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.map-view {
		width: 100%;
		height: 100%;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
		background: rgba(255, 255, 255, 0.9);
		z-index: 1000;
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		border-top: 4px solid #3498db;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-message {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: #ff4444;
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		z-index: 1001;
		max-width: 90%;
		text-align: center;
	}
</style>
