<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../../../components/supabase';
	import type * as Leaflet from 'leaflet';
	import { protegerRuta } from '../../../../../components/protegerRuta';
	

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
		conductor?: ConductorFromDB;
	}

	// Extender la interfaz Marker de Leaflet
	interface CustomMarker extends Leaflet.Marker {
		slideTo: (
			latlng: Leaflet.LatLngExpression,
			options?: {
				duration?: number;
				easeLinearity?: number;
				noMoveStart?: boolean;
				keepAtCenter?: boolean;
				complete?: () => void;
			}
		) => {
			cancel: () => void;
		};
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
	let markers: Record<number, CustomMarker> = {};
	let mapContainer: HTMLDivElement | undefined;
	let L: typeof Leaflet | null = null;
	let updateInterval: NodeJS.Timeout | null = null;
	let mapInitialized = false;
	let channel: any = null;

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

	// Función para crear icono de conductor
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

	// Función para crear contenido de popup
	function createPopupContent(driver: PosicionConductor): string {
		if (!driver.conductor) return '';
		return `
			<b>${driver.conductor.nombre}</b><br>
			Placa: ${driver.conductor.placa}<br>
			Control: ${driver.conductor.control}<br>
			Propiedad: ${driver.conductor.propiedad}<br>
			Actualizado: ${new Date(driver.timestamp).toLocaleTimeString()}
		`;
	}

	// Función para añadir animaciones a Leaflet
	function addLeafletAnimations(leaflet: typeof Leaflet) {
		(leaflet.Marker.prototype as CustomMarker).slideTo = function (
			newLatLng: Leaflet.LatLngExpression,
			options: any = {}
		) {
			const duration = options.duration || 1000;
			const easeLinearity = options.easeLinearity || 0.25;
			const noMoveStart = options.noMoveStart || false;
			const keepAtCenter = options.keepAtCenter || false;

			const marker = this as CustomMarker;
			const from = marker.getLatLng();
			const to = leaflet.latLng(newLatLng);
			const map = this._map;

			let startTime: number | null = null;
			let frame: number | null = null;

			const step = (timestamp: number) => {
				if (!startTime) startTime = timestamp;
				const progress = Math.min(1, (timestamp - startTime) / duration);
				const easeProgress = 1 - Math.pow(1 - progress, 1 / easeLinearity);

				const lat = from.lat + (to.lat - from.lat) * easeProgress;
				const lng = from.lng + (to.lng - from.lng) * easeProgress;

				marker.setLatLng([lat, lng]);

				if (keepAtCenter) {
					map.panTo([lat, lng], { animate: false });
				}

				if (progress < 1) {
					frame = window.requestAnimationFrame(step);
				} else if (options.complete) {
					options.complete();
				}
			};

			if (!noMoveStart) {
				frame = window.requestAnimationFrame(step);
			}

			return {
				cancel: () => {
					if (frame) {
						window.cancelAnimationFrame(frame);
					}
				}
			};
		};
	}

	const initMap = async (): Promise<boolean> => {
		if (!browser || !mapContainer) return false;

		try {
			const leaflet = await ensureLeafletLoaded();

			if (map) {
				map.remove();
				map = null;
			}

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

			const uniqueDrivers = data.reduce<PosicionConductor[]>((acc, current) => {
				const existingIndex = acc.findIndex((d) => d.conductor_id === current.conductor_id);
				if (existingIndex === -1) {
					acc.push({
						id: current.id,
						conductor_id: current.conductor_id,
						lat: current.lat,
						lng: current.lng,
						accuracy: current.accuracy,
						timestamp: current.timestamp,
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

	const updateMarkers = async (drivers: PosicionConductor[]) => {
		if (!map || !L) return;

		const activeDriverIds = drivers.map((d) => d.conductor_id);

		Object.keys(markers).forEach((id) => {
			const numericId = Number(id);
			if (!activeDriverIds.includes(numericId)) {
				map?.removeLayer(markers[numericId]);
				delete markers[numericId];
			}
		});

		drivers.forEach((driver) => {
			if (!driver.lat || !driver.lng || !driver.conductor) return;

			const newPosition = L!.latLng(driver.lat, driver.lng);
			const marker = markers[driver.conductor_id];

			if (marker) {
				marker.setPopupContent(createPopupContent(driver));

				const currentPos = marker.getLatLng();
				const distance = currentPos.distanceTo(newPosition);
				const duration = Math.min(2000, distance * 5);

				if (distance > 10) {
					marker.slideTo(newPosition, {
						duration: duration,
						keepAtCenter: false
					});
				} else {
					marker.setLatLng(newPosition);
				}
			} else {
				markers[driver.conductor_id] = L!.marker(newPosition, {
					icon: createDriverIcon(L!, driver.conductor.control)
				}) as CustomMarker;
				markers[driver.conductor_id].addTo(map!).bindPopup(createPopupContent(driver));
			}
		});
	};

	const setupSubscriptions = () => {
		if (channel) {
			supabase.removeChannel(channel);
		}

		channel = supabase
			.channel('realtime_positions')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'conductor_posiciones'
				},
				(payload) => {
					if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
						const newPosition = payload.new as PosicionConductor;
						activeDrivers.update((currentDrivers) => {
							const existingIndex = currentDrivers.findIndex(
								(d) => d.conductor_id === newPosition.conductor_id
							);

							if (existingIndex >= 0) {
								const updatedDrivers = [...currentDrivers];
								updatedDrivers[existingIndex] = {
									...updatedDrivers[existingIndex],
									lat: newPosition.lat,
									lng: newPosition.lng,
									timestamp: newPosition.timestamp
								};
								return updatedDrivers;
							} else {
								supabase
									.from('conductor')
									.select('*')
									.eq('id', newPosition.conductor_id)
									.single()
									.then(({ data }) => {
										if (data) {
											activeDrivers.update((drivers) => [
												...drivers,
												{
													...newPosition,
													conductor: data
												}
											]);
										}
									});
								return currentDrivers;
							}
						});
					}
				}
			)
			.subscribe();

		return channel;
	};

	onMount(() => {
		
		protegerRuta();
		const cleanup = () => {
			if (channel) supabase.removeChannel(channel);
			if (updateInterval) clearInterval(updateInterval);
			if (map) {
				map.remove();
				map = null;
			}
			mapInitialized = false;
		};

		// Función asíncrona de inicialización
		const initialize = async () => {
			try {
				await ensureLeafletLoaded();
				addLeafletAnimations(L!);
				await initMap();
				await getActiveDrivers();
				channel = setupSubscriptions();
				updateInterval = setInterval(getActiveDrivers, 30000);
			} catch (error) {
				console.error('Error en inicialización:', error);
			}
		};

		// Ejecutar inicialización
		initialize();

		// Retornar función de limpieza sincrónica
		return cleanup;
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
		if (updateInterval) clearInterval(updateInterval);
		if (channel) supabase.removeChannel(channel);
	});
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
		integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
		crossorigin=""
	/>
	<style>
		.driver-marker {
			transition: transform 0.3s ease;
		}
		.driver-marker.moving {
			transform: scale(1.2);
			animation: pulse 1s infinite;
		}
		@keyframes pulse {
			0% {
				transform: scale(1);
			}
			50% {
				transform: scale(1.2);
			}
			100% {
				transform: scale(1);
			}
		}
	</style>
</svelte:head>


<div class="app-container">
	<!-- Header -->
	<header class="app-header">
		<h1 class="app-title">Mapa de Conductores Activos</h1>
	</header>
	<div class="container mt-3 mb-3 d-flex justify-content-center gap-2 flex-wrap">
		<a href="/auth/dashboard-conductor/maps" class="btn btn-primary">Mapa de seguimiento</a>
		<a href="/pasajeros" class="btn btn-primary">Gestion</a>
	</div>

	<!-- Main Content -->
	<main class="main-content pt-5 mt-5">
		<section class="map-section">
			<div bind:this={mapContainer} class="map-view">
				{#if !mapInitialized}
					<div class="map-loading-overlay">
						<div class="loading-spinner"></div>
						<p class="loading-text">Cargando mapa...</p>
					</div>
				{/if}
			</div>
		</section>
		<button
			on:click={() => window.location.reload()}
			class="btn btn-info"
			title="Recargar la página"
		>
			🔄 Recargar para ver Nuevos conductores
		</button>
	</main>

	<!-- Error Message -->
	{#if errorMessage}
		<div class="error-notification">
			<svg class="error-icon" viewBox="0 0 24 24">
				<path
					fill="currentColor"
					d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"
				/>
			</svg>
			<span>{errorMessage}</span>
		</div>
	{/if}
</div>

<style>
	.app-container {
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
		max-width: 100%;
		min-height: 100vh;
		background-color: #f5f7fa;
		color: #333;
		padding: 0;
		margin: 0;
	}

	/* Header Styles */
	.app-header {
		position: relative;
		background: linear-gradient(135deg, #4f6ef7 0%, #2541fc 100%);
		color: white;
		padding: 1rem;
		padding-top: 10px;
		text-align: center;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.app-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		padding: 0.5rem 0;
	}

	/* Main Content Styles */
	.main-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 100%;
	}


	/* Map Section */
	.map-section {
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
		height: 60vh;
		max-height: 500px;
		position: relative;
	}

	.map-view {
		width: 100%;
		height: 100%;
		background: #e8ecf1;
	}

	.map-loading-overlay {
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
		z-index: 100;
	}

	.loading-spinner {
		border: 4px solid rgba(37, 65, 252, 0.1);
		border-radius: 50%;
		border-top: 4px solid #2541fc;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
	}

	.loading-text {
		margin-top: 1rem;
		color: #2541fc;
		font-weight: 500;
	}

	/* Error Notification */
	.error-notification {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		right: 1rem;
		background: #ff4444;
		color: white;
		padding: 1rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		z-index: 1000;
		animation: slideUp 0.3s ease;
		box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
	}

	.error-icon {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	/* Animations */
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Responsive Adjustments */
	@media (min-width: 768px) {
		.app-container {
			padding: 0;
		}

		.main-content {
			padding: 1.5rem;
			max-width: 768px;
			margin: 0 auto;
		}

		.map-section {
			max-height: 65vh;
		}

		.error-notification {
			left: 50%;
			transform: translateX(-50%);
			max-width: 80%;
			width: max-content;
		}
	}
</style>
